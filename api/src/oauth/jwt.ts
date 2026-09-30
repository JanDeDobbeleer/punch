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

// Non-secret reason a token was rejected; safe to return in an RFC 6750 error_description.
export type RejectReason = 'malformed' | 'signature' | 'expired' | 'issuer' | 'audience' | 'type' | 'subject' | 'config' | 'invalid';

export type VerifyResult = { payload: JWTPayload } | { reason: RejectReason };

function rejectReason(error: unknown): RejectReason {
  const { code, claim, name } = (error ?? {}) as { code?: string; claim?: string; name?: string };
  if (name === 'ConfigError') return 'config';
  if (code === 'ERR_JWT_EXPIRED') return 'expired';
  if (code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') return 'signature';
  if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') return claim === 'iss' ? 'issuer' : claim === 'aud' ? 'audience' : 'invalid';
  if (code === 'ERR_JWS_INVALID' || code === 'ERR_JWT_INVALID' || code === 'ERR_JOSE_ALG_NOT_ALLOWED') return 'malformed';
  return 'invalid';
}

/** Like verifyToken, but says why a token was rejected. */
export async function verifyTokenDetailed(token: string, typ: TokenType, audience?: string): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: getBaseUrl(),
      ...(audience ? { audience } : {}),
    });
    return payload.typ === typ ? { payload } : { reason: 'type' };
  } catch (error) {
    return { reason: rejectReason(error) };
  }
}

/** Returns the payload, or null when signature/iss/exp/typ (or audience when given) do not check out. */
export async function verifyToken(token: string, typ: TokenType, audience?: string): Promise<JWTPayload | null> {
  const result = await verifyTokenDetailed(token, typ, audience);
  return 'payload' in result ? result.payload : null;
}
