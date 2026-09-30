// OAuth 2.1 authorization server for the MCP connector (see src/oauth/handlers.ts).
// Access is enforced by the arming step plus the GitHub identity check.
import { app } from '@azure/functions';
import { authorize, authorizePost, githubCallback, metadata, preflight, protectedResource, register, token } from '../oauth/handlers.js';
import { isMcpHost, route } from '../role.js';

// OAuth authorization server for MCP clients. Only registered on the MCP host
// (separate Flex Consumption app); the SWA-managed Functions never expose it.
if (isMcpHost()) {
  const get = (name: string, path: string, handler: Parameters<typeof app.http>[1]['handler']) =>
    app.http(name, { methods: ['GET'], authLevel: 'anonymous', route: path, handler });
  const options = (name: string, path: string) =>
    app.http(name, { methods: ['OPTIONS'], authLevel: 'anonymous', route: path, handler: preflight });

  get('oauthProtectedResource', route('oauth/protected-resource'), protectedResource);
  get('oauthMetadata', route('oauth/metadata'), metadata);
  app.http('oauthRegister', { methods: ['POST'], authLevel: 'anonymous', route: route('oauth/register'), handler: (req, ctx) => register(req, ctx) });
  get('oauthAuthorize', route('oauth/authorize'), (req, ctx) => authorize(req, ctx));
  app.http('oauthAuthorizePost', { methods: ['POST'], authLevel: 'anonymous', route: route('oauth/authorize'), handler: (req, ctx) => authorizePost(req, ctx) });
  get('oauthGithubCallback', route('oauth/github/callback'), (req, ctx) => githubCallback(req, ctx));
  app.http('oauthToken', { methods: ['POST'], authLevel: 'anonymous', route: route('oauth/token'), handler: (req, ctx) => token(req, ctx) });
  options('oauthPreflightRegister', route('oauth/register'));
  options('oauthPreflightToken', route('oauth/token'));
  options('oauthPreflightMetadata', route('oauth/metadata'));
  options('oauthPreflightProtectedResource', route('oauth/protected-resource'));

  // Root-level discovery documents (routePrefix is "" on the MCP host).
  get('wellKnownProtectedResource', '.well-known/oauth-protected-resource', protectedResource);
  get('wellKnownProtectedResourceSuffixed', '.well-known/oauth-protected-resource/{*rest}', protectedResource);
  get('wellKnownAuthorizationServer', '.well-known/oauth-authorization-server', metadata);
  get('wellKnownAuthorizationServerSuffixed', '.well-known/oauth-authorization-server/{*rest}', metadata);
  options('wellKnownPreflightProtectedResource', '.well-known/oauth-protected-resource');
  options('wellKnownPreflightProtectedResourceSuffixed', '.well-known/oauth-protected-resource/{*rest}');
  options('wellKnownPreflightAuthorizationServer', '.well-known/oauth-authorization-server');
  options('wellKnownPreflightAuthorizationServerSuffixed', '.well-known/oauth-authorization-server/{*rest}');
}
