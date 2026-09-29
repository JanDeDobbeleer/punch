// POST/GET/DELETE /api/mcp -> stateless MCP (Streamable HTTP) endpoint.
// Auth is an OAuth bearer JWT issued by this app (not SWA's owner role).

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { verifyAccessToken } from '../oauth/tokens.js';
import { corsHeaders, wwwAuthenticateHeader } from '../oauth/config.js';
import { registerTools } from '../mcp/tools.js';

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return { status: 204, headers: corsHeaders() };
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  const token = match?.[1]?.trim();
  const claims = token ? await verifyAccessToken(token) : null;
  if (!token || !claims) {
    return {
      status: 401,
      jsonBody: { error: 'invalid_token' },
      headers: {
        'WWW-Authenticate': wwwAuthenticateHeader(token ? 'invalid_token' : undefined),
        ...corsHeaders(),
      },
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

    const hasBody = request.method !== 'GET' && request.method !== 'DELETE' && request.method !== 'HEAD';
    const webRequest = new Request(request.url, {
      method: request.method,
      headers: new Headers(Object.fromEntries(request.headers.entries())),
      body: hasBody ? await request.text() : undefined,
    });

    const res = await transport.handleRequest(webRequest, {
      authInfo: { token, clientId: claims.clientId, scopes: claims.scopes, expiresAt: claims.expiresAt },
    });

    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return {
      status: res.status,
      headers: { ...headers, ...corsHeaders() },
      body: res.status === 204 || res.status === 202 ? undefined : await res.text(),
    };
  } catch (err) {
    context.error('MCP request failed', err);
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
