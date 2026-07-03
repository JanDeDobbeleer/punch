import type { FC } from 'react'
import type { SidebarProps } from '../types'

const Sidebar: FC<SidebarProps> = ({
  logoStyle,
  navTrackStyle,
  navProjectsStyle,
  navCustomersStyle,
  navExportStyle,
  onNavTrack,
  onNavProjects,
  onNavCustomers,
  onNavExport,
  weekHours,
  weekDaysStr,
  weekEarnStr,
  syncColor,
  syncLabel,
  onOpenSettings,
  isOpen,
  onClose,
}) => {
  const handleNavTrack = () => {
    onNavTrack();
    onClose?.();
  };

  const handleNavProjects = () => {
    onNavProjects();
    onClose?.();
  };

  const handleNavCustomers = () => {
    onNavCustomers();
    onClose?.();
  };

  const handleNavExport = () => {
    onNavExport();
    onClose?.();
  };

  const handleOpenSettings = () => {
    onOpenSettings();
    onClose?.();
  };

  return (
    <aside
      id="app-sidebar"
      className={`sidebar${isOpen ? ' sidebar--open' : ''}`}
      style={{
        width: '236px',
        flexShrink: 0,
        background: '#ffffff',
        borderRight: '1px solid #e9ebef',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 8px 22px' }}>
        <div style={logoStyle}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 7v5l3.5 2"></path>
          </svg>
        </div>
        <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em' }}>Tempo</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <button type="button" style={navTrackStyle} onClick={handleNavTrack}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="8.5"></circle>
            <path d="M12 7.5V12l3 1.8"></path>
          </svg>
          <span>Track</span>
        </button>
        <button type="button" style={navProjectsStyle} onClick={handleNavProjects}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="4" y="4" width="7" height="7" rx="1.5"></rect>
            <rect x="13" y="4" width="7" height="7" rx="1.5"></rect>
            <rect x="4" y="13" width="7" height="7" rx="1.5"></rect>
            <rect x="13" y="13" width="7" height="7" rx="1.5"></rect>
          </svg>
          <span>Projects</span>
        </button>
        <button type="button" style={navCustomersStyle} onClick={handleNavCustomers}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="9" cy="9" r="3.2"></circle>
            <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"></path>
            <path d="M15.5 7a3 3 0 0 1 0 5.8"></path>
            <path d="M17 14.2c2.4.5 4 2.3 4 4.8"></path>
          </svg>
          <span>Customers</span>
        </button>
        <button type="button" style={navExportStyle} onClick={handleNavExport}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 4v11" strokeLinecap="round"></path>
            <path d="M7.5 11.5 12 16l4.5-4.5" strokeLinecap="round" strokeLinejoin="round"></path>
            <path d="M4 18.5v1a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-1" strokeLinecap="round"></path>
          </svg>
          <span>Export</span>
        </button>
      </div>

      <div
        style={{
          marginTop: 'auto',
          border: '1px solid #eef0f3',
          borderRadius: '12px',
          padding: '14px',
          background: '#fbfcfd',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#9ca3af',
            fontFamily: "'Geist Mono',monospace",
          }}
        >
          This week
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '8px' }}>
          <span style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.02em' }}>{weekHours}</span>
          <span style={{ fontSize: '13px', color: '#9ca3af', fontFamily: "'Geist Mono',monospace" }}>
            / {weekDaysStr}d
          </span>
        </div>
        <div
          style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid #eef0f3',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: '12px', color: '#626873' }}>Earnings</span>
          <span style={{ fontSize: '15px', fontWeight: 600, fontFamily: "'Geist Mono',monospace" }}>
            {weekEarnStr}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '12px',
          padding: '0 6px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: syncColor }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 13l4 4L19 7"></path>
          </svg>
          {syncLabel}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Settings"
            onClick={handleOpenSettings}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
              <path d="M19.4 13.5c.04-.33.06-.66.06-1s-.02-.67-.06-1l1.85-1.44a.9.9 0 0 0 .21-1.15l-1.75-3.03a.9.9 0 0 0-1.1-.4l-2.18.88a7.4 7.4 0 0 0-1.73-1l-.33-2.32A.9.9 0 0 0 13.6 3h-3.5a.9.9 0 0 0-.9.76l-.33 2.32c-.63.25-1.21.59-1.73 1l-2.18-.88a.9.9 0 0 0-1.1.4L2.11 9.63a.9.9 0 0 0 .21 1.15L4.17 12.2c-.04.33-.06.66-.06 1s.02.67.06 1L2.32 15.6a.9.9 0 0 0-.21 1.15l1.75 3.03c.24.42.75.6 1.1.4l2.18-.88c.52.41 1.1.75 1.73 1l.33 2.32a.9.9 0 0 0 .9.76h3.5a.9.9 0 0 0 .9-.76l.33-2.32c.63-.25 1.21-.59 1.73-1l2.18.88c.42.17.93 0 1.1-.4l1.75-3.03a.9.9 0 0 0-.21-1.15L19.4 13.5Z" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
