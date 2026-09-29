// Redirect URI allowlist for dynamic client registration.

const EXACT = new Set([
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
]);

export function isAllowedRedirectUri(uri: unknown): boolean {
  if (typeof uri !== 'string' || uri.length === 0 || uri.length > 2048) return false;
  if (EXACT.has(uri)) return true;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:') return false;
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return false;
  if (url.username || url.password || url.hash) return false;
  return true;
}
