// End-to-end-ish test of the /api/mcp Function: real HttpRequest, real bearer
// verification, real Streamable HTTP transport; only blob storage is faked.

import { beforeAll, describe, expect, test, vi } from 'vitest';

process.env.PUNCH_MCP_BASE_URL = 'https://punch.example.com';
process.env.PUNCH_MCP_JWT_SECRET = 'x'.repeat(40);
process.env.PUNCH_MCP_GITHUB_CLIENT_ID = 'gh-id';
process.env.PUNCH_MCP_GITHUB_CLIENT_SECRET = 'gh-secret';
process.env.PUNCH_MCP_ALLOWED_GITHUB_USER_ID = '42';

type Handler = (req: unknown, ctx: unknown) => Promise<{ status?: number; headers?: Record<string, string>; body?: unknown }>;
const handlers = new Map<string, Handler>();

vi.mock('@azure/functions', async (importActual) => {
  const actual = await importActual<typeof import('@azure/functions')>();
  return { ...actual, app: { http: (name: string, opts: { handler: Handler }) => handlers.set(name, opts.handler) } };
});

vi.mock('../stateStore.js', () => ({
  ConflictError: class ConflictError extends Error {},
  readMainState: async () => ({
    data: { customers: [{ id: 'c1', name: 'Acme', color: '#000' }], projects: [], services: [], entries: [] },
    etag: '"1"',
  }),
  readYearEntries: async () => ({ entries: [], etag: '' }),
  writeMainState: async () => '"2"',
  writeYearState: async () => '"2"',
}));

const { HttpRequest } = await import('@azure/functions');
const { issueTokenPair } = await import('../oauth/tokens.js');
const { signToken } = await import('../oauth/jwt.js');
await import('./mcp.js');

const ctx = { error: vi.fn(), log: vi.fn() };
const mcp = () => handlers.get('mcp')!;

function rpc(body: unknown, token?: string) {
  return new HttpRequest({
    method: 'POST',
    url: 'https://punch.example.com/api/mcp',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: { string: JSON.stringify(body) },
  });
}

const initialize = {
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
};

let token: string;
beforeAll(async () => {
  token = (await issueTokenPair('42', 'client-x')).access_token;
});

describe('/api/mcp', () => {
  test('no token → 401 with resource_metadata challenge', async () => {
    const res = await mcp()(rpc(initialize), ctx);
    expect(res.status).toBe(401);
    expect(res.headers?.['WWW-Authenticate']).toContain('resource_metadata="https://punch.example.com/.well-known/oauth-protected-resource"');
  });

  test('token for another GitHub user → 401 invalid_token', async () => {
    const other = (await issueTokenPair('999', 'client-x')).access_token;
    const res = await mcp()(rpc(initialize, other), ctx);
    expect(res.status).toBe(401);
    expect(res.headers?.['WWW-Authenticate']).toContain('error="invalid_token"');
  });

  test('refresh token is not accepted as access token', async () => {
    const refresh = await signToken('refresh', { cid: 'client-x', jti: 'j' }, { ttlSeconds: 60, subject: '42' });
    const res = await mcp()(rpc(initialize, refresh), ctx);
    expect(res.status).toBe(401);
  });

  test('valid token → initialize succeeds', async () => {
    const res = await mcp()(rpc(initialize, token), ctx);
    expect(res.status).toBe(200);
    const body = JSON.parse(String(res.body));
    expect(body.result.serverInfo.name).toBe('punch');
  });

  test('valid token → tools/list and tools/call work statelessly', async () => {
    const list = await mcp()(rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, token), ctx);
    expect(list.status).toBe(200);
    const names = JSON.parse(String(list.body)).result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(expect.arrayContaining(['list_customers', 'log_entry', 'get_earnings', 'delete_entry']));

    const call = await mcp()(rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_customers', arguments: {} } }, token), ctx);
    expect(call.status).toBe(200);
    expect(String(call.body)).toContain('Acme');
  });
});
