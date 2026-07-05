// Reads the client principal that Azure Static Web Apps injects into every
// request that reaches a managed Function (see user-information docs). This
// gives us defense-in-depth: even though staticwebapp.config.json already
// restricts these routes to the "owner" role, we double-check here in case a
// Function is ever invoked directly (e.g. local dev without the SWA proxy).

import type { HttpRequest } from '@azure/functions';

export interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
}

export function getClientPrincipal(request: HttpRequest): ClientPrincipal | null {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) {
    return null;
  }

  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(decoded) as ClientPrincipal;
  } catch {
    return null;
  }
}

const REQUIRED_ROLE = 'owner';

// In local development there is no SWA auth proxy in front of the Function,
// so we allow requests through when explicitly opted in via app settings.
const skipAuthCheck = (process.env.SKIP_AUTH_CHECK ?? process.env.PUNCH_SKIP_AUTH_CHECK) === '1';

export function requireOwner(request: HttpRequest): ClientPrincipal | null {
  if (skipAuthCheck) {
    return { identityProvider: 'local', userId: 'local-dev', userDetails: 'local-dev', userRoles: ['owner'] };
  }

  const principal = getClientPrincipal(request);
  if (!principal || !principal.userRoles.includes(REQUIRED_ROLE)) {
    return null;
  }
  return principal;
}
