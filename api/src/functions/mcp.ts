// POST/GET/DELETE /api/mcp -> stateless MCP (Streamable HTTP) endpoint.
// Auth is an OAuth bearer JWT issued by this app (not SWA's owner role).

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { checkAccessToken } from '../oauth/tokens.js';
import { getAuthContainer } from '../oauth/markers.js';
import { corsHeaders, wwwAuthenticateHeader } from '../oauth/config.js';
import { registerTools } from '../mcp/tools.js';

// Managed Functions on the Free plan have no log sink, so keep the last failure of each kind
// in mcp-auth/last-reject (401) and mcp-auth/last-error (other non-2xx) for diagnosis.
// Only non-secret data: reasons, lengths, header *names*, protocol headers, JSON-RPC error text.
async function recordFailure(
  blobName: 'last-reject' | 'last-error',
  details: Record<string, unknown>,
  request: HttpRequest,
  context: InvocationContext,
): Promise<void> {
  try {
    const body = JSON.stringify({
      ...details,
      method: request.method,
      protocolVersion: request.headers.get('mcp-protocol-version'),
      accept: request.headers.get('accept'),
      contentType: request.headers.get('content-type'),
      authScheme: (request.headers.get('authorization') ?? '').split(' ')[0] || null,
      headerNames: [...request.headers.keys()].sort(),
      // Lengths only (never values): shows whether SWA rewrote or relocated the client's bearer token.
      authHeaderLengths: Object.fromEntries(
        ['authorization', 'x-ms-auth-token', 'x-ms-client-principal-id', 'x-ms-client-principal-idp']
          .map((h) => [h, request.headers.get(h)?.length ?? null]),
      ),
      at: new Date().toISOString(),
    });
    const container = await getAuthContainer();
    await container.getBlockBlobClient(blobName).upload(body, Buffer.byteLength(body), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });
  } catch (error) {
    context.log('Could not record MCP rejection', error instanceof Error ? error.message : 'unknown error');
  }
}

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return { status: 204, headers: corsHeaders() };
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  const token = match?.[1]?.trim();
  const check = token ? await checkAccessToken(token) : null;
  if (!token || !check || 'reason' in check) {
    // Reason + token length are non-secret and make auth failures diagnosable without logs.
    const description = token && check && 'reason' in check ? `${check.reason}; len=${token.length}` : undefined;
    if (description) {
      context.log(`MCP bearer rejected: ${description}`);
      await recordFailure('last-reject', { description }, request, context);
    }
    return {
      status: 401,
      jsonBody: description ? { error: 'invalid_token', error_description: description } : { error: 'invalid_token' },
      headers: {
        'WWW-Authenticate': wwwAuthenticateHeader(token ? 'invalid_token' : undefined, description),
        ...corsHeaders(),
      },
    };
  }
  const claims = check.claims;

  // Only POST is served. GET would open a never-ending SSE stream on the stateless transport.
  if (request.method !== 'POST') {
    return {
      status: 405,
      jsonBody: { error: 'method_not_allowed' },
      headers: { Allow: 'POST, OPTIONS', ...corsHeaders() },
    };
  }

  const server = new McpServer({ name: 'punch', version: '1.0.0' });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    registerTools(server);
    await server.connect(transport);

    // Only POST reaches this point (GET/DELETE are answered with 405 above).
    const webRequest = new Request(request.url, {
      method: request.method,
      headers: new Headers(Object.fromEntries(request.headers.entries())),
      body: await request.text(),
    });

    const res = await transport.handleRequest(webRequest, {
      authInfo: { token, clientId: claims.clientId, scopes: claims.scopes, expiresAt: claims.expiresAt },
    });

    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const body = res.status === 204 || res.status === 202 ? undefined : await res.text();
    if (res.status >= 400) {
      // Transport-level errors are JSON-RPC error objects (no user data).
      await recordFailure('last-error', { status: res.status, response: body?.slice(0, 300) }, request, context);
    }
    return {
      status: res.status,
      headers: { ...headers, ...corsHeaders() },
      body,
    };
  } catch (err) {
    context.error('MCP request failed', err);
    await recordFailure('last-error', { status: 500, error: err instanceof Error ? err.message.slice(0, 300) : 'unknown' }, request, context);
    return { status: 500, jsonBody: { error: 'server_error' }, headers: corsHeaders() };
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

app.http('mcp', {
  methods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'mcp',
  handler,
});
