import { Fragment, useEffect, type CSSProperties, type FC } from 'react'
import type { ClockCalendarVM, ClockMonthDayVM, ClockViewProps } from '../types'
import { addDays, iso, parseISO } from '../lib/dates'
import { useIsMobile } from '../hooks/useMediaQuery'

const statLabelStyle: CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#9ca3af',
  fontFamily: "'Geist Mono',monospace",
}

const sectionLabelStyle: CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#9ca3af',
  fontFamily: "'Geist Mono',monospace",
  marginBottom: '10px',
}

const Stat: FC<{ label: string; value: string; accent?: string; first?: boolean }> = ({ label, value, accent, first }) => (
  <div
    className="clock-stat"
    style={{
      padding: first ? '0 22px 0 0' : '0 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      minWidth: 0,
      borderLeft: first ? 'none' : '1px solid #eef0f3',
    }}
  >
    <div style={{ ...statLabelStyle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
    <div
      style={{
        fontSize: '19px',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        fontFamily: "'Geist Mono',monospace",
        color: accent,
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </div>
  </div>
)

// One day cell in the month grid. Shading + pips encode hours logged and
// which contexts were touched that day. Clicking selects the day into the
// side panel; clicking the already-selected day returns to the glance state.
const PunchButton: FC<{ timerStartMs: number | null; accent: string; onPunch: () => void; onPunchOut: () => void }> = ({
  timerStartMs, accent, onPunch, onPunchOut,
}) => {
  if (timerStartMs) {
    const startLabel = new Date(timerStartMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="punch-dot" />
        <span style={{ fontSize: '12px', color: '#6b7280', fontFamily: "'Geist Mono',monospace", whiteSpace: 'nowrap' }}>
          Since {startLabel}
        </span>
        <button
          type="button"
          onClick={onPunchOut}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '8px',
            border: '1.5px solid #fca5a5', background: '#fef2f2',
            color: '#dc2626', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
            whiteSpace: 'nowrap', minHeight: '34px',
          }}
        >
          Punch Out
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onPunch}
      style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '7px 14px', borderRadius: '8px',
        border: 'none', background: accent,
        color: '#fff', cursor: 'pointer',
        fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
        whiteSpace: 'nowrap', minHeight: '34px',
      }}
    >
      Punch
    </button>
  )
}


const CalCell: FC<{ day: ClockMonthDayVM; accent: string }> = ({ day, accent }) => {
  const isOther = !day.isCurrentMonth
  return (
    <button
      type="button"
      className="cal-cell"
      onClick={day.onClick}
      disabled={isOther}
      title={day.title}
      style={{
        aspectRatio: '1.05',
        border: day.isSelected ? `1.5px solid ${accent}` : '1px solid #eef0f3',
        boxShadow: day.isSelected ? `0 0 0 3px ${accent}22` : 'none',
        borderRadius: '10px',
        padding: '8px',
        cursor: isOther ? 'default' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: !day.hasData && day.isWeekend ? '#f5f6f8' : '#fff',
        opacity: isOther ? 0.34 : 1,
        animationName: isOther ? 'none' : undefined,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: "'Geist Mono',monospace",
          textAlign: 'right',
          color: day.isToday ? accent : (day.hasData ? '#1a1c20' : '#c4c8cf'),
        }}
      >
        {day.dayNum}
      </div>
      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
        {day.pips.map((color, index) => (
          <span key={index} style={{ width: '7px', height: '7px', borderRadius: '50%', background: color }} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '4px' }}>
        <span style={{ fontSize: '10.5px', fontFamily: "'Geist Mono',monospace", color: '#6b7280' }}>{day.hoursLabel}</span>
        {day.earnLabel && (
          <span className="cal-cell-earn" style={{ fontSize: '9.5px', fontFamily: "'Geist Mono',monospace", color: accent, opacity: 0.85 }}>
            {day.earnLabel}
          </span>
        )}
      </div>
    </button>
  )
}

const CalendarPanel: FC<{ calendar: ClockCalendarVM; accent: string }> = ({ calendar, accent }) => {
  const { panel } = calendar

  if (panel.mode === 'day') {
    return (
      <>
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid #eef0f3' }}>
          <button
            type="button"
            onClick={panel.onBack}
            style={{ border: 'none', background: 'transparent', color: '#9ca3af', fontSize: '11.5px', fontWeight: 500, cursor: 'pointer', padding: '0 0 8px', display: 'block', fontFamily: 'inherit' }}
          >
            ‹ Month overview
          </button>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{panel.dateLabel}</div>
          {panel.hoursLabel && (
            <div style={{ fontSize: '12px', color: '#9ca3af', fontFamily: "'Geist Mono',monospace", marginTop: '3px' }}>
              {panel.hoursLabel}{panel.earnLabel ? ` · ${panel.earnLabel}` : ''}
            </div>
          )}
        </div>
        <div className="cal-panel-body" style={{ flex: 1 }}>
          <div style={{ padding: '12px 16px' }}>
            {panel.entries.length === 0 && (
              <div style={{ padding: '30px 22px 10px', textAlign: 'center', color: '#9ca3af', fontSize: '12.5px' }}>
                Nothing logged this day yet.
              </div>
            )}
            {panel.entries.map((entry) => (
              <div
                key={entry.id}
                className="cal-prow"
                onClick={entry.onClick}
                style={{ display: 'flex', gap: '10px', padding: '11px 12px', borderRadius: '10px', cursor: 'pointer', border: '1px solid #eef0f3', background: '#fff', marginBottom: '6px' }}
              >
                <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: entry.dotColor, flexShrink: 0, marginTop: '3px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{entry.name}</div>
                  <div style={{ fontSize: '12px', color: '#8a909a', marginTop: '2px' }}>{entry.subLabel}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {entry.hoursLabel && (
                    <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: "'Geist Mono',monospace" }}>{entry.hoursLabel}</div>
                  )}
                  {entry.earnLabel && (
                    <div style={{ fontSize: '12px', color: accent, fontFamily: "'Geist Mono',monospace", marginTop: '1px' }}>{entry.earnLabel}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  const topMinutesPct = Math.max(1, ...panel.topProjects.map((project) => project.barPct))

  return (
    <div className="cal-panel-body" style={{ flex: 1, padding: '20px 22px 24px' }}>
      {panel.filterLabel && (
        <button
          type="button"
          onClick={panel.onClearFilter}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '14px',
            padding: '5px 10px 5px 8px',
            border: `1px solid ${accent}44`,
            background: `${accent}10`,
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '11.5px',
            fontWeight: 500,
            color: accent,
            fontFamily: 'inherit',
            maxWidth: '100%',
          }}
          title="Clear filter"
        >
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: accent, flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{panel.filterLabel}</span>
          <span style={{ flexShrink: 0, opacity: 0.7, marginLeft: '2px' }}>✕</span>
        </button>
      )}
      {panel.topProjects.length === 0 ? (
        <div style={{ padding: '20px 0 10px', textAlign: 'center', color: '#9ca3af', fontSize: '12.5px' }}>
          Nothing logged this month yet.
        </div>
      ) : (
        <>
          <div style={sectionLabelStyle}>Entries</div>
          {panel.topProjects.map((project) => (
            <button
              key={project.key}
              type="button"
              className="cal-glance-row"
              onClick={project.onFilter}
              style={{
                width: '100%',
                display: 'block',
                textAlign: 'left',
                border: project.isFiltered ? `1px solid ${accent}44` : '1px solid transparent',
                background: project.isFiltered ? `${accent}08` : 'transparent',
                borderRadius: '8px',
                padding: '7px 8px',
                marginBottom: '6px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px', gap: '8px' }}>
                <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: project.dotColor, flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', marginBottom: '1px' }} />
                  <span style={{ fontSize: '12.5px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>{project.subLabel}</span>
                </div>
                <span style={{ fontSize: '12px', fontFamily: "'Geist Mono',monospace", color: '#6b7280', flexShrink: 0 }}>
                  {project.hoursLabel}
                </span>
              </div>
              <div style={{ height: '4px', borderRadius: '4px', background: '#eef0f3', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '4px', width: `${Math.max(4, (project.barPct / topMinutesPct) * 100)}%`, background: project.dotColor }} />
              </div>
            </button>
          ))}
        </>
      )}

    </div>
  )
}

const ClockView: FC<ClockViewProps> = ({ calendar, accent, timerStartMs, onPunch, onPunchOut }) => {
  const isMobile = useIsMobile()

  // Arrow keys move the selected day when the calendar has focus. Only
  // active once a day is selected — the month-at-a-glance state doesn't
  // have a "current" day to move from.
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (calendar.panel.mode !== 'day') {
        return
      }
      const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
      const delta = deltas[event.key]
      if (delta === undefined) {
        return
      }
      const active = document.activeElement
      if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) {
        return
      }
      event.preventDefault()
      const nextISO = iso(addDays(parseISO(calendar.panel.iso), delta))
      const cell = calendar.weeks.flatMap((week) => week.days).find((day) => day.iso === nextISO)
      cell?.onClick()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [calendar])

  return (
    <div className="clock-view-shell" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div className="clock-view-calendar" style={{ flex: 1.35, overflow: 'auto', background: '#ffffff', borderRight: '1px solid #e9ebef' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '18px 22px 32px' }}>
          <div className="clock-summary" style={{ display: 'flex', alignItems: 'center', paddingBottom: '16px', marginBottom: '14px', borderBottom: '1px solid #eef0f3' }}>
            <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }}>
              <Stat label="Hours" value={calendar.summary.hoursLabel} first />
              <Stat label="Billable days" value={calendar.summary.daysLabel} />
              <Stat label="Earnings" value={calendar.summary.earnLabel} accent={accent} />
              <Stat label="Entries" value={calendar.summary.entryCountLabel} />
            </div>
            {!isMobile && (
              <div style={{ flexShrink: 0, paddingLeft: '22px' }}>
                <PunchButton timerStartMs={timerStartMs} accent={accent} onPunch={onPunch} onPunchOut={onPunchOut} />
              </div>
            )}
          </div>

          <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: '30px repeat(7, 1fr)', gap: '6px' }}>
            <div />
            {calendar.dowLabels.map((label, i) => {
              if (isMobile && i >= 5) return null
              return (
                <div
                  key={label}
                  style={{ textAlign: 'center', fontSize: '11px', letterSpacing: '0.05em', color: '#9ca3af', fontFamily: "'Geist Mono',monospace", paddingBottom: '4px' }}
                >
                  {label}
                </div>
              )
            })}

            {calendar.weeks.map((week, weekIndex) => (
              <Fragment key={`gutter-${weekIndex}`}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', color: '#9ca3af', fontFamily: "'Geist Mono',monospace" }}>
                  <span style={{ fontSize: '10px', letterSpacing: '0.03em' }}>{week.weekLabel}</span>
                  <span style={{ fontSize: '10px', color: '#6b7280' }}>{week.hoursLabel}</span>
                  {isMobile && week.hasWeekendData && (
                    <span title="This week has weekend hours" style={{ fontSize: '8px', color: accent, lineHeight: 1 }}>●</span>
                  )}
                </div>
                {week.days.map((day, dayIndex) => {
                  if (isMobile && dayIndex >= 5) return null
                  return <CalCell key={day.iso} day={day} accent={accent} />
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <aside
        className="clock-view-aside"
        style={{ width: '340px', flexShrink: 0, background: '#fbfcfd', display: 'flex', flexDirection: 'column', overflow: 'auto' }}
        tabIndex={-1}
      >
        <CalendarPanel calendar={calendar} accent={accent} />
      </aside>
    </div>
  )
}

export default ClockView
