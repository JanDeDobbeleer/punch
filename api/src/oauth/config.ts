// Lazy env access + shared URL/CORS helpers for the OAuth authorization server.
// All getters throw ConfigError when misconfigured so callers fail closed.

export class ConfigError extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ConfigError(`Missing required environment variable ${name}.`);
  }
  return value;
}

export function getBaseUrl(): string {
  return requireEnv('PUNCH_MCP_BASE_URL').replace(/\/+$/, '');
}

export function getJwtSecret(): Uint8Array {
  const secret = requireEnv('PUNCH_MCP_JWT_SECRET');
  if (secret.length < 32) {
    throw new ConfigError('PUNCH_MCP_JWT_SECRET must be at least 32 characters.');
  }
  if (secret.startsWith('CHANGE-ME') || secret.startsWith('replace-with')) {
    throw new ConfigError('PUNCH_MCP_JWT_SECRET is still the placeholder value; generate a real secret.');
  }
  return new TextEncoder().encode(secret);
}

export function getGithubClient(): { clientId: string; clientSecret: string } {
  return {
    clientId: requireEnv('PUNCH_MCP_GITHUB_CLIENT_ID'),
    clientSecret: requireEnv('PUNCH_MCP_GITHUB_CLIENT_SECRET'),
  };
}

export function getAllowedGithubUserId(): string {
  return requireEnv('PUNCH_MCP_ALLOWED_GITHUB_USER_ID').trim();
}

export function mcpResourceUrl(): string {
  return `${getBaseUrl()}/api/mcp`;
}

export function resourceMetadataUrl(): string {
  return `${getBaseUrl()}/.well-known/oauth-protected-resource`;
}

export function wwwAuthenticateHeader(error?: string, description?: string): string {
  const base = `Bearer resource_metadata="${resourceMetadataUrl()}"`;
  if (!error) return base;
  return description ? `${base}, error="${error}", error_description="${description}"` : `${base}, error="${error}"`;
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id',
    'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  };
}

export function localhostRedirectsAllowed(): boolean {
  return process.env.PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT === '1';
}
