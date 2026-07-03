import type { FC } from 'react';

import type { ProjectRowVM, ProjectsViewProps } from '../types';

const ProjectRow: FC<{ row: ProjectRowVM }> = ({ row }) => (
  <div
    key={row.id}
    className="project-row proj-list-row"
    style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0,2.2fr) 1.5fr 1fr 0.9fr 1.1fr',
      gap: '16px',
      alignItems: 'center',
      padding: '16px 18px',
      background: '#fff',
      border: '1px solid #e9ebef',
      borderRadius: '12px',
      cursor: 'pointer',
      opacity: row.isClosed ? 0.65 : 1,
    }}
    onClick={row.onClick}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
      <div style={row.dotStyle} />
      <span
        style={{
          fontSize: '14px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {row.name}
      </span>
      {row.isClosed && (
        <span style={{
          flexShrink: 0,
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#9ca3af',
          background: '#f3f4f6',
          border: '1px solid #e5e7eb',
          borderRadius: '4px',
          padding: '2px 6px',
        }}>
          Closed
        </span>
      )}
    </div>

    <div
      style={{
        fontSize: '13px',
        color: '#626873',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {row.customerName}
    </div>

    <div
      style={{
        textAlign: 'right',
        fontSize: '13px',
        fontFamily: "'Geist Mono',monospace",
      }}
    >
      {row.dayRate}
    </div>

    <div
      style={{
        textAlign: 'right',
        fontSize: '13px',
        color: '#626873',
        fontFamily: "'Geist Mono',monospace",
      }}
    >
      {row.hours}
    </div>

    <div
      style={{
        textAlign: 'right',
        fontFamily: "'Geist Mono',monospace",
      }}
    >
      <div style={{ display: 'inline-block' }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>
          {row.earn}
          {row.budgetCap && (
            <span style={{ fontWeight: 400, color: row.budgetReached ? '#dc2626' : '#9ca3af', fontSize: '12px' }}>
              {' '}{row.budgetCap}
            </span>
          )}
        </div>
        {row.budgetPct !== null && (
          <div style={{ marginTop: '5px', height: '3px', borderRadius: '999px', background: '#e9ebef', overflow: 'hidden', width: '100%' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, row.budgetPct)}%`,
              borderRadius: '999px',
              background: row.budgetReached ? '#dc2626' : '#16a34a',
            }} />
          </div>
        )}
      </div>
    </div>
  </div>
);

const gridHeader = (
  <div
    className="proj-grid-header"
    style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0,2.2fr) 1.5fr 1fr 0.9fr 1.1fr',
      gap: '16px',
      padding: '0 18px 12px',
      fontSize: '11px',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: '#9ca3af',
      fontFamily: "'Geist Mono',monospace",
    }}
  >
    <div>Project</div>
    <div>Customer</div>
    <div style={{ textAlign: 'right' }}>Day rate</div>
    <div style={{ textAlign: 'right' }}>Logged</div>
    <div style={{ textAlign: 'right' }}>Earnings</div>
  </div>
);

const ProjectsView: FC<ProjectsViewProps> = ({ activeRows, closedRows, projEmpty }) => (
  <div style={{ flex: 1, overflow: 'auto', padding: '26px' }}>
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {projEmpty ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', fontSize: '14px' }}>
          No projects yet. Create your first one.
        </div>
      ) : (
        <>
          {activeRows.length > 0 && (
            <div style={{ marginBottom: closedRows.length > 0 ? '32px' : 0 }}>
              {gridHeader}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeRows.map((row) => <ProjectRow key={row.id} row={row} />)}
              </div>
            </div>
          )}

          {closedRows.length > 0 && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '14px',
                color: '#9ca3af',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontFamily: "'Geist Mono',monospace",
              }}>
                <div style={{ flex: 1, height: '1px', background: '#e9ebef' }} />
                <span>Closed · {closedRows.length}</span>
                <div style={{ flex: 1, height: '1px', background: '#e9ebef' }} />
              </div>
              {activeRows.length === 0 && <div style={{ marginBottom: '12px' }}>{gridHeader}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {closedRows.map((row) => <ProjectRow key={row.id} row={row} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  </div>
);

export default ProjectsView;
