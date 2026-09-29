// Shared blob read/write logic for the app state, used by the HTTP state endpoints
// (functions/state.ts) and the MCP endpoint.
//
//   readMainState()        -> state.json, filtered to the current year's entries.
//   readYearEntries(year)  -> state.YYYY.json (past-year archive).
//   writeMainState(...)    -> saves state.json; first archives any past-year entries found in
//                             the existing blob to state.YYYY.json (create-only).
//   writeYearState(...)    -> saves state.YYYY.json.
//
// Concurrency uses blob ETags. Writes throw ConflictError on HTTP 412/409; every other
// error propagates to the caller.

import { RestError } from '@azure/storage-blob';
import { getStateContainerClient, STATE_BLOB_NAME } from './blobClient.js';

export interface PersistedData {
  customers: unknown[];
  projects: unknown[];
  services: unknown[];
  entries: unknown[];
}

export class ConflictError extends Error {}

export function isPersistedData(value: unknown): value is PersistedData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<PersistedData>;
  return Array.isArray(candidate.customers)
    && Array.isArray(candidate.projects)
    && (candidate.services === undefined || Array.isArray(candidate.services))
    && Array.isArray(candidate.entries);
}

export function entryYear(entry: unknown): number {
  if (!entry || typeof entry !== 'object') return 0;
  const date = (entry as { date?: unknown }).date;
  if (typeof date !== 'string') return 0;
  const y = new Date(date).getFullYear();
  return Number.isFinite(y) ? y : 0;
}

function yearBlobName(year: number): string {
  return `state.${year}.json`;
}

function emptyState(): PersistedData {
  return { customers: [], projects: [], services: [], entries: [] };
}

function isConflict(error: unknown): boolean {
  return error instanceof RestError && (error.statusCode === 412 || error.statusCode === 409);
}

export async function streamToString(stream: NodeJS.ReadableStream | undefined): Promise<string> {
  if (!stream) {
    return '';
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// Reads state.json, filtering out past-year entries that pre-date the year-split migration.
// Missing blob => empty state with etag ''. If the blob is not PersistedData-shaped, `data`
// is empty and the unparsed blob body is returned in `raw`.
export async function readMainState(): Promise<{ data: PersistedData; etag: string; raw?: string }> {
  const container = getStateContainerClient();
  const currentYear = new Date().getFullYear();
  const blob = container.getBlockBlobClient(STATE_BLOB_NAME);
  try {
    const download = await blob.download();
    const raw = await streamToString(download.readableStreamBody);
    const parsed: unknown = JSON.parse(raw);
    const etag = download.etag ?? '';
    if (isPersistedData(parsed)) {
      return {
        data: {
          customers: parsed.customers,
          projects: parsed.projects,
          services: parsed.services ?? [],
          entries: parsed.entries.filter((e) => entryYear(e) === currentYear),
        },
        etag,
      };
    }
    return { data: emptyState(), etag, raw };
  } catch (error) {
    if (error instanceof RestError && error.statusCode === 404) {
      return { data: emptyState(), etag: '' };
    }
    throw error;
  }
}

// Reads state.YYYY.json. `rawBody` is the blob body verbatim (absent when the blob is missing).
export async function readYearEntries(year: number): Promise<{ entries: unknown[]; etag: string; rawBody?: string }> {
  const container = getStateContainerClient();
  const blob = container.getBlockBlobClient(yearBlobName(year));
  try {
    const download = await blob.download();
    const rawBody = await streamToString(download.readableStreamBody);
    const parsed = JSON.parse(rawBody) as { entries?: unknown } | null;
    const entries = parsed && Array.isArray(parsed.entries) ? parsed.entries : [];
    return { entries, etag: download.etag ?? '', rawBody };
  } catch (error) {
    if (error instanceof RestError && error.statusCode === 404) {
      return { entries: [], etag: '' };
    }
    throw error;
  }
}

// etag: non-empty => If-Match; '' => unconditional; null => create-only (If-None-Match: *).
// Returns the new ETag.
export async function writeMainState(
  data: PersistedData,
  etag: string | null,
  log?: (msg: string) => void,
): Promise<string> {
  const container = getStateContainerClient();
  await container.createIfNotExists();

  // Migration: on the first PUT after deployment, the existing blob may contain entries
  // from multiple years. Archive past-year entries to state.YYYY.json before overwriting.
  const currentYear = new Date().getFullYear();
  const mainBlob = container.getBlockBlobClient(STATE_BLOB_NAME);
  try {
    const existing = await mainBlob.download();
    const raw = await streamToString(existing.readableStreamBody);
    const existingData: unknown = JSON.parse(raw);
    if (isPersistedData(existingData)) {
      const pastByYear = new Map<number, unknown[]>();
      for (const entry of existingData.entries) {
        const year = entryYear(entry);
        if (year > 0 && year !== currentYear) {
          if (!pastByYear.has(year)) pastByYear.set(year, []);
          pastByYear.get(year)!.push(entry);
        }
      }
      for (const [year, entries] of pastByYear) {
        const yearBlob = container.getBlockBlobClient(yearBlobName(year));
        const yearContent = JSON.stringify({ entries }, null, 2);
        try {
          await yearBlob.upload(yearContent, Buffer.byteLength(yearContent), {
            blobHTTPHeaders: { blobContentType: 'application/json' },
            conditions: { ifNoneMatch: '*' }, // create only; never overwrite an existing year blob
          });
        } catch (archiveErr) {
          if (!isConflict(archiveErr)) {
            log?.(`Skipping archive of year ${year}: blob already exists or write failed.`);
          }
        }
      }
    }
  } catch (readErr) {
    if (!(readErr instanceof RestError && readErr.statusCode === 404)) {
      log?.('Could not read existing blob for migration; proceeding with save.');
    }
  }

  const content = JSON.stringify(data, null, 2);
  try {
    const conditions = etag ? { ifMatch: etag } : etag === '' ? {} : { ifNoneMatch: '*' };
    const result = await mainBlob.upload(content, Buffer.byteLength(content), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
      conditions,
    });
    return result.etag ?? '';
  } catch (error) {
    if (isConflict(error)) {
      throw new ConflictError('State changed since you last loaded it. Reload and retry.');
    }
    throw error;
  }
}

// Non-empty etag => If-Match; otherwise create-only (If-None-Match: *). Returns the new ETag.
export async function writeYearState(year: number, payload: { entries: unknown[] }, etag: string | null): Promise<string> {
  const container = getStateContainerClient();
  await container.createIfNotExists();
  const blob = container.getBlockBlobClient(yearBlobName(year));
  const content = JSON.stringify(payload, null, 2);
  try {
    const conditions = etag ? { ifMatch: etag } : { ifNoneMatch: '*' };
    const result = await blob.upload(content, Buffer.byteLength(content), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
      conditions,
    });
    return result.etag ?? '';
  } catch (error) {
    if (isConflict(error)) {
      throw new ConflictError('State changed since you last loaded it. Reload and retry.');
    }
    throw error;
  }
}
