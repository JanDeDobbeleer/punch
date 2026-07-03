import type { FC } from 'react';

import type { CustomerDetailViewProps } from '../types';

const CustomerDetailView: FC<CustomerDetailViewProps> = ({
  customerName,
  onNameChange,
  hours,
  earn,
  projectRows,
  projEmpty,
  canDelete,
  color,
  colorSwatches,
  onCustomColorChange,
  inputStyle,
  labelStyle,
  btnPrimaryLg,
  onBack,
  onNewProject,
  onDeleteCustomer,
  onExport,
}) => (
  <div style={{ flex: 1, overflow: 'auto', padding: '26px' }}>
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 500,
          color: '#626873',
          padding: '0 0 18px',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 6l-6 6 6 6"></path>
        </svg>
        Back to customers
      </button>

      <div
        style={{
          background: '#fff',
          border: '1px solid #e9ebef',
          borderRadius: '14px',
          padding: '22px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={labelStyle}>Customer name</label>
            <input type="text" style={inputStyle} value={customerName} onChange={onNameChange} />
          </div>

          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Logged
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '3px' }}>{hours}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Earnings
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '3px' }}>{earn}</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <label style={labelStyle}>Colour</label>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '10px' }}>
            Projects for this customer inherit this colour.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
            {colorSwatches.map((swatch) => (
              <button key={swatch.color} style={swatch.style} onClick={swatch.onClick} />
            ))}
            <label
              title="Custom colour"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '9px',
                overflow: 'hidden',
                border: '1px solid #d7dadf',
                cursor: 'pointer',
                display: 'block',
                position: 'relative',
              }}
            >
              <input
                type="color"
                value={color}
                onChange={onCustomColorChange}
                style={{
                  position: 'absolute',
                  inset: '-4px',
                  width: 'calc(100% + 8px)',
                  height: 'calc(100% + 8px)',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>Projects</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onExport}
            style={{
              height: '34px',
              padding: '0 16px',
              border: '1px solid #d7dadf',
              background: '#fff',
              borderRadius: '9px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: '#3a3f48',
            }}
          >
            Export timesheet
          </button>
          <button type="button" style={btnPrimaryLg} onClick={onNewProject}>
            + New project
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {projectRows.map((row) => (
          <div
            key={row.id}
            className="project-row"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,2fr) 1fr 1fr 1fr',
              gap: '16px',
              alignItems: 'center',
              padding: '16px 18px',
              background: '#fff',
              border: '1px solid #e9ebef',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
            onClick={row.onClick}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div style={row.dotStyle} />
              <span style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {row.name}
              </span>
            </div>
            <div style={{ textAlign: 'right', fontSize: '13px' }}>{row.currentRate}</div>
            <div style={{ textAlign: 'right', fontSize: '13px', color: '#626873' }}>{row.hours}</div>
            <div style={{ textAlign: 'right', fontSize: '14px', fontWeight: 600 }}>{row.earn}</div>
          </div>
        ))}

        {projEmpty && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
            No projects yet for this customer.
          </div>
        )}
      </div>

      {canDelete && (
        <div style={{ marginTop: '28px', paddingTop: '18px', borderTop: '1px solid #eef0f3' }}>
          <button
            type="button"
            onClick={onDeleteCustomer}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              color: '#dc2626',
              padding: '8px 4px',
            }}
          >
            Delete customer
          </button>
        </div>
      )}
    </div>
  </div>
);

export default CustomerDetailView;
