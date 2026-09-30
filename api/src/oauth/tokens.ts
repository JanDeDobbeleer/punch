import { randomUUID } from 'node:crypto';
import { getAllowedGithubUserId, mcpResourceUrl } from './config.js';
import { signToken, verifyTokenDetailed, type RejectReason } from './jwt.js';

export const SCOPE = 'punch';
export const ACCESS_TTL = 3600;
export const REFRESH_TTL = 30 * 24 * 3600;
export const CODE_TTL = 60;
export const GHSTATE_TTL = 600;

export interface AccessTokenClaims {
  sub: string;
  clientId: string;
  scopes: string[];
  expiresAt: number; // epoch seconds
}

export type AccessTokenCheck = { claims: AccessTokenClaims } | { reason: RejectReason };

/** Verifies an access token and reports a non-secret rejection reason on failure. */
export async function checkAccessToken(token: string): Promise<AccessTokenCheck> {
  try {
    const result = await verifyTokenDetailed(token, 'access', mcpResourceUrl());
    if ('reason' in result) return result;
    const { sub, exp, cid, scope } = result.payload as { sub?: unknown; exp?: unknown; cid?: unknown; scope?: unknown };
    if (typeof sub !== 'string' || typeof exp !== 'number' || typeof cid !== 'string') return { reason: 'invalid' };
    if (sub !== getAllowedGithubUserId()) return { reason: 'subject' };
    return {
      claims: {
        sub,
        clientId: cid,
        scopes: typeof scope === 'string' ? scope.split(' ').filter(Boolean) : [],
        expiresAt: exp,
      },
    };
  } catch {
    return { reason: 'config' };
  }
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  const result = await checkAccessToken(token);
  return 'claims' in result ? result.claims : null;
}

export interface TokenPair {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export async function issueTokenPair(sub: string, clientId: string): Promise<TokenPair> {
  const access_token = await signToken('access', { cid: clientId, scope: SCOPE }, {
    ttlSeconds: ACCESS_TTL,
    audience: mcpResourceUrl(),
    subject: sub,
  });
  const refresh_token = await signToken('refresh', { cid: clientId, scope: SCOPE, jti: randomUUID() }, {
    ttlSeconds: REFRESH_TTL,
    subject: sub,
  });
  return { access_token, token_type: 'Bearer', expires_in: ACCESS_TTL, refresh_token, scope: SCOPE };
}
