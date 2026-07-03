import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties, type FC } from 'react';

import type { EarningsRowVM, EarningsViewProps } from '../types';
import { daysInMonth, defaultExportPeriod, fmtMonthYear, fmtShortDateYear, monthBounds, parseISO, quarterBounds, yearBounds } from '../lib/dates';
import { fmtEUR, fmtH } from '../lib/format';
import { aggregateBy, buildChartData, filterEntries, summarize } from '../lib/earnings';
import EarningsChart from './EarningsChart';

const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e9ebef',
  borderRadius: '14px',
  padding: '22px',
};

const labelStyle: CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 500, color: '#626873', marginBottom: '6px' };

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d7dadf',
  borderRadius: '9px',
  fontSize: '14px',
  color: '#1a1c20',
  background: '#fff',
  outline: 'none',
};

const pillGroupStyle: CSSProperties = {
  display: 'flex',
  gap: '2px',
  background: '#f0f1f4',
  borderRadius: '9px',
  padding: '3px',
};

function pillStyle(active: boolean): CSSProperties {
  return {
    padding: '8px 14px',
    minHeight: '36px',
    borderRadius: '7px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: active ? 600 : 500,
    background: active ? '#ffffff' : 'transparent',
    color: active ? '#1a1c20' : '#626873',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
  };
}

type Preset = 'month' | 'quarter' | 'year' | 'custom';
type GroupBy = 'customer' | 'project';

const EarningsView: FC<EarningsViewProps> = ({ customers, projects, services, entries, hoursPerDay, initialFilter, onBack }) => {
  const today = useMemo(() => new Date(), []);
  const defaultPeriod = useMemo(() => defaultExportPeriod(today), [today]);

  const [preset, setPreset] = useState<Preset>('month');
  const [fromISO, setFromISO] = useState(defaultPeriod.from);
  const [toISO, setToISO] = useState(defaultPeriod.to);
  const [customerId, setCustomerId] = useState(initialFilter?.customerId ?? '');
  const [projectId, setProjectId] = useState(initialFilter?.projectId ?? '');
  const [groupBy, setGroupBy] = useState<GroupBy>('customer');

  // Re-sync when a new filter is pushed in (e.g. "View earnings" clicked from
  // a customer/project detail page).
  useEffect(() => {
    if (initialFilter) {
      setCustomerId(initialFilter.customerId ?? '');
      setProjectId(initialFilter.projectId ?? '');
    }
  }, [initialFilter]);

  const applyPreset = (next: Preset) => {
    setPreset(next);
    if (next === 'month') {
      const bounds = monthBounds(today);
      setFromISO(bounds.from);
      setToISO(bounds.to);
    } else if (next === 'quarter') {
      const bounds = quarterBounds(today);
      setFromISO(bounds.from);
      setToISO(bounds.to);
    } else if (next === 'year') {
      const bounds = yearBounds(today);
      setFromISO(bounds.from);
      setToISO(bounds.to);
    }
  };

  const projectsForCustomer = useMemo(
    () => (customerId ? projects.filter((project) => project.customerId === customerId) : projects),
    [customerId, projects],
  );

  // Clear the project filter if it no longer belongs to the selected customer.
  useEffect(() => {
    if (projectId && !projectsForCustomer.some((project) => project.id === projectId)) {
      setProjectId('');
    }
  }, [projectId, projectsForCustomer]);

  const filteredEntries = useMemo(
    () =>
      filterEntries(entries, projects, services, {
        fromISO,
        toISO,
        customerId: customerId || null,
        projectId: projectId || null,
      }),
    [customerId, entries, fromISO, projectId, projects, services, toISO],
  );

  const projById = useMemo(() => {
    const map: Record<string, (typeof projects)[number]> = {};
    projects.forEach((project) => {
      map[project.id] = project;
    });
    return map;
  }, [projects]);

  const serviceById = useMemo(() => {
    const map: Record<string, (typeof services)[number]> = {};
    services.forEach((service) => {
      map[service.id] = service;
    });
    return map;
  }, [services]);

  const summary = useMemo(() => summarize(filteredEntries, projById, serviceById, hoursPerDay), [filteredEntries, hoursPerDay, projById, serviceById]);

  const rows = useMemo<EarningsRowVM[]>(() => {
    const groups = aggregateBy(filteredEntries, projects, services, customers, groupBy, hoursPerDay);
    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      dotStyle: { width: '10px', height: '10px', borderRadius: '3px', background: group.color, flexShrink: 0 },
      hours: fmtH(group.minutes),
      days: (group.minutes / 60 / hoursPerDay).toFixed(1),
      earn: fmtEUR(group.earn),
      share: `${Math.round(group.sharePct)}%`,
    }));
  }, [customers, filteredEntries, groupBy, hoursPerDay, projects, services]);

  const chartData = useMemo(
    () => buildChartData(filteredEntries, projects, services, customers, hoursPerDay, fromISO, toISO),
    [filteredEntries, projects, services, customers, hoursPerDay, fromISO, toISO],
  );

  const periodLabel = useMemo(() => {
    const from = parseISO(fromISO);
    const to = parseISO(toISO);
    const isFullMonth = from.getDate() === 1
      && to.getFullYear() === from.getFullYear()
      && to.getMonth() === from.getMonth()
      && to.getDate() === daysInMonth(from.getFullYear(), from.getMonth());
    return isFullMonth ? fmtMonthYear(from) : `${fmtShortDateYear(from)} – ${fmtShortDateYear(to)}`;
  }, [fromISO, toISO]);

  const handleCustomerChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setCustomerId(event.target.value);
  };

  const handleProjectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setProjectId(event.target.value);
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '26px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 600, letterSpacing: '-0.03em' }}>Earnings</div>
            <div style={{ marginTop: '4px', fontSize: '13px', color: '#626873' }}>{periodLabel}</div>
          </div>
          <button
            type="button"
            style={{ height: '40px', padding: '0 18px', border: '1px solid #e2e4e8', background: '#fff', color: '#3a3f48', borderRadius: '9px', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}
            onClick={onBack}
          >
            ← Back
          </button>
        </div>

        <section style={cardStyle}>
          <div className="pill-group" style={pillGroupStyle}>
            <button type="button" style={pillStyle(preset === 'month')} onClick={() => applyPreset('month')}>This month</button>
            <button type="button" style={pillStyle(preset === 'quarter')} onClick={() => applyPreset('quarter')}>This quarter</button>
            <button type="button" style={pillStyle(preset === 'year')} onClick={() => applyPreset('year')}>This year</button>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={labelStyle}>Customer</label>
              <select style={inputStyle} value={customerId} onChange={handleCustomerChange}>
                <option value="">All customers</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={labelStyle}>Project</label>
              <select style={inputStyle} value={projectId} onChange={handleProjectChange}>
                <option value="">All projects</option>
                {projectsForCustomer.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={labelStyle}>From</label>
              <input
                type="date"
                style={inputStyle}
                value={fromISO}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setPreset('custom');
                  setFromISO(event.target.value);
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={labelStyle}>To</label>
              <input
                type="date"
                style={inputStyle}
                value={toISO}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setPreset('custom');
                  setToISO(event.target.value);
                }}
              />
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Earnings</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '3px' }}>{fmtEUR(summary.earn)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hours</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '3px' }}>{fmtH(summary.minutes)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Days</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '3px' }}>{summary.days.toFixed(1)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entries</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '3px' }}>{summary.count}</div>
            </div>
          </div>
        </section>

        {chartData.series.length > 0 && (
          <section style={cardStyle}>
            <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>
              Earnings over time
              <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {chartData.granularity === 'day' ? 'per day' : 'per month'}
              </span>
            </div>
            <EarningsChart data={chartData} />
          </section>
        )}

        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>Breakdown</div>
            <div className="pill-group" style={pillGroupStyle}>
              <button type="button" style={pillStyle(groupBy === 'customer')} onClick={() => setGroupBy('customer')}>By customer</button>
              <button type="button" style={pillStyle(groupBy === 'project')} onClick={() => setGroupBy('project')}>By project</button>
            </div>
          </div>

          <div
            className="earnings-breakdown-header"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,2.2fr) 1fr 0.8fr 1.1fr 0.7fr',
              gap: '16px',
              padding: '0 4px 10px',
              fontSize: '11px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: '#9ca3af',
              fontFamily: "'Geist Mono',monospace",
            }}
          >
            <div>{groupBy === 'customer' ? 'Customer' : 'Project'}</div>
            <div style={{ textAlign: 'right' }}>Hours</div>
            <div style={{ textAlign: 'right' }}>Days</div>
            <div style={{ textAlign: 'right' }}>Earnings</div>
            <div style={{ textAlign: 'right' }}>Share</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rows.map((row) => (
              <div
                key={row.id}
                className="earnings-breakdown-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,2.2fr) 1fr 0.8fr 1.1fr 0.7fr',
                  gap: '16px',
                  alignItems: 'center',
                  padding: '14px 16px',
                  background: '#fbfcfd',
                  border: '1px solid #eef0f3',
                  borderRadius: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={row.dotStyle} />
                  <span style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.name}
                  </span>
                </div>
                <div style={{ textAlign: 'right', fontSize: '13px', color: '#626873', fontFamily: "'Geist Mono',monospace" }}>{row.hours}</div>
                <div style={{ textAlign: 'right', fontSize: '13px', color: '#626873', fontFamily: "'Geist Mono',monospace" }}>{row.days}</div>
                <div style={{ textAlign: 'right', fontSize: '14px', fontWeight: 600, fontFamily: "'Geist Mono',monospace" }}>{row.earn}</div>
                <div style={{ textAlign: 'right', fontSize: '13px', color: '#626873', fontFamily: "'Geist Mono',monospace" }}>{row.share}</div>
              </div>
            ))}
          </div>

          {rows.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
              No earnings in this period.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default EarningsView;
