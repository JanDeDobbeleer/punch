import { useEffect, useMemo, useState, type CSSProperties, type ChangeEvent, type FC } from 'react';

import type { ExportViewProps, ExportScope } from '../types';
import { daysInMonth, defaultExportPeriod, fmtMonthYear, fmtShortDateYear, parseISO } from '../lib/dates';
import { fmtEUR, fmtH } from '../lib/format';
import { rateForDate } from '../lib/rates';
import { buildAttachmentsZip, buildTimesheetPdf, triggerDownload, type TimesheetExportEntry } from '../lib/timesheetExport';

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

const primaryButtonStyle: CSSProperties = {
  height: '40px',
  padding: '0 18px',
  border: 'none',
  background: '#1a1c20',
  color: '#fff',
  borderRadius: '9px',
  cursor: 'pointer',
  fontSize: '13.5px',
  fontWeight: 600,
};

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'export';
}

const ExportView: FC<ExportViewProps> = ({ customers, projects, entries, hoursPerDay, initialScope, onBack }) => {
  const today = useMemo(() => new Date(), []);
  const defaultPeriod = useMemo(() => defaultExportPeriod(today), [today]);

  const [scopeType, setScopeType] = useState<ExportScope['type']>(initialScope?.type ?? 'customer');
  const [scopeId, setScopeId] = useState<string>(initialScope?.id ?? customers[0]?.id ?? '');
  const [fromISO, setFromISO] = useState(defaultPeriod.from);
  const [toISO, setToISO] = useState(defaultPeriod.to);
  const [busy, setBusy] = useState<'pdf' | 'zip' | null>(null);
  const [message, setMessage] = useState('');

  // Re-sync scope when a new one is pushed in (e.g. "Export" clicked from a
  // different customer/project detail page).
  useEffect(() => {
    if (initialScope) {
      setScopeType(initialScope.type);
      setScopeId(initialScope.id);
    }
  }, [initialScope]);

  const customerById = useMemo(() => {
    const map = new Map(customers.map((customer) => [customer.id, customer]));
    return map;
  }, [customers]);

  const projectsForScope = useMemo(() => {
    if (scopeType === 'customer') {
      return projects.filter((project) => project.customerId === scopeId);
    }
    const project = projects.find((item) => item.id === scopeId);
    return project ? [project] : [];
  }, [projects, scopeId, scopeType]);

  const matchingEntries = useMemo<TimesheetExportEntry[]>(() => {
    const projectIds = new Set(projectsForScope.map((project) => project.id));
    return entries
      .filter((entry) => projectIds.has(entry.projectId) && entry.date >= fromISO && entry.date <= toISO)
      .map((entry) => {
        const project = projects.find((item) => item.id === entry.projectId);
        const customer = project ? customerById.get(project.customerId) : undefined;
        return project && customer ? { entry, project, customer } : null;
      })
      .filter((item): item is TimesheetExportEntry => item !== null)
      .sort((a, b) => a.entry.date.localeCompare(b.entry.date));
  }, [customerById, entries, fromISO, projects, projectsForScope, toISO]);

  const totalMinutes = matchingEntries.reduce((sum, item) => sum + (item.entry.end - item.entry.start), 0);
  const totalAmount = matchingEntries.reduce(
    (sum, item) => sum + (((item.entry.end - item.entry.start) / 60) / hoursPerDay) * rateForDate(item.project.rates, item.entry.date),
    0,
  );
  const attachmentCount = matchingEntries.reduce((sum, item) => sum + item.entry.attachments.length, 0);

  const periodLabel = useMemo(() => {
    const from = parseISO(fromISO);
    const to = parseISO(toISO);
    const isFullMonth = from.getDate() === 1
      && to.getFullYear() === from.getFullYear()
      && to.getMonth() === from.getMonth()
      && to.getDate() === daysInMonth(from.getFullYear(), from.getMonth());
    return isFullMonth ? fmtMonthYear(from) : `${fmtShortDateYear(from)} – ${fmtShortDateYear(to)}`;
  }, [fromISO, toISO]);

  const scopeLabel = useMemo(() => {
    if (scopeType === 'customer') {
      return customerById.get(scopeId)?.name ?? '';
    }
    const project = projects.find((item) => item.id === scopeId);
    const customer = project ? customerById.get(project.customerId) : undefined;
    return project ? `${customer?.name ?? ''} — ${project.name}` : '';
  }, [customerById, projects, scopeId, scopeType]);

  const fileBaseName = useMemo(() => {
    const monthPart = fromISO.slice(0, 7);
    return scopeLabel ? `${slug(scopeLabel)}_${monthPart}` : `export_${monthPart}`;
  }, [fromISO, scopeLabel]);

  const handleGeneratePdf = async () => {
    setMessage('');
    setBusy('pdf');
    try {
      const bytes = await buildTimesheetPdf({ scopeLabel, periodLabel, hoursPerDay, entries: matchingEntries });
      triggerDownload(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }), `${fileBaseName}_Timesheet.pdf`);
    } catch {
      setMessage('Failed to generate the PDF.');
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadZip = async () => {
    setMessage('');
    setBusy('zip');
    try {
      const blob = await buildAttachmentsZip(matchingEntries);
      if (!blob) {
        setMessage('No attachments found for this period.');
        return;
      }
      triggerDownload(blob, `${fileBaseName}_Attachments.zip`);
    } catch {
      setMessage('Failed to download attachments. Check the storage account CORS settings.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '26px' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 600, letterSpacing: '-0.03em' }}>Export timesheet</div>
            <div style={{ marginTop: '4px', fontSize: '13px', color: '#626873' }}>
              Generate a branded PDF timesheet and a zip of attachments to send with an invoice.
            </div>
          </div>
          <button type="button" style={{ ...primaryButtonStyle, background: '#fff', border: '1px solid #e2e4e8', color: '#3a3f48' }} onClick={onBack}>
            ← Back
          </button>
        </div>

        <section style={cardStyle}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={labelStyle}>Scope</label>
              <select
                style={inputStyle}
                value={scopeType}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                  const nextType = event.target.value as ExportScope['type'];
                  setScopeType(nextType);
                  setScopeId(nextType === 'customer' ? (customers[0]?.id ?? '') : (projects[0]?.id ?? ''));
                }}
              >
                <option value="customer">Customer</option>
                <option value="project">Project</option>
              </select>
            </div>

            <div style={{ flex: 2, minWidth: '220px' }}>
              <label style={labelStyle}>{scopeType === 'customer' ? 'Customer' : 'Project'}</label>
              <select style={inputStyle} value={scopeId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setScopeId(event.target.value)}>
                {(scopeType === 'customer' ? customers : projects).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={labelStyle}>From</label>
              <input type="date" style={inputStyle} value={fromISO} onChange={(event: ChangeEvent<HTMLInputElement>) => setFromISO(event.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={labelStyle}>To</label>
              <input type="date" style={inputStyle} value={toISO} onChange={(event: ChangeEvent<HTMLInputElement>) => setToISO(event.target.value)} />
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entries</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '3px' }}>{matchingEntries.length}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hours</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '3px' }}>{fmtH(totalMinutes)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '3px' }}>{fmtEUR(totalAmount)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attachments</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '3px' }}>{attachmentCount}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
            <button type="button" style={primaryButtonStyle} onClick={() => void handleGeneratePdf()} disabled={busy !== null || matchingEntries.length === 0}>
              {busy === 'pdf' ? 'Generating…' : 'Generate PDF'}
            </button>
            <button
              type="button"
              style={{ ...primaryButtonStyle, background: '#fff', border: '1px solid #e2e4e8', color: '#3a3f48' }}
              onClick={() => void handleDownloadZip()}
              disabled={busy !== null || attachmentCount === 0}
            >
              {busy === 'zip' ? 'Zipping…' : 'Download attachments (.zip)'}
            </button>
          </div>

          {message && <div style={{ marginTop: '12px', fontSize: '13px', color: '#dc2626' }}>{message}</div>}
        </section>
      </div>
    </div>
  );
};

export default ExportView;
