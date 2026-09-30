// POST/GET/DELETE /api/mcp -> stateless MCP (Streamable HTTP) endpoint.
// Auth is an OAuth bearer JWT issued by this app (not SWA's owner role).

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { checkAccessToken } from '../oauth/tokens.js';
import { corsHeaders, wwwAuthenticateHeader } from '../oauth/config.js';
import { registerTools } from '../mcp/tools.js';
import { isMcpHost, route } from '../role.js';

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return { status: 204, headers: corsHeaders() };
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  const token = match?.[1]?.trim();
  const check = token ? await checkAccessToken(token) : null;
  if (!token || !check || 'reason' in check) {
    // Reason + token length are non-secret (RFC 6750 error_description) and make auth failures
    // diagnosable from the client side too.
    const description = token && check && 'reason' in check ? `${check.reason}; len=${token.length}` : undefined;
    if (description) context.log(`MCP bearer rejected: ${description}`);
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
      context.warn(`MCP transport returned ${res.status}: ${body?.slice(0, 300) ?? ''}`);
    }
    return {
      status: res.status,
      headers: { ...headers, ...corsHeaders() },
      body,
    };
  } catch (err) {
    context.error('MCP request failed', err);
    return { status: 500, jsonBody: { error: 'server_error' }, headers: corsHeaders() };
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

if (isMcpHost()) app.http('mcp', {
  methods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: route('mcp'),
  handler,
});
