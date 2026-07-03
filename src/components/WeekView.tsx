import type { FC } from 'react'
import type { WeekViewProps } from '../types'

const WeekView: FC<WeekViewProps> = ({ weekDays, gutterStyle, hourRows }) => {
  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#ffffff' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          display: 'flex',
          background: '#ffffff',
          borderBottom: '1px solid #e9ebef',
        }}
      >
        <div style={{ width: '64px', flexShrink: 0 }}></div>
        {weekDays.map((day) => (
          <div
            key={day.iso}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '9px 4px 11px',
              cursor: 'pointer',
              borderLeft: '1px solid #f0f1f4',
            }}
            onClick={day.onHeaderClick}
          >
            <div
              style={{
                fontSize: '11px',
                letterSpacing: '0.07em',
                color: '#9ca3af',
                fontFamily: "'Geist Mono',monospace",
              }}
            >
              {day.dow}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3px' }}>
              <span style={day.numStyle}>{day.dayNum}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex' }}>
        <div style={gutterStyle}>
          {hourRows.map((hourRow, index) => (
            <div key={`${hourRow.label}-${index}`} style={hourRow.style}>
              {hourRow.label}
            </div>
          ))}
        </div>
        {weekDays.map((day) => (
          <div key={day.iso} style={day.colStyle} onMouseDown={day.onMouseDown}>
            {day.entries.map((entry) => (
              <div
                key={entry.id}
                className="entry-block"
                style={entry.style}
                onClick={entry.onClick}
                onMouseDown={entry.stop}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '12px',
                    lineHeight: 1.25,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {entry.projectName}
                </div>
                <div style={{ fontSize: '10.5px', color: '#6b7280', fontFamily: "'Geist Mono',monospace" }}>
                  {entry.timeLabel}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#8a909a',
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.comment}
                </div>
              </div>
            ))}
            {day.drag && (
              <div style={day.drag}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#fff', fontFamily: "'Geist Mono',monospace" }}>
                  {day.dragLabel}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default WeekView
