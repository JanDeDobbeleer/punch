import { createHash, timingSafeEqual } from 'node:crypto';

export function s256Challenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export function verifyPkce(verifier: unknown, challenge: string): boolean {
  if (typeof verifier !== 'string' || verifier.length < 43 || verifier.length > 128) return false;
  if (!/^[A-Za-z0-9\-._~]+$/.test(verifier)) return false;
  const a = Buffer.from(s256Challenge(verifier));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}
