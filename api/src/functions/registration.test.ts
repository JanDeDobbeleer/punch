// Which functions get registered per PUNCH_FUNCTIONS_ROLE.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const registered = new Map<string, string>();

vi.mock('@azure/functions', async (importActual) => {
  const actual = await importActual<typeof import('@azure/functions')>();
  return { ...actual, app: { http: (name: string, opts: { route: string }) => registered.set(name, opts.route) } };
});

async function load(role?: string): Promise<Map<string, string>> {
  registered.clear();
  vi.resetModules();
  if (role) vi.stubEnv('PUNCH_FUNCTIONS_ROLE', role);
  await import('./state.js');
  await import('./attachments.js');
  await import('./mcpArm.js');
  await import('./mcp.js');
  await import('./oauth.js');
  return new Map(registered);
}

beforeEach(() => {
  vi.stubEnv('PUNCH_MCP_BASE_URL', 'https://punch.example.com');
  vi.stubEnv('PUNCH_MCP_JWT_SECRET', 'x'.repeat(40));
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('registration gating', () => {
  test('swa role registers only state, attachments and mcpArm', async () => {
    const fns = await load();
    expect([...fns.keys()].sort()).toEqual([
      'createAttachmentUploadUrl',
      'deleteAttachment',
      'getAttachmentDownloadUrl',
      'getState',
      'mcpArm',
      'putState',
    ]);
  });

  test('mcp role registers only mcp, oauth and well-known routes', async () => {
    const fns = await load('mcp');
    const names = [...fns.keys()];
    for (const banned of ['getState', 'putState', 'mcpArm', 'createAttachmentUploadUrl', 'getAttachmentDownloadUrl', 'deleteAttachment']) {
      expect(names).not.toContain(banned);
    }
    expect(fns.get('mcp')).toBe('api/mcp');
    expect(fns.get('oauthToken')).toBe('api/oauth/token');
    expect(fns.get('wellKnownProtectedResource')).toBe('.well-known/oauth-protected-resource');
    expect(fns.get('wellKnownAuthorizationServer')).toBe('.well-known/oauth-authorization-server');
    expect(fns.get('wellKnownAuthorizationServerSuffixed')).toBe('.well-known/oauth-authorization-server/{*rest}');
    expect(names.every((n) => n === 'mcp' || n.startsWith('oauth') || n.startsWith('wellKnown'))).toBe(true);
  });
});
