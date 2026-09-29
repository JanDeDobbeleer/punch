// OAuth 2.1 authorization server for the MCP connector (see src/oauth/handlers.ts).
// Routes are anonymous at the SWA layer; access is enforced by the GitHub identity check.

import { app } from '@azure/functions';
import { authorize, authorizePost, githubCallback, metadata, preflight, protectedResource, register, token } from '../oauth/handlers.js';

app.http('oauthProtectedResource', { methods: ['GET'], authLevel: 'anonymous', route: 'oauth/protected-resource', handler: protectedResource });
app.http('oauthMetadata', { methods: ['GET'], authLevel: 'anonymous', route: 'oauth/metadata', handler: metadata });
app.http('oauthRegister', { methods: ['POST'], authLevel: 'anonymous', route: 'oauth/register', handler: (req, ctx) => register(req, ctx) });
app.http('oauthAuthorize', { methods: ['GET'], authLevel: 'anonymous', route: 'oauth/authorize', handler: (req, ctx) => authorize(req, ctx) });
app.http('oauthAuthorizePost', { methods: ['POST'], authLevel: 'anonymous', route: 'oauth/authorize', handler: (req, ctx) => authorizePost(req, ctx) });
app.http('oauthGithubCallback', { methods: ['GET'], authLevel: 'anonymous', route: 'oauth/github/callback', handler: (req, ctx) => githubCallback(req, ctx) });
app.http('oauthToken', { methods: ['POST'], authLevel: 'anonymous', route: 'oauth/token', handler: (req, ctx) => token(req, ctx) });
app.http('oauthPreflightRegister', { methods: ['OPTIONS'], authLevel: 'anonymous', route: 'oauth/register', handler: preflight });
app.http('oauthPreflightToken', { methods: ['OPTIONS'], authLevel: 'anonymous', route: 'oauth/token', handler: preflight });
app.http('oauthPreflightMetadata', { methods: ['OPTIONS'], authLevel: 'anonymous', route: 'oauth/metadata', handler: preflight });
app.http('oauthPreflightProtectedResource', { methods: ['OPTIONS'], authLevel: 'anonymous', route: 'oauth/protected-resource', handler: preflight });
