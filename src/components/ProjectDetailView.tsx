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
  entryRows,
  entriesEmpty,
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
  onViewEarnings,
  budget,
  budgetSpentLabel,
  budgetPct,
  onBudgetChange,
  closed,
  effectivelyClosed,
  onToggleClosed,
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

      {effectivelyClosed && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          marginBottom: '14px',
          background: '#f9fafb',
          border: '1px solid #e9ebef',
          borderRadius: '10px',
          fontSize: '13px',
          color: '#626873',
        }}>
          <span style={{ fontSize: '15px' }}>🔒</span>
          <span>
            {closed
              ? 'This project is closed. No new entries can be booked against it.'
              : 'This project is closed because its budget cap has been reached.'}
          </span>
        </div>
      )}

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

            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={labelStyle}>Budget cap (€)</label>
              <input
                type="number"
                min="0"
                step="100"
                style={inputStyle}
                placeholder="optional"
                value={budget}
                onChange={onBudgetChange}
              />
            </div>
          </div>

          {!isNew && (
            <div style={{ display: 'flex', gap: '24px', paddingTop: '4px', flexWrap: 'wrap' }}>
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
              {budgetPct !== null && (
                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Budget
                  </div>
                  <div style={{ display: 'inline-block' }}>
                    <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '3px', color: budgetPct >= 100 ? '#dc2626' : '#1a1c20', fontFamily: "'Geist Mono',monospace" }}>
                      {budgetSpentLabel}
                    </div>
                    <div style={{ marginTop: '6px', height: '4px', borderRadius: '999px', background: '#e9ebef', overflow: 'hidden', width: '100%' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, budgetPct)}%`,
                        borderRadius: '999px',
                        background: budgetPct >= 100 ? '#dc2626' : '#16a34a',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label style={labelStyle}>Rate history (€/day)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rateRows.map((row) => (
                <div
                  key={row.id}
                  className="rate-history-row"
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

            <div className="new-rate-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginTop: '10px' }}>
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {canDelete && (
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
            )}
            {canDelete && (
              <button
                type="button"
                onClick={onToggleClosed}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: closed ? '#16a34a' : '#626873',
                  padding: '8px 4px',
                }}
              >
                {closed ? 'Reopen project' : 'Close project'}
              </button>
            )}
          </div>

          <button type="button" style={btnPrimaryLg} onClick={onSave}>
            {saveLabel}
          </button>
        </div>
      </div>

      {!isNew && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #e9ebef',
            borderRadius: '14px',
            padding: '22px',
            marginTop: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }} className="detail-section-header">
            <div style={{ fontSize: '15px', fontWeight: 600 }}>Timesheet entries</div>
            <div style={{ display: 'flex', gap: '8px' }} className="detail-actions-row">
              <button
                type="button"
                onClick={onViewEarnings}
                style={{
                  height: '38px',
                  padding: '0 20px',
                  border: '1px solid #d7dadf',
                  background: '#fff',
                  borderRadius: '9px',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: '#3a3f48',
                }}
              >
                View earnings
              </button>
              <button
                type="button"
                onClick={onExport}
                style={{
                  height: '38px',
                  padding: '0 20px',
                  border: '1px solid #d7dadf',
                  background: '#fff',
                  borderRadius: '9px',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: '#3a3f48',
                }}
              >
                Export timesheet
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {entryRows.map((row) => (
              <div
                key={row.id}
                className="day-list-row"
                style={{
                  display: 'flex',
                  gap: '11px',
                  padding: '11px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  border: '1px solid #eef0f3',
                  background: '#fff',
                }}
                onClick={row.onClick}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.dateLabel}
                  </div>
                  {row.comment && (
                    <div style={{ fontSize: '12px', color: '#8a909a', marginTop: '3px', lineHeight: 1.35 }}>
                      {row.comment}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: "'Geist Mono',monospace" }}>
                    {row.hoursLabel}
                  </div>
                  <div style={{ fontSize: '12px', color: '#626873', fontFamily: "'Geist Mono',monospace", marginTop: '2px' }}>
                    {row.earnLabel}
                  </div>
                </div>
              </div>
            ))}

            {entriesEmpty && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>
                No timesheet entries yet for this project.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  </div>
);

export default ProjectDetailView;
