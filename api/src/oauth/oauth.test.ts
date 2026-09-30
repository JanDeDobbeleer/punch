import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';

process.env.PUNCH_MCP_BASE_URL = 'https://punch.example.com';
process.env.PUNCH_MCP_JWT_SECRET = 'x'.repeat(40);
process.env.PUNCH_MCP_GITHUB_CLIENT_ID = 'gh-id';
process.env.PUNCH_MCP_GITHUB_CLIENT_SECRET = 'gh-secret';
process.env.PUNCH_MCP_ALLOWED_GITHUB_USER_ID = '42';

const store = vi.hoisted(() => new Map<string, string>());
vi.mock('../blobClient.js', async () => {
  const { RestError } = await import('@azure/storage-blob');
  return {
    getBlobServiceClient: () => ({
      getContainerClient: () => ({
        createIfNotExists: async () => ({}),
        getBlockBlobClient: (name: string) => ({
          upload: async (body: string, _len: number, opts?: { conditions?: { ifNoneMatch?: string } }) => {
            if (opts?.conditions?.ifNoneMatch === '*' && store.has(name)) throw new RestError('exists', { statusCode: 412 });
            store.set(name, body);
            return {};
          },
          downloadToBuffer: async () => {
            if (!store.has(name)) throw new RestError('not found', { statusCode: 404 });
            return Buffer.from(store.get(name)!);
          },
          deleteIfExists: async () => ({ succeeded: store.delete(name) }),
        }),
      }),
    }),
  };
});

const fetchGithubUserId = vi.fn();
vi.mock('./github.js', () => ({ fetchGithubUserId: (...a: unknown[]) => fetchGithubUserId(...a) }));

import { isAllowedRedirectUri } from './allowlist.js';
import { s256Challenge, verifyPkce } from './pkce.js';
import { signToken, verifyToken } from './jwt.js';
import { verifyAccessToken } from './tokens.js';
import { authorize, authorizePost, consentCsp, githubCallback, token } from './handlers.js';
import { getJwtSecret, wwwAuthenticateHeader } from './config.js';
import { arm, isArmed } from './arming.js';
import { mcpArmHandler } from '../functions/mcpArm.js';

const ctx = { error: vi.fn(), log: vi.fn() };
const BASE = 'https://punch.example.com';
const VERIFIER = 'a'.repeat(50);
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';

function tokenReq(params: Record<string, string>) {
  return {
    text: async () => new URLSearchParams(params).toString(),
    headers: new Headers({ 'content-type': 'application/x-www-form-urlencoded' }),
  } as never;
}

describe('pkce', () => {
  it('accepts a matching verifier', () => {
    expect(verifyPkce(VERIFIER, s256Challenge(VERIFIER))).toBe(true);
  });
  it('rejects mismatch and bad length', () => {
    expect(verifyPkce('b'.repeat(50), s256Challenge(VERIFIER))).toBe(false);
    expect(verifyPkce('short', s256Challenge('short'))).toBe(false);
    expect(verifyPkce(undefined, 'x')).toBe(false);
  });
});

describe('allowlist', () => {
  it.each([REDIRECT, 'https://claude.com/api/mcp/auth_callback'])('accepts %s', (u) => expect(isAllowedRedirectUri(u, false)).toBe(true));
  it.each(['http://localhost:6274/oauth/callback', 'http://127.0.0.1:3000/cb'])('accepts %s only with the localhost flag', (u) => {
    expect(isAllowedRedirectUri(u, true)).toBe(true);
    expect(isAllowedRedirectUri(u, false)).toBe(false);
    delete process.env.PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT;
    expect(isAllowedRedirectUri(u)).toBe(false);
    process.env.PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT = '1';
    expect(isAllowedRedirectUri(u)).toBe(true);
    delete process.env.PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT;
  });
  it.each([
    'https://evil.com/api/mcp/auth_callback',
    'http://claude.ai/api/mcp/auth_callback',
    'https://claude.ai/other',
    'https://localhost/cb',
    'http://localhost.evil.com/cb',
    'not a url',
  ])('rejects %s', (u) => expect(isAllowedRedirectUri(u, true)).toBe(false));
});

describe('jwt / access tokens', () => {
  it('rejects wrong typ', async () => {
    const t = await signToken('refresh', { jti: '1' }, { ttlSeconds: 60 });
    expect(await verifyToken(t, 'code')).toBeNull();
    expect(await verifyToken(t, 'refresh')).not.toBeNull();
  });

  it('accepts a valid access token', async () => {
    const t = await signToken('access', { cid: 'c', scope: 'punch' }, { ttlSeconds: 60, audience: `${BASE}/api/mcp`, subject: '42' });
    const claims = await verifyAccessToken(t);
    expect(claims?.sub).toBe('42');
    expect(claims?.scopes).toEqual(['punch']);
  });

  it('rejects wrong aud, expired, wrong sub, wrong typ', async () => {
    const wrongAud = await signToken('access', { cid: 'c' }, { ttlSeconds: 60, audience: 'https://other', subject: '42' });
    const expired = await signToken('access', { cid: 'c' }, { ttlSeconds: -10, audience: `${BASE}/api/mcp`, subject: '42' });
    const wrongSub = await signToken('access', { cid: 'c' }, { ttlSeconds: 60, audience: `${BASE}/api/mcp`, subject: '7' });
    const wrongTyp = await signToken('code', { cid: 'c' }, { ttlSeconds: 60, audience: `${BASE}/api/mcp`, subject: '42' });
    for (const t of [wrongAud, expired, wrongSub, wrongTyp, 'garbage']) {
      expect(await verifyAccessToken(t)).toBeNull();
    }
  });

  it('rejects non-HS256 / wrong secret', async () => {
    const forged = await new SignJWT({ typ: 'access', cid: 'c' })
      .setProtectedHeader({ alg: 'HS256' }).setIssuer(BASE).setAudience(`${BASE}/api/mcp`).setSubject('42')
      .setExpirationTime('1h').sign(new TextEncoder().encode('y'.repeat(40)));
    expect(await verifyAccessToken(forged)).toBeNull();
  });
});

describe('www-authenticate', () => {
  it('includes error only when given', () => {
    expect(wwwAuthenticateHeader()).toBe(`Bearer resource_metadata="${BASE}/.well-known/oauth-protected-resource"`);
    expect(wwwAuthenticateHeader('invalid_token')).toContain(', error="invalid_token"');
  });
});

describe('token endpoint', () => {
  let code: string;
  beforeAll(async () => {
    code = await signToken('code', {
      cid: 'client1', ru: REDIRECT, cc: s256Challenge(VERIFIER), jti: 'jti-1',
    }, { ttlSeconds: 60, subject: '42' });
  });

  const exchange = () => token(tokenReq({
    grant_type: 'authorization_code', code, client_id: 'client1', redirect_uri: REDIRECT, code_verifier: VERIFIER,
  }), ctx);

  it('issues tokens once, then replay gives invalid_grant', async () => {
    const first = await exchange();
    expect(first.status).toBe(200);
    const body = first.jsonBody as { access_token: string; refresh_token: string };
    expect(await verifyAccessToken(body.access_token)).not.toBeNull();

    const second = await exchange();
    expect(second.status).toBe(400);
    expect((second.jsonBody as { error: string }).error).toBe('invalid_grant');

    // refresh rotation: first use ok, replay rejected
    const refresh = () => token(tokenReq({ grant_type: 'refresh_token', refresh_token: body.refresh_token, client_id: 'client1' }), ctx);
    expect((await refresh()).status).toBe(200);
    expect((await refresh()).jsonBody).toMatchObject({ error: 'invalid_grant' });
  });

  it('rejects a code used with the wrong verifier or type', async () => {
    const other = await signToken('code', { cid: 'client1', ru: REDIRECT, cc: s256Challenge(VERIFIER), jti: 'jti-2' }, { ttlSeconds: 60, subject: '42' });
    const bad = await token(tokenReq({ grant_type: 'authorization_code', code: other, client_id: 'client1', redirect_uri: REDIRECT, code_verifier: 'z'.repeat(50) }), ctx);
    expect(bad.jsonBody).toMatchObject({ error: 'invalid_grant' });
    const refreshAsCode = await signToken('refresh', { cid: 'client1', jti: 'j3' }, { ttlSeconds: 60, subject: '42' });
    const wrongTyp = await token(tokenReq({ grant_type: 'authorization_code', code: refreshAsCode, client_id: 'client1', redirect_uri: REDIRECT, code_verifier: VERIFIER }), ctx);
    expect(wrongTyp.jsonBody).toMatchObject({ error: 'invalid_grant' });
  });

  it('rejects a mismatching resource with invalid_target', async () => {
    const res = await token(tokenReq({ grant_type: 'refresh_token', refresh_token: 'x', client_id: 'client1', resource: 'https://other.example/api/mcp' }), ctx);
    expect(res.jsonBody).toMatchObject({ error: 'invalid_target' });
  });

  it('rejects unsupported grant type', async () => {
    expect((await token(tokenReq({ grant_type: 'password' }), ctx)).jsonBody).toMatchObject({ error: 'unsupported_grant_type' });
  });
});

describe('github callback', () => {
  async function callback(userId: string) {
    await arm();
    fetchGithubUserId.mockResolvedValueOnce(userId);
    const ghstate = await signToken('ghstate', {
      cid: 'client1', ru: REDIRECT, cc: s256Challenge(VERIFIER), st: 'client-state', sc: 'punch', n: 'nonce123',
    }, { ttlSeconds: 600 });
    return githubCallback({
      query: new URLSearchParams({ state: ghstate, code: 'gh-code' }),
      headers: new Headers({ cookie: 'punch_oauth_nonce=nonce123' }),
    } as never, ctx);
  }

  it('redirects with access_denied for a different GitHub user', async () => {
    const res = await callback('999');
    const loc = new URL(res.headers && (res.headers as Record<string, string>).Location);
    expect(res.status).toBe(302);
    expect(loc.searchParams.get('error')).toBe('access_denied');
    expect(loc.searchParams.get('state')).toBe('client-state');
    expect(loc.searchParams.get('code')).toBeNull();
    expect(await isArmed()).toBe(true);
  });

  it('redirects with a code for the allowed user', async () => {
    const res = await callback('42');
    const loc = new URL((res.headers as Record<string, string>).Location);
    expect(loc.searchParams.get('error')).toBeNull();
    const c = await verifyToken(loc.searchParams.get('code')!, 'code');
    expect(c?.sub).toBe('42');
    expect(loc.searchParams.get('state')).toBe('client-state');
    expect(await isArmed()).toBe(false); // one arming = one connection
  });

  it('rejects a callback whose nonce cookie does not match', async () => {
    const ghstate = await signToken('ghstate', { cid: 'c', ru: REDIRECT, cc: 'x', n: 'nonce123' }, { ttlSeconds: 600 });
    const res = await githubCallback({
      query: new URLSearchParams({ state: ghstate, code: 'gh-code' }),
      headers: new Headers({ cookie: 'punch_oauth_nonce=other' }),
    } as never, ctx);
    expect(res.status).toBe(400);
  });
});

describe('consent step', () => {
  async function clientId(name: string) {
    return signToken('client', { ru: [REDIRECT], cn: name });
  }
  async function consentJwt(ttl = 300, typ: 'consent' | 'code' = 'consent') {
    return signToken(typ, { cid: 'client1', ru: REDIRECT, cc: s256Challenge(VERIFIER), st: 'st1', sc: 'punch', n: 'n1' }, { ttlSeconds: ttl });
  }
  function post(fields: Record<string, string>, cookie = 'punch_oauth_nonce=n1') {
    return authorizePost({
      text: async () => new URLSearchParams(fields).toString(),
      headers: new Headers({ cookie }),
    } as never, ctx);
  }
  const loc = (r: { headers?: unknown }) => new URL((r.headers as Record<string, string>).Location);

  it('GET renders escaped consent page and sets nonce cookie', async () => {
    await arm();
    const res = await authorize({
      query: new URLSearchParams({
        client_id: await clientId('<script>alert(1)</script>'), redirect_uri: REDIRECT, response_type: 'code',
        code_challenge: s256Challenge(VERIFIER), code_challenge_method: 'S256', state: 's',
      }),
    } as never, ctx);
    expect(res.status).toBe(200);
    const html = res.body as string;
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('claude.ai');
    expect((res.headers as Record<string, string>)['Set-Cookie']).toContain('punch_oauth_nonce=');
    expect((res.headers as Record<string, string>)['Content-Type']).toContain('text/html');
  });

  it('approve with valid cookie redirects to GitHub', async () => {
    await arm();
    const res = await post({ consent: await consentJwt(), action: 'approve' });
    expect(res.status).toBe(302);
    expect(loc(res).origin + loc(res).pathname).toBe('https://github.com/login/oauth/authorize');
  });

  it('mismatched cookie gives 400', async () => {
    expect((await post({ consent: await consentJwt(), action: 'approve' }, 'punch_oauth_nonce=zzz')).status).toBe(400);
  });

  it('deny redirects with access_denied', async () => {
    const res = await post({ consent: await consentJwt(), action: 'deny' });
    expect(loc(res).searchParams.get('error')).toBe('access_denied');
    expect(loc(res).searchParams.get('state')).toBe('st1');
  });

  it('forged, expired or wrong-typ consent gives 400', async () => {
    expect((await post({ consent: 'garbage', action: 'approve' })).status).toBe(400);
    expect((await post({ consent: await consentJwt(-10), action: 'approve' })).status).toBe(400);
    expect((await post({ consent: await consentJwt(300, 'code'), action: 'approve' })).status).toBe(400);
  });
});

describe('arming', () => {
  const authQuery = async () => new URLSearchParams({
    client_id: await signToken('client', { ru: [REDIRECT], cn: 'Claude' }),
    redirect_uri: REDIRECT,
    response_type: 'code',
    code_challenge: s256Challenge(VERIFIER),
    code_challenge_method: 'S256',
  });
  const consent = () => signToken('consent', { cid: 'client1', ru: REDIRECT, cc: s256Challenge(VERIFIER), n: 'n1' }, { ttlSeconds: 300 });
  const principal = (roles: string[]) => Buffer.from(JSON.stringify({ identityProvider: 'github', userId: 'u', userDetails: 'me', userRoles: roles })).toString('base64');

  it('GET authorize without arming gives 400, with arming gives consent page', async () => {
    store.clear();
    const denied = await authorize({ query: await authQuery() } as never, ctx);
    expect(denied.status).toBe(400);
    expect(denied.body as string).toContain('Connect MCP');
    await arm();
    const ok = await authorize({ query: await authQuery() } as never, ctx);
    expect(ok.status).toBe(200);
  });

  it('expired or corrupt arming counts as not armed', async () => {
    store.set('armed', JSON.stringify({ armedUntil: Date.now() - 1000 }));
    expect(await isArmed()).toBe(false);
    store.set('armed', 'not json');
    expect(await isArmed()).toBe(false);
    store.clear();
    expect(await isArmed()).toBe(false);
  });

  it('POST approve without arming gives 400; deny still redirects', async () => {
    store.clear();
    const c = await consent();
    const mk = (action: string) => ({
      text: async () => new URLSearchParams({ consent: c, action }).toString(),
      headers: new Headers({ cookie: 'punch_oauth_nonce=n1' }),
    });
    expect((await authorizePost(mk('approve') as never, ctx)).status).toBe(400);
    expect((await authorizePost(mk('deny') as never, ctx)).status).toBe(302);
  });

  it('mcp-arm: 401 without owner, 200 with owner and writes the blob', async () => {
    store.clear();
    const none = await mcpArmHandler({ headers: new Headers() } as never, ctx);
    expect(none.status).toBe(401);
    const wrongRole = await mcpArmHandler({ headers: new Headers({ 'x-ms-client-principal': principal(['authenticated']) }) } as never, ctx);
    expect(wrongRole.status).toBe(401);
    expect(store.has('armed')).toBe(false);

    const ok = await mcpArmHandler({ headers: new Headers({ 'x-ms-client-principal': principal(['owner']) }) } as never, ctx);
    expect(ok.status).toBe(200);
    const until = Date.parse((ok.jsonBody as { armedUntil: string }).armedUntil);
    expect(until).toBeGreaterThan(Date.now() + 4 * 60 * 1000);
    expect(JSON.parse(store.get('armed')!).armedUntil).toBe(until);
    expect(await isArmed()).toBe(true);
  });
});

describe('localhost redirect flag and CSP', () => {
  it('consent CSP form-action includes localhost only when the flag is on', () => {
    delete process.env.PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT;
    expect(consentCsp()).not.toContain('localhost');
    process.env.PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT = '1';
    expect(consentCsp()).toContain('http://localhost:*');
    expect(consentCsp()).toContain('http://127.0.0.1:*');
    delete process.env.PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT;
  });

  it('authorize rejects a localhost redirect when the flag is off', async () => {
    await arm();
    const local = 'http://localhost:6274/cb';
    const query = new URLSearchParams({
      client_id: await signToken('client', { ru: [local] }),
      redirect_uri: local,
      response_type: 'code',
      code_challenge: s256Challenge(VERIFIER),
      code_challenge_method: 'S256',
    });
    expect((await authorize({ query } as never, ctx)).status).toBe(400);
    process.env.PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT = '1';
    expect((await authorize({ query } as never, ctx)).status).toBe(200);
    delete process.env.PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT;
  });
});

describe('jwt secret', () => {
  it('rejects placeholder secrets', () => {
    const original = process.env.PUNCH_MCP_JWT_SECRET;
    process.env.PUNCH_MCP_JWT_SECRET = 'CHANGE-ME-generate-with-openssl-rand-base64-48';
    expect(() => getJwtSecret()).toThrow();
    process.env.PUNCH_MCP_JWT_SECRET = 'replace-with-a-random-string-of-at-least-32-chars';
    expect(() => getJwtSecret()).toThrow();
    process.env.PUNCH_MCP_JWT_SECRET = original;
    expect(() => getJwtSecret()).not.toThrow();
  });
});
