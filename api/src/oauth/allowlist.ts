// Redirect URI allowlist for dynamic client registration.

const EXACT = new Set([
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
]);

// Localhost/127.0.0.1 redirects (dev, MCP Inspector) are only allowed when
// PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT=1.
export function isAllowedRedirectUri(uri: unknown, allowLocalhost: boolean = process.env.PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT === '1'): boolean {
  if (typeof uri !== 'string' || uri.length === 0 || uri.length > 2048) return false;
  if (EXACT.has(uri)) return true;
  if (!allowLocalhost) return false;
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
