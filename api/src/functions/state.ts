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
//
// Blob I/O lives in ../stateStore.ts (shared with the MCP endpoint).

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireOwner } from '../auth.js';
import { isMcpHost } from '../role.js';
import {
  ConflictError,
  isPersistedData,
  readMainState,
  readYearEntries,
  writeMainState,
  writeYearState,
} from '../stateStore.js';

const CONFLICT_MESSAGE = 'State changed since you last loaded it. Reload and retry.';

async function getState(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (!requireOwner(request)) {
    return { status: 401, jsonBody: { message: 'Not authenticated.' } };
  }

  const yearParam = request.query.get('year');

  // Year-specific request: return entries from state.YYYY.json.
  if (yearParam !== null) {
    const year = Number(yearParam);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { status: 400, jsonBody: { message: 'Invalid year parameter.' } };
    }
    try {
      const result = await readYearEntries(year);
      if (result.rawBody === undefined) {
        return {
          status: 200,
          headers: { ETag: '', 'Content-Type': 'application/json' },
          jsonBody: { entries: [] },
        };
      }
      return {
        status: 200,
        headers: { ETag: result.etag, 'Content-Type': 'application/json' },
        body: result.rawBody,
      };
    } catch (error) {
      context.error(`Failed to read state blob for year ${year}`, error);
      return { status: 500, jsonBody: { message: `Failed to read state for year ${year}.` } };
    }
  }

  // Default: return config + current year entries from state.json, filtering out any
  // past-year entries that pre-date the year-split migration.
  try {
    const result = await readMainState();
    if (result.raw !== undefined) {
      return {
        status: 200,
        headers: { ETag: result.etag, 'Content-Type': 'application/json' },
        body: result.raw,
      };
    }
    if (result.etag === '') {
      // Missing blob.
      return {
        status: 200,
        headers: { ETag: '', 'Content-Type': 'application/json' },
        jsonBody: result.data,
      };
    }
    return {
      status: 200,
      headers: { ETag: result.etag, 'Content-Type': 'application/json' },
      body: JSON.stringify(result.data),
    };
  } catch (error) {
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
    try {
      const etag = await writeYearState(year, payload as { entries: unknown[] }, ifMatch);
      return { status: 200, headers: { ETag: etag }, jsonBody: { ok: true } };
    } catch (error) {
      if (error instanceof ConflictError) {
        return { status: 412, jsonBody: { message: CONFLICT_MESSAGE } };
      }
      context.error(`Failed to write state blob for year ${year}`, error);
      return { status: 500, jsonBody: { message: `Failed to save state for year ${year}.` } };
    }
  }

  // Default PUT: save config + current year entries to state.json.
  if (!isPersistedData(payload)) {
    return { status: 400, jsonBody: { message: 'Body must contain customers[], projects[], services[]?, entries[].' } };
  }

  const ifMatch = request.headers.get('if-match');
  try {
    const etag = await writeMainState(payload, ifMatch, (msg) => context.log(msg));
    return { status: 200, headers: { ETag: etag }, jsonBody: { ok: true } };
  } catch (error) {
    if (error instanceof ConflictError) {
      return { status: 412, jsonBody: { message: CONFLICT_MESSAGE } };
    }
    context.error('Failed to write state blob', error);
    return { status: 500, jsonBody: { message: 'Failed to save state.' } };
  }
}

if (!isMcpHost()) app.http('getState', { methods: ['GET'], authLevel: 'anonymous', route: 'state', handler: getState });
if (!isMcpHost()) app.http('putState', { methods: ['PUT'], authLevel: 'anonymous', route: 'state', handler: putState });
