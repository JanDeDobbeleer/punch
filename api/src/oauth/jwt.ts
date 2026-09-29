// Small typed wrappers around jose for the stateless OAuth tokens (HS256 only).

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { getBaseUrl, getJwtSecret } from './config.js';

export type TokenType = 'client' | 'ghstate' | 'code' | 'access' | 'refresh' | 'consent';

export interface SignOptions {
  ttlSeconds?: number; // omit for no expiry
  audience?: string;
  subject?: string;
}

export async function signToken(typ: TokenType, claims: Record<string, unknown>, opts: SignOptions = {}): Promise<string> {
  let jwt = new SignJWT({ ...claims, typ })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(getBaseUrl())
    .setIssuedAt();
  if (opts.ttlSeconds !== undefined) jwt = jwt.setExpirationTime(Math.floor(Date.now() / 1000) + opts.ttlSeconds);
  if (opts.audience) jwt = jwt.setAudience(opts.audience);
  if (opts.subject) jwt = jwt.setSubject(opts.subject);
  return jwt.sign(getJwtSecret());
}

/** Returns the payload, or null when signature/iss/exp/typ (or audience when given) do not check out. */
export async function verifyToken(token: string, typ: TokenType, audience?: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: getBaseUrl(),
      ...(audience ? { audience } : {}),
    });
    return payload.typ === typ ? payload : null;
  } catch {
    return null;
  }
}
