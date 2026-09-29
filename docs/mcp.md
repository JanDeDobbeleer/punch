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
   the claude.ai/claude.com callbacks, plus localhost for development.
4. `/api/oauth/authorize` first shows a Punch **consent page** naming the
   client and redirect URI. It exists because GitHub silently re-approves an
   app you've already authorized, so without it anyone who added your URL as
   their own claude.ai connector could get your token with one click from you
   (the confused-deputy attack). Only approve when you started the connection
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

   To generate the JWT secret, run `openssl rand -base64 48`.
4. On claude.ai, go to Settings → Connectors → Add custom connector and enter
   URL `https://<your-custom-domain>/api/mcp`.

## Kill switch

To revoke every client and token at once, rotate `PUNCH_MCP_JWT_SECRET`. All
issued JWTs become invalid immediately.

## Local development

`func start` alone doesn't apply the `.well-known` rewrites in
`staticwebapp.config.json`. Run the API behind the SWA CLI so discovery works:

```bash
npx @azure/static-web-apps-cli start http://localhost:5173 --api-location api
```

Next, set `PUNCH_MCP_BASE_URL=http://localhost:4280` in
`api/local.settings.json`. In the GitHub OAuth App, add
`http://localhost:4280/api/oauth/github/callback` as the callback, or create a
separate dev app for it. Then run
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
