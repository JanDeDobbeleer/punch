import type { AttachmentRef, Entry, PersistedData } from '../types';

const STORAGE_KEY = 'state.v1';
const DEMO_STORAGE_KEY = 'demo.v1';
const DEMO_MODE_KEY = 'demoMode';

// Legacy keys kept for migration – reads fall back to these if the new keys
// have no data yet. Writes always use the new keys above.
// Remove these (and the fallback calls below) once all sessions have migrated.
const LEGACY_STORAGE_KEY = 'tempo.v1';
const LEGACY_DEMO_STORAGE_KEY = 'tempo.demo.v1';
const LEGACY_DEMO_MODE_KEY = 'tempo.demoMode';

function isPersistedData(value: unknown): value is PersistedData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PersistedData>;
  return Array.isArray(candidate.customers)
    && Array.isArray(candidate.projects)
    && (candidate.services === undefined || Array.isArray(candidate.services))
    && Array.isArray(candidate.entries);
}

function normalizeEntry(entry: Entry): Entry {
  // Entries persisted before the duration-logging rework only had clock-time
  // `start`/`end` (minutes-from-midnight) and no `minutes` field. Derive it
  // here so stale local caches (and the production blob, until its one-time
  // migration script runs) don't produce NaN totals.
  const legacy = entry as Entry & { start?: number; end?: number };
  const minutes = typeof entry.minutes === 'number'
    ? entry.minutes
    : (typeof legacy.start === 'number' && typeof legacy.end === 'number' ? legacy.end - legacy.start : 0);

  const normalized: Entry & { start?: number; end?: number } = {
    ...entry,
    kind: entry.kind ?? 'project',
    projectId: entry.projectId ?? null,
    serviceId: entry.serviceId ?? null,
    customerId: entry.customerId ?? null,
    amount: entry.amount ?? null,
    minutes,
  };
  delete normalized.start;
  delete normalized.end;
  return normalized;
}

function normalizePersistedData(data: PersistedData): PersistedData {
  return {
    customers: data.customers,
    projects: data.projects,
    services: data.services ?? [],
    entries: data.entries.map((entry) => normalizeEntry(entry)),
  };
}

// ─── local cache (localStorage) ──────────────────────────────────────────
// Used as an offline-first cache: reads happen instantly on load, writes
// happen on every change. The Azure Functions API (see below) is the source
// of truth once the app is online and authenticated.

export function loadData(): PersistedData | null {
  return loadPersistedData(STORAGE_KEY) ?? loadPersistedData(LEGACY_STORAGE_KEY);
}

export function saveData(data: PersistedData): void {
  savePersistedData(STORAGE_KEY, data);
}

export function clearData(): void {
  clearPersistedData(STORAGE_KEY);
  clearPersistedData(LEGACY_STORAGE_KEY);
}

export function loadDemoData(): PersistedData | null {
  return loadPersistedData(DEMO_STORAGE_KEY) ?? loadPersistedData(LEGACY_DEMO_STORAGE_KEY);
}

export function saveDemoData(data: PersistedData): void {
  savePersistedData(DEMO_STORAGE_KEY, data);
}

export function clearDemoData(): void {
  clearPersistedData(DEMO_STORAGE_KEY);
  clearPersistedData(LEGACY_DEMO_STORAGE_KEY);
}

export function getDemoModeFlag(): boolean {
  try {
    return window.localStorage.getItem(DEMO_MODE_KEY) === '1'
      || window.localStorage.getItem(LEGACY_DEMO_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDemoModeFlag(enabled: boolean): void {
  try {
    if (enabled) {
      window.localStorage.setItem(DEMO_MODE_KEY, '1');
    } else {
      window.localStorage.removeItem(DEMO_MODE_KEY);
    }
    // Always clear the legacy key so it doesn't linger after migration.
    window.localStorage.removeItem(LEGACY_DEMO_MODE_KEY);
  } catch {
    // Ignore storage failures to match the legacy runtime behavior.
  }
}

function loadPersistedData(key: string): PersistedData | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return isPersistedData(parsed) ? normalizePersistedData(parsed) : null;
  } catch {
    return null;
  }
}

function savePersistedData(key: string, data: PersistedData): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({
      customers: data.customers,
      projects: data.projects,
      services: data.services,
      entries: data.entries,
    }));
  } catch {
    // Ignore storage failures to match the legacy runtime behavior.
  }
}

function clearPersistedData(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures to match the legacy runtime behavior.
  }
}

// ─── remote sync (Azure Functions API) ───────────────────────────────────
// The whole PersistedData document is stored as one JSON blob behind
// GET/PUT /api/state. Optimistic concurrency is handled via ETag/If-Match:
// a 412 response means someone else (another tab/device) saved in between,
// so ConflictError is thrown and the caller should reload before retrying.

export class ConflictError extends Error {
  constructor() {
    super('State changed since it was last loaded. Reload before saving again.');
    this.name = 'ConflictError';
  }
}

export interface RemoteState {
  data: PersistedData;
  etag: string;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'message' in body) {
      return String((body as { message?: unknown }).message);
    }
  } catch {
    // Ignore parse failures below.
  }
  return `Request failed with status ${response.status}`;
}

export async function fetchState(): Promise<RemoteState> {
  const response = await fetch('/api/state', { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const etag = response.headers.get('etag') ?? '';
  const parsed: unknown = await response.json();
  if (!isPersistedData(parsed)) {
    throw new Error('Invalid data format returned from server.');
  }

  return { data: normalizePersistedData(parsed), etag };
}

export interface YearState {
  entries: Entry[];
  etag: string;
}

export async function fetchEntriesYear(year: number): Promise<YearState> {
  const response = await fetch(`/api/state?year=${year}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const etag = response.headers.get('etag') ?? '';
  const parsed: unknown = await response.json();
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { entries?: unknown }).entries)) {
    throw new Error(`Invalid year entries format returned from server for year ${year}.`);
  }
  const entries = ((parsed as { entries: unknown[] }).entries).map((e) => normalizeEntry(e as Entry));
  return { entries, etag };
}

export async function saveEntriesYear(year: number, entries: Entry[], etag: string): Promise<{ etag: string }> {
  const response = await fetch(`/api/state?year=${year}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(etag ? { 'If-Match': etag } : {}),
    },
    body: JSON.stringify({ entries }),
  });

  if (response.status === 412) {
    throw new ConflictError();
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return { etag: response.headers.get('etag') ?? '' };
}

export async function saveState(data: PersistedData, etag: string): Promise<{ etag: string }> {
  const response = await fetch('/api/state', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(etag ? { 'If-Match': etag } : {}),
    },
    body: JSON.stringify({
      customers: data.customers,
      projects: data.projects,
      services: data.services,
      entries: data.entries,
    }),
  });

  if (response.status === 412) {
    throw new ConflictError();
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return { etag: response.headers.get('etag') ?? '' };
}

// ─── attachments (Azure Blob Storage via SAS) ────────────────────────────

interface AttachmentUploadTicket {
  attachmentId: string;
  blobPath: string;
  uploadUrl: string;
  expiresOn: string;
  fileName: string;
  contentType: string;
}

export async function uploadAttachment(entryId: string, file: File): Promise<AttachmentRef> {
  const ticketResponse = await fetch('/api/attachments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryId, fileName: file.name, contentType: file.type || 'application/octet-stream' }),
  });

  if (!ticketResponse.ok) {
    throw new Error(await parseErrorMessage(ticketResponse));
  }

  const ticket = (await ticketResponse.json()) as AttachmentUploadTicket;

  const uploadResponse = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': ticket.contentType,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload attachment to storage.');
  }

  return {
    id: ticket.attachmentId,
    fileName: ticket.fileName,
    contentType: ticket.contentType,
    size: file.size,
  };
}

export async function getAttachmentDownloadUrl(entryId: string, attachmentId: string): Promise<string> {
  const response = await fetch(`/api/attachments/${entryId}/${attachmentId}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const body = (await response.json()) as { downloadUrl: string };
  return body.downloadUrl;
}

export async function deleteAttachment(entryId: string, attachmentId: string): Promise<void> {
  const response = await fetch(`/api/attachments/${entryId}/${attachmentId}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) {
    throw new Error(await parseErrorMessage(response));
  }
}
