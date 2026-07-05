// GET  /api/state                 -> returns config + current year's entries from state.json.
//                                     Filters out entries from past years transparently, enabling
//                                     gradual migration from single-blob to per-year blobs.
// GET  /api/state?year=YYYY       -> returns entries for that year from state.YYYY.json.
//                                     Used for lazy-loading past year data on demand.
// PUT  /api/state                 -> saves config + current year entries to state.json.
//                                     On first write after migration, archives any past-year
//                                     entries found in the existing blob to state.YYYY.json files.
// PUT  /api/state?year=YYYY       -> saves entries to state.YYYY.json.
//                                     Uses ETag / If-Match for optimistic concurrency like the main blob.

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { getStateContainerClient, STATE_BLOB_NAME } from '../blobClient.js';
import { requireOwner } from '../auth.js';
import { RestError } from '@azure/storage-blob';

interface PersistedData {
  customers: unknown[];
  projects: unknown[];
  services: unknown[];
  entries: unknown[];
}

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

function entryYear(entry: unknown): number {
  if (!entry || typeof entry !== 'object') return 0;
  const date = (entry as { date?: unknown }).date;
  if (typeof date !== 'string') return 0;
  const y = new Date(date).getFullYear();
  return Number.isFinite(y) ? y : 0;
}

function yearBlobName(year: number): string {
  return `state.${year}.json`;
}

const EMPTY_STATE: PersistedData = { customers: [], projects: [], services: [], entries: [] };

async function getState(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (!requireOwner(request)) {
    return { status: 401, jsonBody: { message: 'Not authenticated.' } };
  }

  const container = getStateContainerClient();
  const yearParam = request.query.get('year');

  // Year-specific request: return entries from state.YYYY.json.
  if (yearParam !== null) {
    const year = Number(yearParam);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { status: 400, jsonBody: { message: 'Invalid year parameter.' } };
    }
    const blob = container.getBlockBlobClient(yearBlobName(year));
    try {
      const download = await blob.download();
      const body = await streamToString(download.readableStreamBody);
      return {
        status: 200,
        headers: { ETag: download.etag ?? '', 'Content-Type': 'application/json' },
        body,
      };
    } catch (error) {
      if (error instanceof RestError && error.statusCode === 404) {
        return {
          status: 200,
          headers: { ETag: '', 'Content-Type': 'application/json' },
          jsonBody: { entries: [] },
        };
      }
      context.error(`Failed to read state blob for year ${year}`, error);
      return { status: 500, jsonBody: { message: `Failed to read state for year ${year}.` } };
    }
  }

  // Default: return config + current year entries from state.json, filtering out any
  // past-year entries that pre-date the year-split migration.
  const currentYear = new Date().getFullYear();
  const blob = container.getBlockBlobClient(STATE_BLOB_NAME);
  try {
    const download = await blob.download();
    const raw = await streamToString(download.readableStreamBody);
    const parsed: unknown = JSON.parse(raw);
    if (isPersistedData(parsed)) {
      const filtered: PersistedData = {
        customers: parsed.customers,
        projects: parsed.projects,
        services: parsed.services ?? [],
        entries: parsed.entries.filter((e) => entryYear(e) === currentYear),
      };
      return {
        status: 200,
        headers: { ETag: download.etag ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify(filtered),
      };
    }
    return {
      status: 200,
      headers: { ETag: download.etag ?? '', 'Content-Type': 'application/json' },
      body: raw,
    };
  } catch (error) {
    if (error instanceof RestError && error.statusCode === 404) {
      return {
        status: 200,
        headers: { ETag: '', 'Content-Type': 'application/json' },
        jsonBody: EMPTY_STATE,
      };
    }
    context.error('Failed to read state blob', error);
    return { status: 500, jsonBody: { message: 'Failed to read state.' } };
  }
}

async function putState(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (!requireOwner(request)) {
    return { status: 401, jsonBody: { message: 'Not authenticated.' } };
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return { status: 400, jsonBody: { message: 'Body must be valid JSON.' } };
  }

  const container = getStateContainerClient();
  await container.createIfNotExists();
  const yearParam = request.query.get('year');

  // Year-specific PUT: save entries to state.YYYY.json.
  if (yearParam !== null) {
    const year = Number(yearParam);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { status: 400, jsonBody: { message: 'Invalid year parameter.' } };
    }
    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { entries?: unknown }).entries)) {
      return { status: 400, jsonBody: { message: 'Body must contain entries[].' } };
    }
    const ifMatch = request.headers.get('if-match');
    const blob = container.getBlockBlobClient(yearBlobName(year));
    const content = JSON.stringify(payload, null, 2);
    try {
      const conditions = ifMatch ? { ifMatch } : { ifNoneMatch: '*' };
      const result = await blob.upload(content, Buffer.byteLength(content), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
        conditions,
      });
      return { status: 200, headers: { ETag: result.etag ?? '' }, jsonBody: { ok: true } };
    } catch (error) {
      if (error instanceof RestError && (error.statusCode === 412 || error.statusCode === 409)) {
        return { status: 412, jsonBody: { message: 'State changed since you last loaded it. Reload and retry.' } };
      }
      context.error(`Failed to write state blob for year ${year}`, error);
      return { status: 500, jsonBody: { message: `Failed to save state for year ${year}.` } };
    }
  }

  // Default PUT: save config + current year entries to state.json.
  if (!isPersistedData(payload)) {
    return { status: 400, jsonBody: { message: 'Body must contain customers[], projects[], services[]?, entries[].' } };
  }

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
          if (!(archiveErr instanceof RestError && (archiveErr.statusCode === 412 || archiveErr.statusCode === 409))) {
            context.log(`Skipping archive of year ${year}: blob already exists or write failed.`);
          }
        }
      }
    }
  } catch (readErr) {
    if (!(readErr instanceof RestError && readErr.statusCode === 404)) {
      context.log('Could not read existing blob for migration; proceeding with save.');
    }
  }

  const ifMatch = request.headers.get('if-match');
  const content = JSON.stringify(payload, null, 2);

  try {
    const conditions = ifMatch ? { ifMatch } : ifMatch === '' ? {} : { ifNoneMatch: '*' };
    const result = await mainBlob.upload(content, Buffer.byteLength(content), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
      conditions,
    });
    return { status: 200, headers: { ETag: result.etag ?? '' }, jsonBody: { ok: true } };
  } catch (error) {
    if (error instanceof RestError && (error.statusCode === 412 || error.statusCode === 409)) {
      return { status: 412, jsonBody: { message: 'State changed since you last loaded it. Reload and retry.' } };
    }
    context.error('Failed to write state blob', error);
    return { status: 500, jsonBody: { message: 'Failed to save state.' } };
  }
}

async function streamToString(stream: NodeJS.ReadableStream | undefined): Promise<string> {
  if (!stream) {
    return '';
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

app.http('getState', { methods: ['GET'], authLevel: 'anonymous', route: 'state', handler: getState });
app.http('putState', { methods: ['PUT'], authLevel: 'anonymous', route: 'state', handler: putState });
