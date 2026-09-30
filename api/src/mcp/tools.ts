// MCP tool definitions for Punch. All earnings math goes through the shared
// helpers in src/lib/earnings.ts; entries are built exactly like saveModal()
// in src/hooks/useAppState.ts. Customers/projects/services are never written.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as stateStore from '../stateStore.js';
import type { PersistedData } from '../stateStore.js';
import type { Customer, Entry, Project, Service } from '../../../src/types.js';
import { aggregateBy, entryEarnValue, filterEntries, summarize } from '../../../src/lib/earnings.js';
import { currentRatePeriod, rateForDate } from '../../../src/lib/rates.js';

export interface McpDeps {
  readMainState(): Promise<{ data: PersistedData; etag: string }>;
  readMainStateUnfiltered(): Promise<{ data: PersistedData; etag: string }>;
  readYearEntries(year: number): Promise<{ entries: unknown[]; etag: string }>;
  writeMainState(data: PersistedData, etag: string | null): Promise<string>;
  writeYearState(year: number, payload: { entries: unknown[] }, etag: string | null): Promise<string>;
  currentYear(): number;
  hoursPerDay(): number;
  newId(): string;
}

export const defaultDeps: McpDeps = {
  readMainState: () => stateStore.readMainState(),
  readMainStateUnfiltered: () => stateStore.readMainStateUnfiltered(),
  readYearEntries: (y) => stateStore.readYearEntries(y),
  writeMainState: (d, e) => stateStore.writeMainState(d, e),
  writeYearState: (y, p, e) => stateStore.writeYearState(y, p, e),
  currentYear: () => new Date().getFullYear(),
  hoursPerDay: () => Number(process.env.PUNCH_HOURS_PER_DAY) || 8,
  newId: () => `x${Math.random().toString(36).slice(2, 9)}`,
};

const MAX_RANGE_DAYS = 366;
const LOOKBACK_YEARS = 8;

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

const ok = (value: unknown): ToolResult => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const fail = (message: string): ToolResult => ({ content: [{ type: 'text', text: message }], isError: true });

class ToolError extends Error {}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use ISO date yyyy-mm-dd');

function validDate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return false;
  const y = Number(s.slice(0, 4));
  return y >= 2000 && y <= 2100;
}

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isConflict(err: unknown): boolean {
  return err instanceof stateStore.ConflictError || (err as { name?: string } | null)?.name === 'ConflictError';
}

interface Catalog {
  customers: Customer[];
  projects: Project[];
  services: Service[];
  projById: Record<string, Project>;
  serviceById: Record<string, Service>;
  custById: Record<string, Customer>;
}

function catalogOf(data: PersistedData): Catalog {
  const customers = data.customers as Customer[];
  const projects = data.projects as Project[];
  const services = (data.services ?? []) as Service[];
  // Null-prototype maps: ids like "constructor" or "__proto__" must not resolve.
  const projById: Record<string, Project> = Object.create(null);
  projects.forEach((p) => { projById[p.id] = p; });
  const serviceById: Record<string, Service> = Object.create(null);
  services.forEach((s) => { serviceById[s.id] = s; });
  const custById: Record<string, Customer> = Object.create(null);
  customers.forEach((c) => { custById[c.id] = c; });
  return { customers, projects, services, projById, serviceById, custById };
}

function withDefaults(e: Entry): Entry {
  return { ...e, attachments: e.attachments ?? [] };
}

// Lazily reads state.json without the year filter (once per operation) so entries of a
// year whose blob does not exist yet (pre-migration) can be seen and preserved.
function unfilteredLoader(deps: McpDeps) {
  let cached: Promise<Entry[]> | null = null;
  return async (year: number): Promise<Entry[]> => {
    cached ??= deps.readMainStateUnfiltered().then((r) => r.data.entries as Entry[]);
    return (await cached).filter((e) => typeof e?.date === 'string' && yearOf(e.date) === year);
  };
}

// Loads main state plus every other-year blob that overlaps [from, to]. Missing year blobs
// fall back to pre-migration entries still stored in state.json.
async function loadRange(deps: McpDeps, from: string, to: string) {
  const main = await deps.readMainState();
  const cur = deps.currentYear();
  const legacy = unfilteredLoader(deps);
  const entries: Entry[] = [...(main.data.entries as Entry[])];
  for (let y = yearOf(from); y <= yearOf(to); y += 1) {
    if (y === cur) continue;
    const res = await deps.readYearEntries(y);
    entries.push(...((res.etag === '' ? await legacy(y) : res.entries) as Entry[]));
  }
  const seen = new Set<string>();
  const unique = entries.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  return { data: main.data, catalog: catalogOf(main.data), entries: unique.map(withDefaults) };
}

function checkRange(from: string, to: string): string | null {
  if (!validDate(from) || !validDate(to)) return 'from/to must be valid ISO dates (yyyy-mm-dd, years 2000-2100).';
  if (to < from) return '"to" must not be before "from".';
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1;
  if (days > MAX_RANGE_DAYS) return `Range too large (${days} days); the maximum is ${MAX_RANGE_DAYS} days.`;
  return null;
}

// --- write transaction -----------------------------------------------------

class Tx {
  private years = new Map<number, { entries: Entry[]; etag: string }>();
  readonly dirty: number[] = [];
  private legacy: (year: number) => Promise<Entry[]>;
  constructor(
    private deps: McpDeps,
    readonly main: { data: PersistedData; etag: string },
    readonly catalog: Catalog,
  ) {
    this.years.set(deps.currentYear(), { entries: main.data.entries as Entry[], etag: main.etag });
    this.legacy = unfilteredLoader(deps);
  }

  blobYear(date: string): number {
    return yearOf(date);
  }

  async entriesFor(year: number): Promise<Entry[]> {
    let b = this.years.get(year);
    if (!b) {
      const res = await this.deps.readYearEntries(year);
      // Missing blob: seed with pre-migration entries from state.json so the create-only
      // write cannot orphan them. An existing blob is used as-is.
      const entries = res.etag === '' ? structuredClone(await this.legacy(year)) : (res.entries as Entry[]);
      b = { entries, etag: res.etag };
      this.years.set(year, b);
    }
    return b.entries;
  }

  markDirty(year: number): void {
    if (!this.dirty.includes(year)) this.dirty.push(year);
  }

  async findEntry(id: string): Promise<{ entry: Entry; year: number } | null> {
    const cur = this.deps.currentYear();
    for (let y = cur + 1; y >= cur - LOOKBACK_YEARS; y -= 1) {
      const entry = (await this.entriesFor(y)).find((e) => e.id === id);
      if (entry) return { entry, year: y };
    }
    return null;
  }

  async allEntries(): Promise<Entry[]> {
    const cur = this.deps.currentYear();
    const all: Entry[] = [];
    for (let y = cur + 1; y >= cur - LOOKBACK_YEARS; y -= 1) all.push(...(await this.entriesFor(y)));
    return all;
  }

  async commit(): Promise<void> {
    const cur = this.deps.currentYear();
    for (const year of this.dirty) {
      const b = this.years.get(year)!;
      const etag = b.etag === '' ? null : b.etag;
      if (year === cur) {
        await this.deps.writeMainState({ ...this.main.data, entries: b.entries }, etag);
      } else {
        await this.deps.writeYearState(year, { entries: b.entries }, etag);
      }
    }
  }
}

async function transact<T>(deps: McpDeps, apply: (tx: Tx) => Promise<T>): Promise<ToolResult> {
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const main = await deps.readMainState();
      const tx = new Tx(deps, main, catalogOf(main.data));
      try {
        const result = await apply(tx);
        await tx.commit();
        return ok(result);
      } catch (err) {
        if (isConflict(err) && attempt === 0) continue;
        throw err;
      }
    }
    return fail('Punch data changed concurrently, retry');
  } catch (err) {
    if (err instanceof ToolError) return fail(err.message);
    if (isConflict(err)) return fail('Punch data changed concurrently, retry');
    throw err;
  }
}

// --- entry building / validation ------------------------------------------

interface EntryFields {
  kind: Entry['kind'];
  projectId?: string | null;
  serviceId?: string | null;
  customerId?: string | null;
  hours?: number;
  amount?: number;
}

function requireHours(hours: number | undefined): number {
  if (hours === undefined || !Number.isFinite(hours) || hours <= 0) {
    throw new ToolError('hours is required and must be greater than 0 for this entry kind.');
  }
  return hours;
}

// Mirrors buildEntry() in saveModal(): which link fields are set per kind.
function shapeEntry(
  deps: McpDeps,
  id: string,
  date: string,
  f: EntryFields,
  comment: string,
  attachments: Entry['attachments'],
  cat: Catalog,
): Entry {
  let minutes: number;
  if (f.kind === 'holiday') {
    minutes = Math.round(deps.hoursPerDay() * 60);
  } else if (f.kind === 'customer') {
    minutes = f.hours === undefined ? 60 : Math.round(requireHours(f.hours) * 60);
  } else {
    minutes = Math.round(requireHours(f.hours) * 60);
  }
  if (!Number.isFinite(minutes) || minutes <= 0) throw new ToolError('Entry duration must be greater than 0.');

  if (f.kind === 'project') {
    if (!f.projectId) throw new ToolError('projectId is required for kind "project".');
    if (!cat.projById[f.projectId]) throw new ToolError(`Unknown projectId "${f.projectId}". Use list_projects.`);
  }
  if (f.kind === 'service') {
    if (!f.serviceId || !f.customerId) throw new ToolError('serviceId and customerId are required for kind "service".');
    if (!cat.serviceById[f.serviceId]) throw new ToolError(`Unknown serviceId "${f.serviceId}". Use list_services.`);
  }
  if (f.kind === 'customer') {
    if (!f.customerId) throw new ToolError('customerId is required for kind "customer".');
    if (f.amount === undefined || !Number.isFinite(f.amount) || f.amount <= 0) {
      throw new ToolError('amount (flat fee in EUR, > 0) is required for kind "customer".');
    }
  }
  if ((f.kind === 'service' || f.kind === 'customer') && !cat.custById[f.customerId!]) {
    throw new ToolError(`Unknown customerId "${f.customerId}". Use list_customers.`);
  }

  return {
    id,
    kind: f.kind,
    projectId: f.kind === 'project' ? f.projectId! : null,
    serviceId: f.kind === 'service' ? f.serviceId! : null,
    customerId: f.kind === 'service' || f.kind === 'customer' ? f.customerId! : null,
    amount: f.kind === 'customer' ? f.amount! : null,
    date,
    minutes,
    comment,
    attachments,
  };
}

// Same rule as the app: manual close, or budget spent. Also blocks entries
// that would overshoot the remaining budget.
function checkBudget(project: Project, entry: Entry, others: Entry[], hpd: number): void {
  if (project.closed) throw new ToolError(`Project "${project.name}" is closed; no entries can be logged on it.`);
  const budget = project.budget ?? 0;
  if (budget <= 0) return;
  const spent = others
    .filter((e) => e.kind === 'project' && e.projectId === project.id && e.id !== entry.id)
    .reduce((s, e) => s + entryEarnValue(e, project, undefined, hpd), 0);
  const remaining = budget - spent;
  if (remaining <= 0) {
    throw new ToolError(`Budget cap of ${budget} reached for project "${project.name}" (closed); no entries can be logged on it.`);
  }
  const add = entryEarnValue(entry, project, undefined, hpd);
  if (add > remaining) {
    const rate = rateForDate(project.rates, entry.date);
    const maxHours = rate > 0 ? round2((remaining / rate) * hpd) : 0;
    throw new ToolError(
      `This entry (${round2(add)}) would exceed the remaining budget of ${round2(remaining)} for project "${project.name}". Max hours you can book: ${maxHours}.`,
    );
  }
}

function describe(e: Entry, cat: Catalog, hpd: number) {
  const project = e.projectId ? cat.projById[e.projectId] : undefined;
  const service = e.serviceId ? cat.serviceById[e.serviceId] : undefined;
  const customerId = e.kind === 'project' ? project?.customerId : e.customerId;
  return {
    id: e.id,
    date: e.date,
    kind: e.kind,
    projectId: e.projectId,
    projectName: project?.name ?? null,
    serviceId: e.serviceId,
    serviceName: service?.name ?? null,
    customerId: customerId ?? null,
    customerName: customerId ? (cat.custById[customerId]?.name ?? null) : null,
    hours: round2(e.minutes / 60),
    amount: e.amount,
    comment: e.comment,
    earned: round2(entryEarnValue(e, project, service, hpd)),
    attachmentCount: (e.attachments ?? []).length,
  };
}

// --- registration ----------------------------------------------------------

export function registerTools(server: McpServer, deps: McpDeps = defaultDeps): void {
  const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

  server.registerTool('list_customers', {
    title: 'List customers',
    description: 'List all customers (id and name). Use the ids when logging service or customer-fee entries or filtering entries.',
    annotations: RO,
  }, async () => {
    const { data } = await deps.readMainState();
    return ok(catalogOf(data).customers.map((c) => ({ id: c.id, name: c.name })));
  });

  server.registerTool('list_projects', {
    title: 'List projects',
    description: 'List projects with customer, current day rate (EUR/day), optional budget and amount spent this year, and whether the project is closed. Closed means manually closed or budget reached; no entries can be logged on closed projects. Closed projects are hidden unless includeClosed is true.',
    inputSchema: { includeClosed: z.boolean().optional().describe('Include closed projects (default false).') },
    annotations: RO,
  }, async ({ includeClosed }) => {
    const { data } = await deps.readMainState();
    const cat = catalogOf(data);
    const hpd = deps.hoursPerDay();
    const entries = data.entries as Entry[];
    const rows = cat.projects.map((p) => {
      const spent = entries
        .filter((e) => e.kind === 'project' && e.projectId === p.id)
        .reduce((s, e) => s + entryEarnValue(e, p, undefined, hpd), 0);
      const budget = p.budget ?? 0;
      const closed = p.closed === true || (budget > 0 && spent >= budget);
      return {
        id: p.id,
        name: p.name,
        customerId: p.customerId,
        customerName: cat.custById[p.customerId]?.name ?? null,
        dayRate: currentRatePeriod(p.rates)?.amount ?? 0,
        budget: budget > 0 ? budget : null,
        spentThisYear: round2(spent),
        closed,
      };
    });
    return ok(rows.filter((r) => includeClosed || !r.closed));
  });

  server.registerTool('list_services', {
    title: 'List services',
    description: 'List services (flat-rate items billed per entry, regardless of duration) with their current rate in EUR.',
    annotations: RO,
  }, async () => {
    const { data } = await deps.readMainState();
    return ok(catalogOf(data).services.map((s) => ({ id: s.id, name: s.name, rate: currentRatePeriod(s.rates)?.amount ?? 0 })));
  });

  const rangeShape = {
    from: isoDate.describe('Start date, inclusive (yyyy-mm-dd).'),
    to: isoDate.describe('End date, inclusive (yyyy-mm-dd). Range is capped at 366 days.'),
  };

  server.registerTool('list_entries', {
    title: 'List time entries',
    description: 'List time entries in an inclusive date range (max 366 days), optionally filtered by customer, project or service. Each entry has hours, earned amount (EUR), comment and attachment count. Covers past years too.',
    inputSchema: {
      ...rangeShape,
      customerId: z.string().optional(),
      projectId: z.string().optional(),
      serviceId: z.string().optional(),
    },
    annotations: RO,
  }, async ({ from, to, customerId, projectId, serviceId }) => {
    const bad = checkRange(from, to);
    if (bad) return fail(bad);
    const { catalog, entries } = await loadRange(deps, from, to);
    const hpd = deps.hoursPerDay();
    const filtered = filterEntries(entries, catalog.projects, catalog.services, {
      fromISO: from, toISO: to, customerId: customerId ?? null, projectId: projectId ?? null,
    }).filter((e) => !serviceId || (e.kind === 'service' && e.serviceId === serviceId));
    filtered.sort((a, b) => a.date.localeCompare(b.date));
    return ok(filtered.map((e) => describe(e, catalog, hpd)));
  });

  server.registerTool('get_earnings', {
    title: 'Get earnings',
    description: 'Earnings summary for an inclusive date range (max 366 days): totals (hours, days, earned EUR, entry count) plus groups by customer, project (rows split per rate) or service. Days = hours / configured hours per day.',
    inputSchema: {
      ...rangeShape,
      groupBy: z.enum(['customer', 'project', 'service']).describe('How to group the results.'),
    },
    annotations: RO,
  }, async ({ from, to, groupBy }) => {
    const bad = checkRange(from, to);
    if (bad) return fail(bad);
    const { catalog, entries } = await loadRange(deps, from, to);
    const hpd = deps.hoursPerDay();
    const inRange = filterEntries(entries, catalog.projects, catalog.services, {
      fromISO: from, toISO: to, customerId: null, projectId: null,
    });
    const s = summarize(inRange, catalog.projById, catalog.serviceById, hpd);
    const groupEntries = groupBy === 'service' ? inRange.filter((e) => e.kind === 'service') : inRange;
    const groups = aggregateBy(
      groupEntries, catalog.projects, catalog.services, catalog.customers,
      groupBy === 'customer' ? 'customer' : 'project', hpd,
    );
    return ok({
      from,
      to,
      groupBy,
      totals: { hours: round2(s.minutes / 60), days: round2(s.days), earned: round2(s.earn), count: s.count },
      groups: groups.map((g) => ({
        id: g.id, name: g.name, hours: round2(g.minutes / 60), earned: round2(g.earn),
        count: g.count, rate: g.rate, sharePct: round2(g.sharePct),
      })),
    });
  });

  const fieldShape = {
    projectId: z.string().optional().describe('Required for kind "project".'),
    serviceId: z.string().optional().describe('Required for kind "service".'),
    customerId: z.string().optional().describe('Required for kinds "service" and "customer". Not used for "project" (derived from the project).'),
    hours: z.number().positive().max(24).optional().describe('Duration in hours, e.g. 2.5. Required for project/service. Ignored for holiday (always a full day).'),
    amount: z.number().positive().max(1_000_000).optional().describe('Flat fee in EUR, required for kind "customer".'),
    comment: z.string().max(2000).optional(),
  };

  server.registerTool('log_entry', {
    title: 'Log time entry',
    description: 'Create one time entry. kind "project": projectId + hours (earns prorated day rate). kind "service": serviceId + customerId + hours (flat rate per entry). kind "customer": customerId + amount (flat fee). kind "holiday": no links, counts as a full day, earns nothing. Refused on closed projects or when the project budget would be exceeded. Look up ids first with list_projects / list_services / list_customers.',
    inputSchema: {
      date: isoDate.describe('Entry date (yyyy-mm-dd).'),
      kind: z.enum(['project', 'service', 'customer', 'holiday']),
      ...fieldShape,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (a) => {
    if (!validDate(a.date)) return fail('date must be a valid ISO date (yyyy-mm-dd).');
    return transact(deps, async (tx) => {
      const entry = shapeEntry(deps, deps.newId(), a.date, a, a.comment ?? '', [], tx.catalog);
      const year = tx.blobYear(a.date);
      const list = await tx.entriesFor(year);
      if (entry.kind === 'project') {
        checkBudget(tx.catalog.projById[entry.projectId!], entry, await tx.allEntries(), deps.hoursPerDay());
      }
      list.push(entry);
      tx.markDirty(year);
      return describe(entry, tx.catalog, deps.hoursPerDay());
    });
  });

  server.registerTool('update_entry', {
    title: 'Update time entry',
    description: 'Patch an existing entry by id (from list_entries). Only the provided fields change; the result must still be valid for the entry kind. The kind cannot change. Attachments are preserved. Refused if it would put hours on a closed project or exceed its budget.',
    inputSchema: {
      id: z.string(),
      date: isoDate.optional(),
      ...fieldShape,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (a) => {
    if (a.date !== undefined && !validDate(a.date)) return fail('date must be a valid ISO date (yyyy-mm-dd).');
    return transact(deps, async (tx) => {
      const found = await tx.findEntry(a.id);
      if (!found) throw new ToolError(`Entry "${a.id}" not found.`);
      const old = found.entry;
      const date = a.date ?? old.date;
      const merged = shapeEntry(deps, old.id, date, {
        kind: old.kind,
        projectId: a.projectId ?? old.projectId,
        serviceId: a.serviceId ?? old.serviceId,
        customerId: a.customerId ?? old.customerId,
        hours: a.hours ?? old.minutes / 60,
        amount: a.amount ?? old.amount ?? undefined,
      }, a.comment ?? old.comment, old.attachments ?? [], tx.catalog);
      if (old.kind === 'holiday') merged.minutes = old.minutes;
      if (merged.kind === 'project') {
        checkBudget(tx.catalog.projById[merged.projectId!], merged, await tx.allEntries(), deps.hoursPerDay());
      }
      const destYear = tx.blobYear(date);
      if (destYear === found.year) {
        const list = await tx.entriesFor(found.year);
        list[list.findIndex((e) => e.id === old.id)] = merged;
        tx.markDirty(found.year);
      } else {
        // Destination first, so a partial failure duplicates rather than loses the entry.
        (await tx.entriesFor(destYear)).push(merged);
        tx.markDirty(destYear);
        const src = await tx.entriesFor(found.year);
        src.splice(src.findIndex((e) => e.id === old.id), 1);
        tx.markDirty(found.year);
      }
      return describe(merged, tx.catalog, deps.hoursPerDay());
    });
  });

  server.registerTool('delete_entry', {
    title: 'Delete time entry',
    description: 'Permanently delete an entry by id. Entries that have attachments cannot be deleted here; they must be deleted in the Punch app so attachment files are cleaned up.',
    inputSchema: { id: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ id }) => transact(deps, async (tx) => {
    const found = await tx.findEntry(id);
    if (!found) throw new ToolError(`Entry "${id}" not found.`);
    if ((found.entry.attachments ?? []).length > 0) {
      throw new ToolError('This entry has attachments; delete it in the Punch app so attachments are cleaned up.');
    }
    const list = await tx.entriesFor(found.year);
    list.splice(list.findIndex((e) => e.id === id), 1);
    tx.markDirty(found.year);
    return { deleted: id };
  }));
}
