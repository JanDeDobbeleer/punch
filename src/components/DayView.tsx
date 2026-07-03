import type { FC } from 'react'
import type { DayViewProps } from '../types'

const DayView: FC<DayViewProps> = ({ dayData, gutterStyle, hourRows, accent }) => {
  return (
    <div className="day-view-shell" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', background: '#ffffff', borderRight: '1px solid #e9ebef' }}>
        <div style={{ display: 'flex' }}>
          <div style={gutterStyle}>
            {hourRows.map((hourRow, index) => (
              <div key={`${hourRow.label}-${index}`} style={hourRow.style}>
                {hourRow.label}
              </div>
            ))}
          </div>
          <div style={dayData.colStyle} onPointerDown={dayData.onPointerDown}>
            {dayData.entries.map((entry) => (
              <div
                key={entry.id}
                className="entry-block"
                style={entry.style}
                onClick={entry.onClick}
                onPointerDown={entry.stop}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.25 }}>{entry.projectName}</div>
                <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: "'Geist Mono',monospace" }}>
                  {entry.timeLabel}
                </div>
                <div style={{ fontSize: '12px', color: '#8a909a', lineHeight: 1.35 }}>{entry.comment}</div>
              </div>
            ))}
            {dayData.drag && (
              <div style={dayData.drag}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#fff', fontFamily: "'Geist Mono',monospace" }}>
                  {dayData.dragLabel}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <aside
        className="day-view-aside"
        style={{
          width: '312px',
          flexShrink: 0,
          background: '#fbfcfd',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      >
        <div style={{ padding: '22px 22px 18px', borderBottom: '1px solid #eef0f3' }}>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#9ca3af',
              fontFamily: "'Geist Mono',monospace",
            }}
          >
            Day total
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '7px' }}>
            <span style={{ fontSize: '30px', fontWeight: 600, letterSpacing: '-0.02em' }}>{dayData.totalH}</span>
            <span style={{ fontSize: '14px', color: '#9ca3af', fontFamily: "'Geist Mono',monospace" }}>
              / {dayData.totalDays}d
            </span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '15px', fontWeight: 600, fontFamily: "'Geist Mono',monospace", color: accent }}>
            {dayData.totalEarn}
          </div>
        </div>
        <div style={{ padding: '14px 14px 22px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {dayData.list.map((row) => (
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
              <div style={row.dotStyle}></div>
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
                  {row.projectName}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#6b7280',
                    fontFamily: "'Geist Mono',monospace",
                    marginTop: '1px',
                  }}
                >
                  {row.timeLabel}
                </div>
                <div style={{ fontSize: '12px', color: '#8a909a', marginTop: '3px', lineHeight: 1.35 }}>
                  {row.comment}
                </div>
              </div>
            </div>
          ))}
          {dayData.empty && (
            <div style={{ textAlign: 'center', padding: '34px 14px', color: '#9ca3af', fontSize: '13px', lineHeight: 1.5 }}>
              No hours logged.
              <br />
              Click and drag on the grid to add some.
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

export default DayView
