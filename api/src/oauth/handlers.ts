// OAuth 2.1 authorization server endpoints (handlers only; registered in functions/oauth.ts).

import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { isAllowedRedirectUri } from './allowlist.js';
import { ConfigError, corsHeaders, getAllowedGithubUserId, getBaseUrl, getGithubClient, localhostRedirectsAllowed, mcpResourceUrl } from './config.js';
import { disarm, isArmed } from './arming.js';
import { fetchGithubUserId } from './github.js';
import { signToken, verifyToken } from './jwt.js';
import { consumeOnce } from './markers.js';
import { verifyPkce } from './pkce.js';
import { CODE_TTL, GHSTATE_TTL, SCOPE, issueTokenPair } from './tokens.js';

const CONSENT_TTL = 300;
const NONCE_COOKIE = 'punch_oauth_nonce';
const NO_STORE = { 'Cache-Control': 'no-store' };
const NOT_ARMED_MESSAGE = 'Punch MCP connections must be started from Punch → Settings → Connect MCP (valid for 5 minutes).';
const ALLOWED_GRANTS = ['authorization_code', 'refresh_token'];

type Ctx = Pick<InvocationContext, 'error' | 'log'>;

function json(status: number, body: unknown, extra: Record<string, string> = {}): HttpResponseInit {
  return { status, jsonBody: body, headers: { ...corsHeaders(), ...extra } };
}

function oauthError(error: string, description?: string, status = 400): HttpResponseInit {
  return json(status, description ? { error, error_description: description } : { error }, NO_STORE);
}

function htmlError(message: string): HttpResponseInit {
  return { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...NO_STORE }, body: message };
}

function serverError(context: Ctx, what: string, error: unknown): HttpResponseInit {
  if (error instanceof ConfigError) {
    context.error(`OAuth misconfigured: ${error.message}`);
  } else {
    context.error(`OAuth ${what} failed`, error instanceof Error ? error.message : 'unknown error');
  }
  return json(500, { error: 'server_error' }, NO_STORE);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function redirect(location: string, extra: Record<string, string> = {}): HttpResponseInit {
  return { status: 302, headers: { Location: location, ...NO_STORE, ...extra } };
}

function redirectWith(redirectUri: string, params: Record<string, string | undefined>, extra: Record<string, string> = {}): HttpResponseInit {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }
  return redirect(url.toString(), extra);
}

function nonceCookie(nonce: string): string {
  return `${NONCE_COOKIE}=${nonce}; HttpOnly; Secure; SameSite=Lax; Path=/api/oauth; Max-Age=600`;
}

function clearNonceCookie(): string {
  return `${NONCE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/api/oauth; Max-Age=0`;
}

function readCookie(request: HttpRequest, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return undefined;
}

export function preflight(): HttpResponseInit {
  return { status: 204, headers: corsHeaders() };
}

export async function protectedResource(): Promise<HttpResponseInit> {
  try {
    return json(200, {
      resource: mcpResourceUrl(),
      authorization_servers: [getBaseUrl()],
      scopes_supported: [SCOPE],
      bearer_methods_supported: ['header'],
    });
  } catch {
    return json(500, { error: 'server_error' });
  }
}

export async function metadata(): Promise<HttpResponseInit> {
  try {
    const base = getBaseUrl();
    return json(200, {
      issuer: base,
      authorization_endpoint: `${base}/api/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ALLOWED_GRANTS,
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: [SCOPE],
    });
  } catch {
    return json(500, { error: 'server_error' });
  }
}

export async function register(request: HttpRequest, context: Ctx): Promise<HttpResponseInit> {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return oauthError('invalid_client_metadata', 'Body must be a JSON object.');
  }

  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 10 || !uris.every((u) => typeof u === 'string')) {
    return oauthError('invalid_redirect_uri', 'redirect_uris must be a non-empty array of strings.');
  }
  if (!uris.every((u) => isAllowedRedirectUri(u))) {
    return oauthError('invalid_redirect_uri', 'One or more redirect_uris are not allowed.');
  }
  const method = body.token_endpoint_auth_method;
  if (method !== undefined && method !== 'none') {
    return oauthError('invalid_client_metadata', 'Only token_endpoint_auth_method "none" is supported.');
  }
  const grants = body.grant_types;
  if (grants !== undefined && (!Array.isArray(grants) || !grants.every((g) => typeof g === 'string' && ALLOWED_GRANTS.includes(g)))) {
    return oauthError('invalid_client_metadata', 'Unsupported grant_types.');
  }
  const responseTypes = body.response_types;
  if (responseTypes !== undefined && (!Array.isArray(responseTypes) || !responseTypes.every((r) => r === 'code'))) {
    return oauthError('invalid_client_metadata', 'Unsupported response_types.');
  }
  const clientName = typeof body.client_name === 'string' ? body.client_name.slice(0, 200) : undefined;

  try {
    const issuedAt = Math.floor(Date.now() / 1000);
    const clientId = await signToken('client', { ru: uris, cn: clientName });
    return json(201, {
      client_id: clientId,
      client_id_issued_at: issuedAt,
      client_name: clientName,
      redirect_uris: uris,
      grant_types: ALLOWED_GRANTS,
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }, NO_STORE);
  } catch (error) {
    return serverError(context, 'register', error);
  }
}

export async function authorize(request: HttpRequest, context: Ctx): Promise<HttpResponseInit> {
  try {
    const q = request.query;
    const clientId = q.get('client_id') ?? '';
    const redirectUri = q.get('redirect_uri') ?? '';
    const client = clientId ? await verifyToken(clientId, 'client') : null;
    const registered = client && Array.isArray(client.ru) ? (client.ru as unknown[]) : [];
    if (!client || !redirectUri || !registered.includes(redirectUri) || !isAllowedRedirectUri(redirectUri)) {
      return htmlError('Invalid client_id or redirect_uri.');
    }
    if (!(await isArmed())) return htmlError(NOT_ARMED_MESSAGE);

    const state = q.get('state') ?? undefined;
    const fail = (error: string, description: string) => redirectWith(redirectUri, { error, error_description: description, state });

    if (q.get('response_type') !== 'code') return fail('unsupported_response_type', 'response_type must be code.');
    const challenge = q.get('code_challenge');
    if (!challenge || !/^[A-Za-z0-9\-._~]{43,128}$/.test(challenge)) return fail('invalid_request', 'code_challenge is required.');
    if (q.get('code_challenge_method') !== 'S256') return fail('invalid_request', 'code_challenge_method must be S256.');
    const resource = q.get('resource');
    if (resource && resource !== mcpResourceUrl()) return fail('invalid_target', 'Unknown resource.');

    const nonce = randomBytes(24).toString('base64url');
    const consent = await signToken('consent', {
      cid: clientId,
      ru: redirectUri,
      cc: challenge,
      st: state,
      n: nonce,
    }, { ttlSeconds: CONSENT_TTL });
    const clientName = typeof client.cn === 'string' && client.cn ? client.cn : 'Unknown client';
    return {
      status: 200,
      body: consentPage(clientName, redirectUri, consent),
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...NO_STORE,
        'X-Frame-Options': 'DENY',
        // SWA globalHeaders don't apply to API responses, so the page carries its own CSP.
        // form-action must allow the post-submit redirect targets (Chrome enforces it on redirects).
        'Content-Security-Policy': consentCsp(),
        'Set-Cookie': nonceCookie(nonce),
      },
    };
  } catch (error) {
    return serverError(context, 'authorize', error);
  }
}

export function consentCsp(): string {
  // form-action also governs redirects after submit: GitHub (approve) and the client callback (deny).
  const targets = ["'self'", 'https://github.com', 'https://claude.ai', 'https://claude.com'];
  if (localhostRedirectsAllowed()) targets.push('http://localhost:*', 'http://127.0.0.1:*');
  return `default-src 'none'; style-src 'unsafe-inline'; form-action ${targets.join(' ')}; frame-ancestors 'none'; base-uri 'none'`;
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function consentPage(clientName: string, redirectUri: string, consent: string): string {
  let host = '';
  try {
    host = new URL(redirectUri).host;
  } catch {
    host = '';
  }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect to Punch</title>
<style>
body{font-family:system-ui,sans-serif;background:#f4f4f5;margin:0;padding:24px;color:#111}
main{max-width:480px;margin:40px auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,.15)}
h1{font-size:20px;margin:0 0 16px}dl{margin:0 0 16px}dt{font-size:12px;color:#555;margin-top:12px}dd{margin:2px 0 0;word-break:break-all}
.warn{background:#fff4e5;border:1px solid #f5b041;border-radius:8px;padding:12px;margin-bottom:16px}
button{font-size:16px;min-height:44px;padding:0 20px;border-radius:8px;border:1px solid #111;cursor:pointer;margin-right:8px}
.approve{background:#111;color:#fff}.deny{background:#fff;color:#111}
</style></head><body><main>
<h1>Connect an app to Punch?</h1>
<dl>
<dt>Client</dt><dd>${escapeHtml(clientName)}</dd>
<dt>Redirects to</dt><dd>${escapeHtml(host)}<br>${escapeHtml(redirectUri)}</dd>
<dt>Requested access</dt><dd>Read your Punch data and create/update/delete time entries</dd>
</dl>
<p class="warn">Only continue if you just started connecting Punch yourself.</p>
<form method="post" action="/api/oauth/authorize">
<input type="hidden" name="consent" value="${escapeHtml(consent)}">
<button class="approve" type="submit" name="action" value="approve">Approve</button>
<button class="deny" type="submit" name="action" value="deny">Deny</button>
</form>
</main></body></html>`;
}

export async function authorizePost(request: HttpRequest, context: Ctx): Promise<HttpResponseInit> {
  try {
    let form: URLSearchParams;
    try {
      form = new URLSearchParams(await request.text());
    } catch {
      return htmlError('Malformed request.');
    }
    const consentJwt = form.get('consent') ?? '';
    const c = consentJwt ? await verifyToken(consentJwt, 'consent') : null;
    const nonce = c && typeof c.n === 'string' ? c.n : undefined;
    const cookieNonce = readCookie(request, NONCE_COOKIE);
    if (!c || !nonce || !cookieNonce || !safeEqual(nonce, cookieNonce)) {
      return htmlError('Invalid or expired consent. Start the connection again.');
    }
    const redirectUri = c.ru;
    if (typeof redirectUri !== 'string' || typeof c.cid !== 'string' || typeof c.cc !== 'string' || !isAllowedRedirectUri(redirectUri)) {
      return htmlError('Invalid consent.');
    }
    const state = typeof c.st === 'string' ? c.st : undefined;
    if (form.get('action') === 'deny') {
      return redirectWith(redirectUri, { error: 'access_denied', state }, { 'Set-Cookie': clearNonceCookie() });
    }

    if (!(await isArmed())) return htmlError(NOT_ARMED_MESSAGE);

    const { clientId: ghClientId } = getGithubClient();
    const ghstate = await signToken('ghstate', {
      cid: c.cid,
      ru: redirectUri,
      cc: c.cc,
      st: state,
      n: nonce,
    }, { ttlSeconds: GHSTATE_TTL });

    const gh = new URL('https://github.com/login/oauth/authorize');
    gh.searchParams.set('client_id', ghClientId);
    gh.searchParams.set('redirect_uri', `${getBaseUrl()}/api/oauth/github/callback`);
    gh.searchParams.set('state', ghstate);
    gh.searchParams.set('allow_signup', 'false');
    return redirect(gh.toString(), { 'Set-Cookie': nonceCookie(nonce) });
  } catch (error) {
    return serverError(context, 'authorize consent', error);
  }
}

export async function githubCallback(request: HttpRequest, context: Ctx): Promise<HttpResponseInit> {
  try {
    const ghstate = request.query.get('state') ?? '';
    const pending = ghstate ? await verifyToken(ghstate, 'ghstate') : null;
    const nonce = pending && typeof pending.n === 'string' ? pending.n : undefined;
    const cookieNonce = readCookie(request, NONCE_COOKIE);
    if (!pending || !nonce || !cookieNonce || !safeEqual(nonce, cookieNonce)) {
      return htmlError('Invalid or expired sign-in state. Start the connection again.');
    }
    const redirectUri = pending.ru as string;
    const clientId = pending.cid as string;
    const clear = { 'Set-Cookie': clearNonceCookie() };
    const state = typeof pending.st === 'string' ? pending.st : undefined;
    const denied = () => redirectWith(redirectUri, { error: 'access_denied', state }, clear);

    const code = request.query.get('code');
    if (!code || request.query.get('error')) return denied();

    let userId: string;
    try {
      userId = await fetchGithubUserId(code, `${getBaseUrl()}/api/oauth/github/callback`);
    } catch (error) {
      context.error('GitHub identity lookup failed', error instanceof Error ? error.message : 'unknown error');
      return denied();
    }
    if (!safeEqual(userId, getAllowedGithubUserId())) {
      context.log('OAuth sign-in rejected: GitHub user not allowed.');
      return denied();
    }

    // One arming = one connection. Fail closed if the marker cannot be cleared.
    await disarm();

    const authCode = await signToken('code', {
      cid: clientId,
      ru: redirectUri,
      cc: pending.cc,
      jti: randomBytes(16).toString('hex'),
    }, { ttlSeconds: CODE_TTL, subject: userId });
    return redirectWith(redirectUri, { code: authCode, state }, clear);
  } catch (error) {
    return serverError(context, 'github callback', error);
  }
}

async function readParams(request: HttpRequest): Promise<Record<string, string>> {
  const text = await request.text();
  const type = request.headers.get('content-type') ?? '';
  const out: Record<string, string> = {};
  if (type.includes('application/json')) {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string') out[k] = v;
    }
  } else {
    for (const [k, v] of new URLSearchParams(text)) out[k] = v;
  }
  return out;
}

export async function token(request: HttpRequest, context: Ctx): Promise<HttpResponseInit> {
  let p: Record<string, string>;
  try {
    p = await readParams(request);
  } catch {
    return oauthError('invalid_request', 'Malformed request body.');
  }

  try {
    if (p.resource !== undefined && p.resource !== mcpResourceUrl()) return oauthError('invalid_target', 'Unknown resource.');
    if (p.grant_type === 'authorization_code') {
      const code = str(p.code);
      const clientId = str(p.client_id);
      const redirectUri = str(p.redirect_uri);
      if (!code || !clientId || !redirectUri || !str(p.code_verifier)) return oauthError('invalid_request', 'Missing parameter.');
      const c = await verifyToken(code, 'code');
      if (!c || c.cid !== clientId || c.ru !== redirectUri || typeof c.cc !== 'string' || typeof c.sub !== 'string' || typeof c.jti !== 'string') {
        return oauthError('invalid_grant');
      }
      if (!verifyPkce(p.code_verifier, c.cc)) return oauthError('invalid_grant', 'PKCE verification failed.');
      if (!(await consumeOnce('codes', c.jti))) return oauthError('invalid_grant', 'Authorization code already used.');
      return json(200, await issueTokenPair(c.sub, clientId), NO_STORE);
    }

    if (p.grant_type === 'refresh_token') {
      const refresh = str(p.refresh_token);
      const clientId = str(p.client_id);
      if (!refresh || !clientId) return oauthError('invalid_request', 'Missing parameter.');
      const r = await verifyToken(refresh, 'refresh');
      if (!r || r.cid !== clientId || typeof r.sub !== 'string' || typeof r.jti !== 'string') return oauthError('invalid_grant');
      if (!(await consumeOnce('refresh', r.jti))) return oauthError('invalid_grant', 'Refresh token already used.');
      return json(200, await issueTokenPair(r.sub, clientId), NO_STORE);
    }

    return oauthError('unsupported_grant_type');
  } catch (error) {
    return serverError(context, 'token', error);
  }
}
