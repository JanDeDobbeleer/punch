# Punch MCP server

Punch exposes a remote [MCP](https://modelcontextprotocol.io) server at
`https://<your-custom-domain>/api/mcp`, so you can add it to claude.ai or the
Claude Desktop app as a custom connector. Through it, Claude can read your
customers, projects, services, entries and earnings, and can log, update or
delete time entries.

## How auth works

MCP clients don't use the SWA cookie session. They follow the MCP authorization
spec (OAuth 2.1 with PKCE and Dynamic Client Registration). Punch runs a small
authorization server of its own in `api/src/functions/oauth.ts`:

1. The client calls `/api/mcp` without a token and gets back
   `401 WWW-Authenticate: Bearer resource_metadata=…`.
2. The client discovers `/.well-known/oauth-protected-resource` and
   `/.well-known/oauth-authorization-server`. SWA rewrites both to
   `/api/oauth/*`.
3. The client registers at `/api/oauth/register`. The `client_id` it gets is a
   signed JWT, so nothing is stored. Only allowlisted redirect URIs are accepted:
   the claude.ai/claude.com callbacks. Localhost callbacks are accepted only
   when `PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT=1` (see Local development).
4. `/api/oauth/authorize` only works while Punch is **armed**. You arm it
   from Punch (Settings → Connect MCP), which calls the owner-only
   `POST /api/mcp-arm`. Arming lasts 5 minutes and covers exactly one
   connection: it is cleared as soon as your GitHub identity checks out. When
   it isn't armed, authorize returns a 400 telling you to start from Punch.
   Then it shows a Punch **consent page** naming the client and redirect URI.
   Both steps exist because GitHub silently re-approves an app you've already
   authorized, so without them anyone who added your URL as their own
   claude.ai connector could get your token with one click from you (the
   confused-deputy attack). Only approve when you started the connection
   yourself. On approval, it sends the browser to **GitHub** to sign in. The
   callback compares your numeric GitHub user id with
   `PUNCH_MCP_ALLOWED_GITHUB_USER_ID`. Any other account is denied. The GitHub
   token is used once to read `/user` and is then thrown away.
5. `/api/oauth/token` returns a 1-hour access JWT and a 30-day refresh JWT.
   Auth codes and refresh tokens are single-use, enforced with marker blobs in
   the `mcp-auth` container. Refresh tokens rotate on each use.

`/api/mcp` and `/api/oauth/*` are `anonymous` at the SWA layer because they do
their own auth. Every other `/api/*` route still requires the `owner` role.

## One-time setup

1. Create a **GitHub OAuth App** (GitHub → Settings → Developer settings → OAuth
   Apps). It must be separate from the one SWA's built-in auth uses.
   - Homepage URL: `https://<your-custom-domain>`
   - Authorization callback URL: `https://<your-custom-domain>/api/oauth/github/callback`
2. Find your numeric GitHub user id:

   ```bash
   gh api user --jq .id
   ```

3. Set the app settings. Use your own resource names; for how to set the
   subscription first, see `.github/skills/azure-ops`.

   ```bash
   az staticwebapp appsettings set --name <your-swa-resource> --resource-group <your-resource-group> --setting-names PUNCH_MCP_BASE_URL=https://<your-custom-domain> PUNCH_MCP_JWT_SECRET=<48+ random chars> PUNCH_MCP_GITHUB_CLIENT_ID=<id> PUNCH_MCP_GITHUB_CLIENT_SECRET=<secret> PUNCH_MCP_ALLOWED_GITHUB_USER_ID=<numeric id> PUNCH_HOURS_PER_DAY=8
   ```

   To generate the JWT secret, run `openssl rand -base64 48`. In PowerShell,
   which has no `openssl`, use
   `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))`
   and quote each `NAME=value` argument, since the secret can contain `+`,
   `/` and `=`.
4. In Punch, open Settings → Connect MCP. This arms the server for 5 minutes.
5. Within those 5 minutes, on claude.ai go to Settings → Connectors → Add
   custom connector (or reconnect the existing one) and enter URL
   `https://<your-custom-domain>/api/mcp`. Approve on the Punch consent page,
   then sign in with GitHub. To connect again later (for example after
   rotating the secret), arm again first.

Leave `PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT` unset in production. It only exists
for local development.

## Kill switch

To revoke every client and token at once, rotate `PUNCH_MCP_JWT_SECRET`. All
issued JWTs become invalid immediately. The server refuses secrets that start
with `CHANGE-ME` (the placeholder in `local.settings.json.example`).

## Marker blobs

Single-use markers for auth codes and refresh tokens live in the `mcp-auth`
container (`codes/<id>`, `refresh/<id>`), plus the short-lived `armed` blob.
Markers accumulate at roughly 9,000 tiny (empty) blobs a year with hourly
refreshes. They are intentionally not deleted automatically, because removing a
marker would let its token be replayed. The cost is negligible.

## Local development

`func start` alone doesn't apply the `.well-known` rewrites in
`staticwebapp.config.json`. Run the API behind the SWA CLI so discovery works:

```bash
npx @azure/static-web-apps-cli start http://localhost:5173 --api-location api
```

Next, set `PUNCH_MCP_BASE_URL=http://localhost:4280` in
`api/local.settings.json`. In the GitHub OAuth App, add
`http://localhost:4280/api/oauth/github/callback` as the callback, or create a
separate dev app for it. Set `PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT` to `1` so the
Inspector's `http://localhost:<port>` callback is accepted (the example
settings file does this; never set it in production). Arm the server first with
`POST /api/mcp-arm` while signed in (or set `PUNCH_SKIP_AUTH_CHECK=1` and call it
directly). Then run
`npx @modelcontextprotocol/inspector` and connect it to
`http://localhost:4280/api/mcp`.

## Tools

| Tool | Effect |
|------|--------|
| `list_customers`, `list_projects`, `list_services` | Read |
| `list_entries(from, to, …filters)` | Read. Includes past-year blobs |
| `get_earnings(from, to, groupBy)` | Read. Uses `entryEarnValue()` from `src/lib/earnings.ts` |
| `log_entry`, `update_entry` | Write through ETag / If-Match, retried once on 412 |
| `delete_entry` | Write. Refused when the entry has attachments; delete those in the app |
