// Earnings analytics helpers: pure aggregation over entries/projects/services/
// customers already held in memory. Reuses the same formulas as Track/Export
// so numbers always match.

import type { Customer, Entry, Project, Service } from '../types';
import { iso, pad, parseISO } from './dates';
import { rateForDate } from './rates';

export interface EarningsFilter {
  fromISO: string;
  toISO: string;
  customerId: string | null; // null = all customers
  projectId: string | null; // null = all projects
}

export interface EarningsSummary {
  minutes: number;
  earn: number;
  days: number; // minutes / 60 / hoursPerDay
  count: number; // entry count
}

export interface EarningsGroup {
  id: string;
  name: string;
  color: string; // customer color (own, or owning customer's color for a project)
  minutes: number;
  earn: number;
  sharePct: number; // 0-100 of total earn (0 when total earn is 0)
}

// Value of one entry: project entries are prorated day rates; service entries
// use their flat rate for the entry date regardless of duration.
export function entryEarnValue(
  entry: Entry,
  project: Project | undefined,
  service: Service | undefined,
  hoursPerDay: number,
): number {
  if (entry.kind === 'customer') {
    return entry.amount ?? 0;
  }
  if (entry.kind === 'service') {
    return service ? rateForDate(service.rates, entry.date) : 0;
  }
  if (!project) {
    return 0;
  }
  return ((entry.minutes / 60) / hoursPerDay) * rateForDate(project.rates, entry.date);
}

// AND-composed filter: inclusive date range, plus optional customer/project.
export function filterEntries(entries: Entry[], projects: Project[], _services: Service[], filter: EarningsFilter): Entry[] {
  const projById: Record<string, Project> = {};
  projects.forEach((project) => {
    projById[project.id] = project;
  });

  return entries.filter((entry) => {
    if (entry.date < filter.fromISO || entry.date > filter.toISO) {
      return false;
    }
    if (filter.projectId && (entry.kind !== 'project' || entry.projectId !== filter.projectId)) {
      return false;
    }
    if (filter.customerId) {
      const customerId = entry.kind === 'project' ? projById[entry.projectId ?? '']?.customerId : entry.customerId;
      if (customerId !== filter.customerId) {
        return false;
      }
    }
    return true;
  });
}

export function summarize(
  entries: Entry[],
  projById: Record<string, Project>,
  serviceById: Record<string, Service>,
  hoursPerDay: number,
): EarningsSummary {
  const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const earn = entries.reduce(
    (sum, entry) => sum + entryEarnValue(entry, projById[entry.projectId ?? ''], serviceById[entry.serviceId ?? ''], hoursPerDay),
    0,
  );
  return {
    minutes,
    earn,
    days: minutes / 60 / hoursPerDay,
    count: entries.length,
  };
}

// groupBy 'customer' buckets by owning customer; 'project' buckets by project
// or service.
// Rows are sorted by earnings descending. sharePct is computed against the
// summed earn of all returned rows (0 when the total is 0).
export function aggregateBy(
  entries: Entry[],
  projects: Project[],
  services: Service[],
  customers: Customer[],
  groupBy: 'customer' | 'project',
  hoursPerDay: number,
): EarningsGroup[] {
  const projById: Record<string, Project> = {};
  projects.forEach((project) => {
    projById[project.id] = project;
  });
  const serviceById: Record<string, Service> = {};
  services.forEach((service) => {
    serviceById[service.id] = service;
  });
  const custById: Record<string, Customer> = {};
  customers.forEach((customer) => {
    custById[customer.id] = customer;
  });

  const buckets = new Map<string, EarningsGroup>();

  entries.forEach((entry) => {
    const project = projById[entry.projectId ?? ''];
    const service = serviceById[entry.serviceId ?? ''];
    const entryCustomerId = entry.kind === 'project' ? project?.customerId : (entry.customerId ?? undefined);
    const customer = custById[entryCustomerId ?? ''];
    const id = groupBy === 'customer'
      ? (customer?.id ?? (entry.customerId ?? entry.projectId ?? entry.serviceId ?? entry.id))
      : (entry.kind === 'service'
          ? `service:${entry.serviceId ?? entry.id}`
          : entry.kind === 'customer'
            ? `customer-fee:${entry.customerId ?? entry.id}`
            : (entry.projectId ?? entry.id));
    const name = groupBy === 'customer'
      ? (customer?.name ?? 'Unknown')
      : (entry.kind === 'service'
          ? (service?.name ?? 'Unknown service')
          : entry.kind === 'customer'
            ? (customer?.name ?? 'Unknown customer')
            : (project?.name ?? 'Unknown'));
    const color = customer?.color ?? '#9ca3af';

    const existing = buckets.get(id);
    const minutes = entry.minutes;
    const earn = entryEarnValue(entry, project, service, hoursPerDay);

    if (existing) {
      existing.minutes += minutes;
      existing.earn += earn;
    } else {
      buckets.set(id, { id, name, color, minutes, earn, sharePct: 0 });
    }
  });

  const rows = Array.from(buckets.values());
  const totalEarn = rows.reduce((sum, row) => sum + row.earn, 0);
  rows.forEach((row) => {
    row.sharePct = totalEarn > 0 ? (row.earn / totalEarn) * 100 : 0;
  });

  return rows.sort((a, b) => b.earn - a.earn);
}

// ─── earnings-over-time chart data ───────────────────────────────────────────

const CHART_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export interface ChartSeries {
  id: string;
  name: string;
  color: string;
  values: number[]; // earn per X point, aligned with xPoints
}

export interface ChartData {
  xPoints: string[];    // 'yyyy-mm-dd' (day granularity) or 'yyyy-mm' (month)
  xLabels: string[];    // short display labels for X axis
  series: ChartSeries[];
  granularity: 'day' | 'month';
}

// Builds a time-series chart data structure from already-filtered entries.
// Uses day granularity when the span is ≤35 days, month granularity otherwise.
// Produces one line per customer (using their color) plus an optional
// "Services" line for service entries that don't belong to a customer.
export function buildChartData(
  entries: Entry[],
  projects: Project[],
  services: Service[],
  customers: Customer[],
  hoursPerDay: number,
  fromISO: string,
  toISO: string,
): ChartData {
  const from = parseISO(fromISO);
  const to = parseISO(toISO);
  const diffDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const granularity: 'day' | 'month' = diffDays <= 35 ? 'day' : 'month';

  // Build the X axis — every day or every month in [fromISO, toISO].
  const xPoints: string[] = [];
  const xLabels: string[] = [];

  if (granularity === 'day') {
    const cur = new Date(from);
    while (iso(cur) <= toISO) {
      xPoints.push(iso(cur));
      xLabels.push(String(cur.getDate()));
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    const toKey = `${to.getFullYear()}-${pad(to.getMonth() + 1)}`;
    const cur = new Date(from.getFullYear(), from.getMonth(), 1, 12);
    for (;;) {
      const key = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}`;
      xPoints.push(key);
      xLabels.push(CHART_MONTHS[cur.getMonth()]);
      if (key >= toKey) break;
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  // Lookup maps
  const projById: Record<string, Project> = {};
  projects.forEach(p => { projById[p.id] = p; });
  const svcById: Record<string, Service> = {};
  services.forEach(s => { svcById[s.id] = s; });

  // Accumulate earn per (seriesId, xKey).
  const earnMap = new Map<string, Record<string, number>>();
  const addEarn = (seriesId: string, xKey: string, value: number) => {
    if (value === 0) return;
    const bucket = earnMap.get(seriesId) ?? {};
    bucket[xKey] = (bucket[xKey] ?? 0) + value;
    earnMap.set(seriesId, bucket);
  };

  entries.forEach(entry => {
    const xKey = granularity === 'day' ? entry.date : entry.date.slice(0, 7);
    const proj = projById[entry.projectId ?? ''];
    const svc = svcById[entry.serviceId ?? ''];
    const value = entryEarnValue(entry, proj, svc, hoursPerDay);

    if (entry.kind === 'service') {
      addEarn('__services__', xKey, value);
    } else if (entry.kind === 'customer') {
      addEarn(entry.customerId ?? '__unknown__', xKey, value);
    } else {
      addEarn(proj?.customerId ?? '__unknown__', xKey, value);
    }
  });

  // One series per customer that has data, sorted by total earnings desc.
  const series: ChartSeries[] = [];
  customers.forEach(c => {
    const byKey = earnMap.get(c.id);
    if (!byKey) return;
    series.push({ id: c.id, name: c.name, color: c.color, values: xPoints.map(k => byKey[k] ?? 0) });
  });
  series.sort((a, b) =>
    b.values.reduce((s, v) => s + v, 0) - a.values.reduce((s, v) => s + v, 0),
  );

  // Append a pseudo-series for service entries (no owning customer).
  const svcByKey = earnMap.get('__services__');
  if (svcByKey) {
    series.push({
      id: '__services__',
      name: 'Services',
      color: '#9ca3af',
      values: xPoints.map(k => svcByKey[k] ?? 0),
    });
  }

  return { xPoints, xLabels, series, granularity };
}
