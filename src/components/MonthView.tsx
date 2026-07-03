import type { FC } from 'react'
import type { MonthViewProps } from '../types'

const MonthView: FC<MonthViewProps> = ({ monthWeeks, monthDowLabels }) => {
  return (
    <div className="month-grid-wrap" style={{ flex: 1, overflow: 'auto', padding: '22px' }}>
      <div className="month-card" style={{ background: '#fff', border: '1px solid #e9ebef', borderRadius: '14px', overflow: 'hidden' }}>
        <div className="month-dow-row" style={{ display: 'flex', borderBottom: '1px solid #eef0f3' }}>
          {monthDowLabels.map((label, index) => (
            <div
              key={`${label}-${index}`}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '11px 0',
                fontSize: '11px',
                letterSpacing: '0.06em',
                color: '#9ca3af',
                fontFamily: "'Geist Mono',monospace",
                borderLeft: '1px solid #f4f5f7',
              }}
            >
              {label}
            </div>
          ))}
        </div>
        {monthWeeks.map((week, weekIndex) => (
          <div key={weekIndex} className="month-week-row" style={{ display: 'flex', borderBottom: '1px solid #f4f5f7' }}>
            {week.days.map((cell, dayIndex) => (
              <div key={`${weekIndex}-${dayIndex}`} className="month-cell" style={cell.style} onClick={cell.onClick}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={cell.numStyle}>{cell.dayNum}</span>
                </div>
                {cell.hasEntries && (
                  <div style={{ marginTop: 'auto' }}>
                    <div style={{ display: 'flex', gap: '3px', marginBottom: '6px' }}>
                      {cell.dots.map((dot, dotIndex) => (
                        <div key={dotIndex} style={dot.style}></div>
                      ))}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: "'Geist Mono',monospace" }}>
                      {cell.hours}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: "'Geist Mono',monospace" }}>
                      {cell.earn}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MonthView
