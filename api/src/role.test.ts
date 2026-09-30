import { afterEach, describe, expect, test, vi } from 'vitest';
import { requireOwner } from './auth.js';
import { functionsRole, isMcpHost, route } from './role.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

const ownerRequest = () => {
  const principal = Buffer.from(JSON.stringify({ identityProvider: 'github', userId: '1', userDetails: 'me', userRoles: ['owner'] })).toString('base64');
  return { headers: new Headers({ 'x-ms-client-principal': principal }) } as never;
};

describe('role', () => {
  test('parses PUNCH_FUNCTIONS_ROLE', () => {
    expect(functionsRole()).toBe('swa');
    vi.stubEnv('PUNCH_FUNCTIONS_ROLE', 'mcp');
    expect(functionsRole()).toBe('mcp');
    expect(isMcpHost()).toBe(true);
    vi.stubEnv('PUNCH_FUNCTIONS_ROLE', 'whatever');
    expect(functionsRole()).toBe('swa');
    expect(isMcpHost()).toBe(false);
  });

  test('route() adds the api/ prefix only on the MCP host', () => {
    expect(route('mcp')).toBe('mcp');
    vi.stubEnv('PUNCH_FUNCTIONS_ROLE', 'mcp');
    expect(route('mcp')).toBe('api/mcp');
    expect(route('oauth/token')).toBe('api/oauth/token');
  });
});

describe('requireOwner', () => {
  test('accepts an owner principal on the SWA host', () => {
    expect(requireOwner(ownerRequest())).not.toBeNull();
  });

  test('denies even a valid owner principal on the MCP host', () => {
    vi.stubEnv('PUNCH_FUNCTIONS_ROLE', 'mcp');
    expect(requireOwner(ownerRequest())).toBeNull();
  });

  test('PUNCH_SKIP_AUTH_CHECK is ineffective on the MCP host', () => {
    vi.stubEnv('PUNCH_SKIP_AUTH_CHECK', '1');
    expect(requireOwner({ headers: new Headers() } as never)).not.toBeNull();
    vi.stubEnv('PUNCH_FUNCTIONS_ROLE', 'mcp');
    expect(requireOwner({ headers: new Headers() } as never)).toBeNull();
  });
});
