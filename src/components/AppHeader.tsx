import type { FC } from 'react'
import type { AppHeaderProps } from '../types'

const AppHeader: FC<AppHeaderProps> = ({
  headerTitle,
  headerSubtitle,
  isTrack,
  isProjects,
  isCustomers,
  tabDayStyle,
  tabWeekStyle,
  tabMonthStyle,
  onTabDay,
  onTabWeek,
  onTabMonth,
  onPrev,
  onToday,
  onNext,
  btnPrimary,
  onNewEntry,
  onNewProject,
  onNewCustomer,
  onToggleSidebar,
  isMobile,
  sidebarOpen,
}) => {
  return (
    <header
      style={{
        minHeight: '68px',
        flexShrink: 0,
        background: '#ffffff',
        borderBottom: '1px solid #e9ebef',
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: isMobile ? 'flex-start' : 'space-between',
        padding: isMobile ? '12px 16px' : '0 24px',
        gap: '16px',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, width: isMobile ? '100%' : undefined }}>
        {isMobile && (
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            onClick={onToggleSidebar}
            style={{
              width: '44px',
              height: '44px',
              minWidth: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #e2e4e8',
              background: '#fff',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#3a3f48',
              padding: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {headerTitle}
          </div>
          <div style={{ fontSize: '12.5px', color: '#9ca3af', marginTop: '1px' }}>{headerSubtitle}</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
          width: isMobile ? '100%' : undefined,
          overflowX: isMobile ? 'auto' : undefined,
        }}
      >
        {isTrack && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                background: '#f0f1f4',
                borderRadius: '9px',
                padding: '3px',
              }}
            >
              <button type="button" style={tabDayStyle} onClick={onTabDay}>
                Day
              </button>
              <button type="button" style={tabWeekStyle} onClick={onTabWeek}>
                Week
              </button>
              <button type="button" style={tabMonthStyle} onClick={onTabMonth}>
                Month
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                style={{
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #e2e4e8',
                  background: '#fff',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#3a3f48',
                }}
                onClick={onPrev}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 6l-6 6 6 6"></path>
                </svg>
              </button>
              <button
                type="button"
                style={{
                  height: '44px',
                  padding: '0 13px',
                  border: '1px solid #e2e4e8',
                  background: '#fff',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#3a3f48',
                }}
                onClick={onToday}
              >
                Today
              </button>
              <button
                type="button"
                style={{
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #e2e4e8',
                  background: '#fff',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#3a3f48',
                }}
                onClick={onNext}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 6l6 6-6 6"></path>
                </svg>
              </button>
            </div>
            {!isMobile && (
              <button type="button" style={btnPrimary} onClick={onNewEntry}>
                + Add hours
              </button>
            )}
          </>
        )}
        {isProjects && (
          !isMobile && (
            <button type="button" style={btnPrimary} onClick={onNewProject}>
              + New project
            </button>
          )
        )}
        {isCustomers && (
          !isMobile && (
            <button type="button" style={btnPrimary} onClick={onNewCustomer}>
              + New customer
            </button>
          )
        )}
      </div>
    </header>
  )
}

export default AppHeader
