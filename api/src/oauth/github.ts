// GitHub identity delegation. Kept tiny so tests can mock it. The GitHub token is never stored or logged.

import { getGithubClient } from './config.js';

export async function fetchGithubUserId(code: string, redirectUri: string): Promise<string> {
  const { clientId, clientSecret } = getGithubClient();
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'punch-mcp' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  if (!tokenRes.ok) throw new Error(`GitHub token exchange failed (${tokenRes.status}).`);
  const tokenBody = (await tokenRes.json()) as { access_token?: string };
  if (!tokenBody.access_token) throw new Error('GitHub token exchange returned no access token.');

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenBody.access_token}`,
      'User-Agent': 'punch-mcp',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!userRes.ok) throw new Error(`GitHub user lookup failed (${userRes.status}).`);
  const user = (await userRes.json()) as { id?: number | string };
  if (user.id === undefined || user.id === null) throw new Error('GitHub user response had no id.');
  return String(user.id);
}
