# Punch MCP server

Punch exposes a remote [MCP](https://modelcontextprotocol.io) server at
`https://<function-app-host>/api/mcp`, so you can add it to claude.ai or the
Claude Desktop app as a custom connector. Through it, Claude can read your
customers, projects, services, entries and earnings, and can log, update or
delete time entries.

## How auth works

The MCP and OAuth endpoints run on a **separate Azure Functions Flex Consumption
app**, not on the SWA's managed Functions. The reason: Static Web Apps replaces
the incoming `Authorization: Bearer …` header on requests to managed Functions
with its own token, so claude.ai's bearer token never reaches `/api/mcp`. The
same `api/` package is deployed to both hosts and the app setting
`PUNCH_FUNCTIONS_ROLE` picks what each registers (`src/role.ts`):

- SWA managed Functions (role unset): `state`, `attachments`, `mcp-arm`.
- Flex app (`PUNCH_FUNCTIONS_ROLE=mcp`): `mcp`, `oauth/*`, and the root
  `/.well-known/*` discovery routes. `requireOwner()` always denies there, since
  a public Function App can't trust an `x-ms-client-principal` header.

Its `host.json` is deployed with `extensions.http.routePrefix` set to `""`
(`api/deploy/prepare-mcp-host.mjs`), so function routes carry an explicit
`api/` prefix and the well-known routes sit at the root. Public URLs are
`https://<function-app-host>/api/mcp`, `/api/oauth/...` and `/.well-known/...`.

MCP clients don't use the SWA cookie session. They follow the MCP authorization
spec (OAuth 2.1 with PKCE and Dynamic Client Registration). Punch runs a small
authorization server of its own in `api/src/functions/oauth.ts`:

1. The client calls `/api/mcp` without a token and gets back
   `401 WWW-Authenticate: Bearer resource_metadata=…`.
2. The client discovers `/.well-known/oauth-protected-resource` and
   `/.well-known/oauth-authorization-server`, served from the Function App root
   (path-suffixed variants work too).
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

`/api/mcp` and `/api/oauth/*` are public on the Function App because they do
their own auth. `POST /api/mcp-arm` stays on the SWA behind the `owner` role and
writes the `armed` marker to the shared `mcp-auth` container, which the Function
App reads. Both hosts must use the same storage account.

## One-time setup

1. Create a **GitHub OAuth App** (GitHub → Settings → Developer settings → OAuth
   Apps). It must be separate from the one SWA's built-in auth uses.
   - Homepage URL: `https://<function-app-host>`
   - Authorization callback URL: `https://<function-app-host>/api/oauth/github/callback`
2. Find your numeric GitHub user id:

   ```bash
   gh api user --jq .id
   ```

3. Provision the Function App (see below), then set these app settings on it:
   `PUNCH_FUNCTIONS_ROLE=mcp`, `PUNCH_MCP_BASE_URL=https://<function-app-host>`
   (the Function App origin), `PUNCH_MCP_JWT_SECRET=<48+ random chars>`,
   `PUNCH_MCP_GITHUB_CLIENT_ID`, `PUNCH_MCP_GITHUB_CLIENT_SECRET`,
   `PUNCH_MCP_ALLOWED_GITHUB_USER_ID=<numeric id>` and `PUNCH_HOURS_PER_DAY=8`.
   Storage uses managed identity: set `STORAGE_ACCOUNT_URL` and give the Function
   App's identity **Storage Blob Data Contributor** on the storage account.

   To generate the JWT secret, run `openssl rand -base64 48`. In PowerShell,
   which has no `openssl`, use
   `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))`
   and quote each `NAME=value` argument, since the secret can contain `+`,
   `/` and `=`.
4. In Punch, open Settings → Connect MCP. This arms the server for 5 minutes.
5. Within those 5 minutes, on claude.ai go to Settings → Connectors → Add
   custom connector (or reconnect the existing one) and enter URL
   `https://<function-app-host>/api/mcp`. Approve on the Punch consent page,
   then sign in with GitHub. To connect again later (for example after
   rotating the secret), arm again first.

Leave `PUNCH_MCP_ALLOW_LOCALHOST_REDIRECT` unset in production. It only exists
for local development.

## Function App provisioning

The MCP host is the Flex Consumption app `punch-mcp`
(`https://punch-mcp.azurewebsites.net`) in `rg-tempo`. It was created like this
(Git Bash; `MSYS_NO_PATHCONV=1` stops Git Bash from rewriting `/subscriptions/...`
into a Windows path):

```bash
az functionapp create --resource-group rg-tempo --name punch-mcp --storage-account tempoappstorage --runtime node --runtime-version 22 --flexconsumption-location westeurope --deployment-storage-auth-type SystemAssignedIdentity
```

Grant the app's managed identity blob access to the shared storage account:

```bash
MSYS_NO_PATHCONV=1 az role assignment create --assignee-object-id "$(az functionapp identity show -g rg-tempo -n punch-mcp --query principalId -o tsv)" --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope "$(az storage account list --query "[?name=='tempoappstorage'].id | [0]" -o tsv)"
```

App settings. Storage uses the managed identity (`STORAGE_ACCOUNT_URL`), so no
storage key is stored on this app:

```bash
az functionapp config appsettings set -g rg-tempo -n punch-mcp --settings PUNCH_FUNCTIONS_ROLE=mcp STORAGE_ACCOUNT_URL=https://tempoappstorage.blob.core.windows.net STATE_CONTAINER=state ATTACHMENTS_CONTAINER=attachments PUNCH_MCP_BASE_URL=https://punch-mcp.azurewebsites.net PUNCH_MCP_ALLOWED_GITHUB_USER_ID=<numeric id> PUNCH_HOURS_PER_DAY=8 "PUNCH_MCP_JWT_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64'))")"
```

Then set `PUNCH_MCP_GITHUB_CLIENT_ID` and `PUNCH_MCP_GITHUB_CLIENT_SECRET` the
same way. The GitHub OAuth App's callback URL must be
`https://punch-mcp.azurewebsites.net/api/oauth/github/callback`.

### Deploying

The package is the built `api/` folder with production dependencies and a
`host.json` whose `routePrefix` is `""`. Build it in a scratch folder so the
repo's `host.json` (used by the SWA) keeps the `api` prefix:

```bash
cd api && npm run build
```

```bash
rm -rf ../.mcp-pkg && mkdir ../.mcp-pkg && cp -r dist package.json package-lock.json host.json ../.mcp-pkg/ && (cd ../.mcp-pkg && npm ci --omit=dev --ignore-scripts) && node deploy/prepare-mcp-host.mjs ../.mcp-pkg/host.json
```

On Windows, zip with the built-in `tar.exe` (it writes the forward-slash paths
Linux needs), then deploy:

```bash
cd ../.mcp-pkg && /c/Windows/System32/tar.exe -a -c -f ../mcp-pkg.zip * && cd .. && az functionapp deployment source config-zip -g rg-tempo -n punch-mcp --src mcp-pkg.zip
```

Flex Consumption has no deployment slots, so there is one MCP host. PR preview
environments of the SWA still arm connections (same storage account), but the
connector always talks to `punch-mcp`.

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

Locally, run the API in the MCP role so MCP and OAuth routes register: set
`PUNCH_FUNCTIONS_ROLE=mcp` in `api/local.settings.json` and clear the route
prefix in a scratch copy of `host.json` (`node deploy/prepare-mcp-host.mjs`).
The SWA-only routes (state, attachments, mcp-arm) are not registered in that
role, so arm by writing the `armed` marker or by running a second instance
without the role. The older SWA CLI flow below no longer serves `.well-known`:

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
