# Tempo — Agent Instructions

Tempo is a personal time-tracking single-page app. This file orients any
coding agent (GitHub Copilot, etc.) working in this repository.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite SPA, hosted as an **Azure Static
  Web App**. Deployed from repo root (`app_location: /`, `output_location:
  dist`) — there is no `react-app/` subfolder, everything lives at repo root.
- **Backend**: Azure Functions (Node/TypeScript, managed Functions integrated
  with the Static Web App) in `api/`, providing the `/api/*` routes.
- **Storage**: a single Azure Storage account (`<your-storage-account>`) with two
  blob containers:
  - `state` — one JSON blob (`state/tempo.json`) holding the entire app state
    (`customers[]`, `projects[]`, `entries[]`). Synced via optimistic
    concurrency using the blob's ETag (`If-Match` header on writes; a 412
    response means someone else wrote first — client refetches and re-applies).
  - `attachments` — files attached to time entries (e.g. receipts),
    addressed as `<entryId>/<attachmentId>`. Upload/download use short-lived
    SAS URLs issued by the Functions API so file bytes never pass through the
    Function itself.
- **Auth**: GitHub sign-in via Azure Static Web Apps built-in auth
  (`/.auth/login/github`). Access is restricted to a single invited identity
  assigned the custom `owner` role (via `az staticwebapp users invite`, not
  via the Standard-plan password-protection feature). `staticwebapp.config.json`
  gates **every** route (`/*` and `/api/*`) behind `allowedRoles: ["owner"]`.
  There is intentionally no multi-tenant/multi-user support.
- **CI/CD**: `.github/workflows/deploy.yml` builds and deploys on every push
  to `main` (and manages PR preview environments) via
  `Azure/static-web-apps-deploy@v1`. It requires the
  `AZURE_STATIC_WEB_APPS_API_TOKEN` repo secret (the SWA deployment token).

This is a **single-user prototype**. Don't add multi-tenant auth, database
migrations, or backwards-compat data migration logic unless explicitly asked
— simplicity is preferred over generality at this stage.

## Repository layout

```
src/                      # Frontend SPA (Vite root)
  types.ts                # Single source of truth for domain + view-model shapes
  hooks/useTempoState.ts  # Core state machine: CRUD, view-model building, sync, attachments
  lib/store.ts            # All backend I/O: fetchState/saveState (ETag sync),
                           #   uploadAttachment/getAttachmentDownloadUrl/deleteAttachment,
                           #   plus localStorage cache helpers. No GitHub/Gist code — removed.
  lib/dates.ts, format.ts, rates.ts
  components/             # Presentational components (Sidebar, Modal, views per page, Settings)
api/                       # Azure Functions API
  src/functions/state.ts       # GET/PUT /api/state (ETag concurrency)
  src/functions/attachments.ts # POST /api/attachments (SAS upload ticket),
                                #   GET/DELETE /api/attachments/{entryId}/{attachmentId}
  src/blobClient.ts        # Shared BlobServiceClient factory (connection string or
                            #   managed identity + DefaultAzureCredential)
  src/auth.ts              # Reads SWA's x-ms-client-principal header; requireOwner() guard
  local.settings.json.example  # Copy to local.settings.json for local `func start`
                                # (never commit local.settings.json — it's gitignored)
staticwebapp.config.json   # Route auth rules (owner-only), SPA fallback, API runtime version
e2e/                       # Playwright end-to-end specs
.github/workflows/deploy.yml  # SWA CI/CD (build + deploy on push to main)
```

## Key conventions

- **Domain types live in `src/types.ts`** — keep it in sync with both
  `useTempoState.ts` (state/business logic) and the presentational components
  that consume the resulting view models. Don't duplicate shape definitions.
- **New entries get their `id` assigned immediately** in `openEntry()` (not at
  save time), so attachments can be uploaded to `{entryId}/...` before the
  entry itself is persisted.
- **Sync conflicts** surface as `ConflictError` thrown from `store.saveState()`
  on an HTTP 412; the hook handles this by refetching remote state rather than
  clobbering it.
- **Attachment blob paths** are `{entryId}/{attachmentId}` — no filename in
  the path. Filename/contentType are stored as blob metadata / in the
  `AttachmentRef` record, not encoded in the path.
- **SAS generation** in `api/src/functions/attachments.ts` uses a shared-key
  credential (`TEMPO_STORAGE_ACCOUNT_NAME` / `TEMPO_STORAGE_ACCOUNT_KEY` app
  settings) because **managed Functions in Azure Static Web Apps do not
  support system-assigned managed identity** — only "bring your own Functions"
  does. Don't try to switch this to `DefaultAzureCredential` without first
  moving off managed Functions.
- **Local API dev**: `api/src/auth.ts` supports a `TEMPO_SKIP_AUTH_CHECK=1`
  env var escape hatch, since there's no SWA auth proxy in front of Functions
  during local `func start` / Azurite testing.
- **Timesheet export** (`src/components/ExportView.tsx`, `src/lib/timesheetExport.ts`)
  generates a branded PDF (styled after the IT depends offering documents —
  logo, near-black/gray palette) and a zip of attachments for a customer or
  project + date range, entirely client-side using `pdf-lib` and `jszip`
  (lazy-loaded via `React.lazy` so they don't bloat the main bundle). Entry
  data comes straight from state already in memory; attachment bytes are
  fetched directly from Blob Storage via the existing SAS download URLs. This
  requires **CORS enabled on the storage account's blob service** (GET/HEAD)
  for the app's origins — see the CORS rule note below.

## Build, lint, and test commands

Run all commands from the **repo root** (no subfolder):

- Frontend type-check: `npx tsc -b`
- Frontend build: `npm run build` (runs `tsc -b && vite build`)
- Frontend lint: `npm run lint` (oxlint)
- Frontend unit tests: `npx vitest run`
- E2E tests: `npm run test:e2e` (Playwright)
- API type-check/build: `cd api && npx tsc -p tsconfig.json`
- API install: `cd api && npm install`

Always run the type-check and relevant test suite after changes before
considering a task done.

## Azure resources (for reference, not to be recreated blindly)

- Subscription: **`<your-subscription>`** (not the default `<your-default-subscription>`
  subscription — run `az account set --subscription <your-subscription>` before touching
  these resources with the CLI).
- Resource group: `<your-resource-group>` (West Europe)
- Storage account: `<your-storage-account>` (Standard_LRS, blob versioning enabled)
  - CORS (blob service): GET/HEAD allowed for `https://<your-custom-domain>`,
    the default `*.azurestaticapps.net` hostname, and `http://localhost:5173`
    (local Vite dev) — required for client-side attachment zip downloads in
    the timesheet export feature. Update this rule if the app's origins
    change (e.g. new custom domain, different local dev port).
- Static Web App: `<your-swa-resource>` (Free tier), custom domain `<your-custom-domain>`
- Containers: `state`, `attachments`

If you need to change app settings, roles, or redeploy infra, prefer
`az staticwebapp` / `az storage` CLI commands over manual portal changes so
the setup stays reproducible and documented.
