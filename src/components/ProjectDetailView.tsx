import type { FC } from 'react';

import type { ProjectDetailViewProps } from '../types';

const ProjectDetailView: FC<ProjectDetailViewProps> = ({
  isNew,
  saveLabel,
  projectName,
  customerId,
  hours,
  earn,
  canDelete,
  custOpts,
  rateRows,
  newRateAmount,
  newRateFrom,
  inputStyle,
  labelStyle,
  btnPrimaryLg,
  onNameChange,
  onCustomerChange,
  onNewRateAmountChange,
  onNewRateFromChange,
  onAddRate,
  onSave,
  onDelete,
  onBack,
  onExport,
}) => (
  <div style={{ flex: 1, overflow: 'auto', padding: '26px' }}>
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
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
        Back
      </button>

      <div style={{ background: '#fff', border: '1px solid #e9ebef', borderRadius: '14px', padding: '22px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '220px' }}>
              <label style={labelStyle}>Project name</label>
              <input
                type="text"
                style={inputStyle}
                placeholder="e.g. Website Redesign"
                value={projectName}
                onChange={onNameChange}
              />
            </div>

            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={labelStyle}>Customer</label>
              <select style={inputStyle} value={customerId} onChange={onCustomerChange}>
                {custOpts.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!isNew && (
            <div style={{ display: 'flex', gap: '24px', paddingTop: '4px' }}>
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
          )}

          <div>
            <label style={labelStyle}>Rate history (€/day)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rateRows.map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr auto',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="number"
                    min="0"
                    step="10"
                    style={inputStyle}
                    value={row.amount}
                    onChange={row.onAmountChange}
                  />
                  <input type="date" style={inputStyle} value={row.from} onChange={row.onFromChange} />
                  <input
                    type="date"
                    style={inputStyle}
                    value={row.to}
                    placeholder={row.isCurrent ? 'current' : ''}
                    onChange={row.onToChange}
                  />
                  <button
                    type="button"
                    onClick={row.onDelete}
                    disabled={rateRows.length <= 1}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: rateRows.length <= 1 ? '#c4c8ce' : '#dc2626',
                      cursor: rateRows.length <= 1 ? 'default' : 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginTop: '10px' }}>
              <input
                type="number"
                min="0"
                step="10"
                style={inputStyle}
                placeholder="New rate"
                value={newRateAmount}
                onChange={onNewRateAmountChange}
              />
              <input type="date" style={inputStyle} value={newRateFrom} onChange={onNewRateFromChange} />
              <button
                type="button"
                onClick={onAddRate}
                style={{
                  border: '1px solid #d7dadf',
                  background: '#fff',
                  borderRadius: '9px',
                  padding: '0 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Add rate
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '26px' }}>
          {canDelete ? (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={onDelete}
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
                Delete project
              </button>
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
            </div>
          ) : (
            <span />
          )}

          <button type="button" style={btnPrimaryLg} onClick={onSave}>
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default ProjectDetailView;
