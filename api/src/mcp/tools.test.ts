import { describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ConflictError } from '../stateStore.js';
import { registerTools, type McpDeps } from './tools.js';
import { entryEarnValue } from '../../../src/lib/earnings.js';
import type { Entry, Project } from '../../../src/types.js';

const project: Project = {
  id: 'p1', name: 'Alpha', customerId: 'c1', reference: 'SYSTEM:ROW-42', budget: null,
  rates: [{ id: 'r1', amount: 800, from: '2020-01-01', to: null }],
};
const closedProject: Project = { ...project, id: 'p2', name: 'Old', reference: null, closed: true };

function mkEntry(over: Partial<Entry>): Entry {
  return {
    id: 'e1', date: '2026-03-02', kind: 'project', projectId: 'p1', serviceId: null,
    customerId: null, amount: null, minutes: 240, comment: '', attachments: [], ...over,
  };
}

function makeDeps(opts: { main?: Entry[]; years?: Record<number, Entry[]>; failWrites?: number; legacy?: Entry[] } = {}) {
  const state = {
    main: opts.main ?? [],
    years: { ...(opts.years ?? {}) } as Record<number, Entry[]>,
    writes: [] as { year: number | 'main'; entries: Entry[]; etag: string | null }[],
    failWrites: opts.failWrites ?? 0,
  };
  const deps: McpDeps = {
    async readMainState() {
      return {
        data: {
          customers: [{ id: 'c1', name: 'Acme', color: '#000' }],
          projects: [project, closedProject],
          services: [{ id: 's1', name: 'Workshop', rates: [{ id: 'r', amount: 500, from: '2020-01-01', to: null }] }],
          entries: structuredClone(state.main),
        },
        etag: '"m1"',
      };
    },
    async readMainStateUnfiltered() {
      const d = await deps.readMainState();
      return { data: { ...d.data, entries: [...(d.data.entries as Entry[]), ...structuredClone(opts.legacy ?? [])] }, etag: d.etag };
    },
    async readYearEntries(year) {
      const e = state.years[year];
      return { entries: structuredClone(e ?? []), etag: e ? `"y${year}"` : '' };
    },
    async writeMainState(data, etag) {
      if (state.failWrites > 0) { state.failWrites -= 1; throw new ConflictError('412'); }
      state.main = data.entries as Entry[];
      state.writes.push({ year: 'main', entries: data.entries as Entry[], etag });
      return '"m2"';
    },
    async writeYearState(year, payload, etag) {
      if (state.failWrites > 0) { state.failWrites -= 1; throw new ConflictError('412'); }
      state.years[year] = payload.entries as Entry[];
      state.writes.push({ year, entries: payload.entries as Entry[], etag });
      return `"y${year}b"`;
    },
    currentYear: () => 2026,
    hoursPerDay: () => 8,
    newId: () => 'new1',
  };
  return { deps, state };
}

async function connect(deps: McpDeps) {
  const server = new McpServer({ name: 't', version: '1' });
  registerTools(server, deps);
  const client = new Client({ name: 'c', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  return async (name: string, args: Record<string, unknown> = {}) => {
    const res = await client.callTool({ name, arguments: args });
    const text = (res.content as { text: string }[])[0].text;
    return { isError: res.isError === true, text, json: () => JSON.parse(text) };
  };
}

describe('mcp tools', () => {
  it('log_entry builds the right entry per kind', async () => {
    const { deps, state } = makeDeps();
    const call = await connect(deps);

    expect((await call('log_entry', { date: '2026-03-02', kind: 'project', projectId: 'p1', hours: 2.5, comment: 'x' })).isError).toBe(false);
    expect((await call('log_entry', { date: '2026-03-02', kind: 'service', serviceId: 's1', customerId: 'c1', hours: 1 })).isError).toBe(false);
    expect((await call('log_entry', { date: '2026-03-02', kind: 'customer', customerId: 'c1', amount: 99.5 })).isError).toBe(false);
    expect((await call('log_entry', { date: '2026-03-02', kind: 'holiday' })).isError).toBe(false);

    const [p, s, c, h] = state.main;
    expect(p).toMatchObject({ kind: 'project', projectId: 'p1', serviceId: null, customerId: null, amount: null, minutes: 150, comment: 'x', attachments: [] });
    expect(s).toMatchObject({ kind: 'service', projectId: null, serviceId: 's1', customerId: 'c1', amount: null, minutes: 60 });
    expect(c).toMatchObject({ kind: 'customer', projectId: null, serviceId: null, customerId: 'c1', amount: 99.5, minutes: 60 });
    expect(h).toMatchObject({ kind: 'holiday', projectId: null, serviceId: null, customerId: null, amount: null, minutes: 480 });
  });

  it('refuses logging on a closed project and unknown ids', async () => {
    const { deps, state } = makeDeps();
    const call = await connect(deps);
    const r = await call('log_entry', { date: '2026-03-02', kind: 'project', projectId: 'p2', hours: 1 });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/closed/);
    expect((await call('log_entry', { date: '2026-03-02', kind: 'project', projectId: 'nope', hours: 1 })).isError).toBe(true);
    expect(state.writes).toHaveLength(0);
  });

  it('retries once on a 412 and succeeds', async () => {
    const { deps, state } = makeDeps({ failWrites: 1 });
    const call = await connect(deps);
    const r = await call('log_entry', { date: '2026-03-02', kind: 'project', projectId: 'p1', hours: 1 });
    expect(r.isError).toBe(false);
    expect(state.main).toHaveLength(1);
  });

  it('returns isError after two 412s', async () => {
    const { deps, state } = makeDeps({ failWrites: 2 });
    const call = await connect(deps);
    const r = await call('log_entry', { date: '2026-03-02', kind: 'project', projectId: 'p1', hours: 1 });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/concurrently/);
    expect(state.main).toHaveLength(0);
  });

  it('refuses delete when the entry has attachments', async () => {
    const withAtt = mkEntry({ id: 'a1', attachments: [{ id: 'f', fileName: 'r.pdf', contentType: 'application/pdf', size: 1 }] });
    const { deps, state } = makeDeps({ main: [withAtt, mkEntry({ id: 'plain' })] });
    const call = await connect(deps);
    const r = await call('delete_entry', { id: 'a1' });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/Punch app/);
    expect((await call('delete_entry', { id: 'plain' })).isError).toBe(false);
    expect(state.main.map((e) => e.id)).toEqual(['a1']);
  });

  it('list_projects returns the complete DTO with set and unset references', async () => {
    const { deps } = makeDeps();
    const call = await connect(deps);

    expect((await call('list_projects')).json()).toEqual([{
      id: 'p1',
      name: 'Alpha',
      reference: 'SYSTEM:ROW-42',
      customerId: 'c1',
      customerName: 'Acme',
      dayRate: 800,
      budget: null,
      spentThisYear: 0,
      closed: false,
    }]);
    expect((await call('list_projects', { includeClosed: true })).json()).toEqual([
      {
        id: 'p1',
        name: 'Alpha',
        reference: 'SYSTEM:ROW-42',
        customerId: 'c1',
        customerName: 'Acme',
        dayRate: 800,
        budget: null,
        spentThisYear: 0,
        closed: false,
      },
      {
        id: 'p2',
        name: 'Old',
        reference: null,
        customerId: 'c1',
        customerName: 'Acme',
        dayRate: 800,
        budget: null,
        spentThisYear: 0,
        closed: true,
      },
    ]);
  });

  it('list_entries returns the complete DTO with set, unset, and projectless references', async () => {
    const entries = [
      mkEntry({ comment: 'Project work' }),
      mkEntry({
        id: 'h1', date: '2026-03-03', kind: 'holiday', projectId: null,
        minutes: 480, comment: 'Holiday',
      }),
      mkEntry({
        id: 'e2', date: '2026-03-04', projectId: 'p2',
        minutes: 60, comment: 'Old project work',
      }),
    ];
    const { deps } = makeDeps({ main: entries });
    const call = await connect(deps);

    expect((await call('list_entries', { from: '2026-03-01', to: '2026-03-31' })).json()).toEqual([
      {
        id: 'e1',
        date: '2026-03-02',
        kind: 'project',
        projectId: 'p1',
        projectName: 'Alpha',
        projectReference: 'SYSTEM:ROW-42',
        serviceId: null,
        serviceName: null,
        customerId: 'c1',
        customerName: 'Acme',
        hours: 4,
        amount: null,
        comment: 'Project work',
        earned: 400,
        attachmentCount: 0,
      },
      {
        id: 'h1',
        date: '2026-03-03',
        kind: 'holiday',
        projectId: null,
        projectName: null,
        projectReference: null,
        serviceId: null,
        serviceName: null,
        customerId: null,
        customerName: null,
        hours: 8,
        amount: null,
        comment: 'Holiday',
        earned: 0,
        attachmentCount: 0,
      },
      {
        id: 'e2',
        date: '2026-03-04',
        kind: 'project',
        projectId: 'p2',
        projectName: 'Old',
        projectReference: null,
        serviceId: null,
        serviceName: null,
        customerId: 'c1',
        customerName: 'Acme',
        hours: 1,
        amount: null,
        comment: 'Old project work',
        earned: 100,
        attachmentCount: 0,
      },
    ]);
  });

  it('earned for a project entry equals entryEarnValue', async () => {
    const e = mkEntry({ minutes: 150 });
    const { deps } = makeDeps({ main: [e] });
    const call = await connect(deps);
    const r = await call('list_entries', { from: '2026-01-01', to: '2026-12-31' });
    const expected = entryEarnValue(e, project, undefined, 8);
    expect(r.json()[0].earned).toBeCloseTo(expected, 2);
    const g = await call('get_earnings', { from: '2026-01-01', to: '2026-12-31', groupBy: 'project' });
    expect(g.json().totals.earned).toBeCloseTo(expected, 2);
  });

  it('list_entries merges a past-year blob', async () => {
    const past = mkEntry({ id: 'old', date: '2025-12-30' });
    const { deps } = makeDeps({ main: [mkEntry({ id: 'now', date: '2026-01-05' })], years: { 2025: [past] } });
    const call = await connect(deps);
    const r = await call('list_entries', { from: '2025-12-01', to: '2026-01-31' });
    expect(r.json().map((e: { id: string }) => e.id)).toEqual(['old', 'now']);
  });

  it('update_entry moves an entry across the year boundary', async () => {
    const { deps, state } = makeDeps({ main: [mkEntry({ id: 'm' })], years: { 2025: [] } });
    const call = await connect(deps);
    const r = await call('update_entry', { id: 'm', date: '2025-12-31' });
    expect(r.isError).toBe(false);
    expect(state.main).toHaveLength(0);
    expect(state.years[2025].map((e) => e.id)).toEqual(['m']);
  });

  it('log_entry dated next year goes to the year blob, not main', async () => {
    const { deps, state } = makeDeps();
    const call = await connect(deps);
    const r = await call('log_entry', { date: '2027-01-04', kind: 'project', projectId: 'p1', hours: 1 });
    expect(r.isError).toBe(false);
    expect(state.main).toHaveLength(0);
    expect(state.writes.map((w) => w.year)).toEqual([2027]);
    expect(state.writes[0].etag).toBeNull();
  });

  it('update_entry moving into next year moves it to the year blob', async () => {
    const { deps, state } = makeDeps({ main: [mkEntry({ id: 'm' })] });
    const call = await connect(deps);
    const r = await call('update_entry', { id: 'm', date: '2027-02-01' });
    expect(r.isError).toBe(false);
    expect(state.main).toHaveLength(0);
    expect(state.years[2027].map((e) => e.id)).toEqual(['m']);
    const found = await call('update_entry', { id: 'm', comment: 'found in future blob' });
    expect(found.isError).toBe(false);
  });

  it('seeds a missing year blob with pre-migration entries from state.json', async () => {
    const old = mkEntry({ id: 'old', date: '2025-06-01' });
    const { deps, state } = makeDeps({ legacy: [old] });
    const call = await connect(deps);
    const listed = await call('list_entries', { from: '2025-01-01', to: '2025-12-31' });
    expect(listed.json().map((e: { id: string }) => e.id)).toEqual(['old']);
    const r = await call('log_entry', { date: '2025-07-01', kind: 'project', projectId: 'p1', hours: 1 });
    expect(r.isError).toBe(false);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({ year: 2025, etag: null });
    expect(state.years[2025].map((e) => e.id).sort()).toEqual(['new1', 'old']);
  });

  it('does not merge legacy main entries when the year blob exists', async () => {
    const old = mkEntry({ id: 'old', date: '2025-06-01' });
    const inBlob = mkEntry({ id: 'blob', date: '2025-05-01' });
    const { deps, state } = makeDeps({ legacy: [old], years: { 2025: [inBlob] } });
    const call = await connect(deps);
    await call('log_entry', { date: '2025-07-01', kind: 'project', projectId: 'p1', hours: 1 });
    expect(state.years[2025].map((e) => e.id).sort()).toEqual(['blob', 'new1']);
  });

  it('rejects prototype-key ids', async () => {
    const { deps, state } = makeDeps();
    const call = await connect(deps);
    for (const id of ['constructor', '__proto__', 'toString']) {
      const r = await call('log_entry', { date: '2026-03-02', kind: 'project', projectId: id, hours: 1 });
      expect(r.isError).toBe(true);
      expect(r.text).toMatch(/Unknown projectId/);
    }
    expect(state.writes).toHaveLength(0);
  });

  it('enforces bounds on hours, dates and comments', async () => {
    const { deps, state } = makeDeps();
    const call = await connect(deps);
    const base = { date: '2026-03-02', kind: 'project', projectId: 'p1', hours: 1 };
    expect((await call('log_entry', { ...base, hours: 25 })).isError).toBe(true);
    expect((await call('log_entry', { ...base, date: '9999-01-01' })).isError).toBe(true);
    expect((await call('log_entry', { ...base, comment: 'x'.repeat(2001) })).isError).toBe(true);
    expect((await call('list_entries', { from: '9999-01-01', to: '9999-02-01' })).isError).toBe(true);
    expect(state.writes).toHaveLength(0);
  });

  it('rejects ranges over 366 days', async () => {
    const { deps } = makeDeps();
    const call = await connect(deps);
    expect((await call('list_entries', { from: '2024-01-01', to: '2026-01-01' })).isError).toBe(true);
  });
});
