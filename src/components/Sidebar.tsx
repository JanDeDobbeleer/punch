import type { FC } from 'react'
import type { SidebarProps } from '../types'

const SyncIcon: FC<{ status: SidebarProps['syncStatus'] }> = ({ status }) => {
  if (status === 'syncing') {
    return (
      <svg className="sync-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      </svg>
    );
  }

  if (status === 'error') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    );
  }

  if (status === 'conflict') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }

  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M5 13l4 4L19 7"></path>
    </svg>
  );
};

const Sidebar: FC<SidebarProps> = ({
  logoStyle,
  navTrackStyle,
  navProjectsStyle,
  navServicesStyle,
  navCustomersStyle,
  navExportStyle,
  navEarningsStyle,
  onNavTrack,
  onNavProjects,
  onNavServices,
  onNavCustomers,
  onNavExport,
  onNavEarnings,
  monthHours,
  monthDaysStr,
  monthEarnStr,
  periodLabel,
  syncColor,
  syncLabel,
  syncStatus,
  onOpenSettings,
  accent,
  isAuthenticated,
  onSignIn,
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

  const handleNavServices = () => {
    onNavServices();
    onClose?.();
  };

  const handleNavExport = () => {
    onNavExport();
    onClose?.();
  };

  const handleNavEarnings = () => {
    onNavEarnings();
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
        borderRight: '1px solid #e4e7eb',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 8px 20px' }}>
        <div style={logoStyle}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {/* Punch card outline with clipped top-left corner */}
            <path d="M4 7.5 L9 2 L20 2 L20 22 L4 22 Z"/>
            {/* Punched holes */}
            <rect x="7.5" y="8.5" width="2.5" height="4" rx="0.8" fill="currentColor" stroke="none"/>
            <rect x="12" y="8.5" width="2.5" height="4" rx="0.8" fill="currentColor" stroke="none"/>
            <rect x="16.5" y="8.5" width="2.5" height="4" rx="0.8" fill="currentColor" stroke="none"/>
          </svg>
        </div>
        <div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em' }}>Punch</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button type="button" className="nav-btn" style={navTrackStyle} onClick={handleNavTrack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="8.5"></circle>
            <path d="M12 7.5V12l3 1.8"></path>
          </svg>
          <span>Track</span>
        </button>
        <button type="button" className="nav-btn" style={navProjectsStyle} onClick={handleNavProjects}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="4" y="4" width="7" height="7" rx="1.5"></rect>
            <rect x="13" y="4" width="7" height="7" rx="1.5"></rect>
            <rect x="4" y="13" width="7" height="7" rx="1.5"></rect>
            <rect x="13" y="13" width="7" height="7" rx="1.5"></rect>
          </svg>
          <span>Projects</span>
        </button>
        <button type="button" className="nav-btn" style={navServicesStyle} onClick={handleNavServices}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="5" y="6" width="14" height="12" rx="3"></rect>
            <path d="M9 10h6M9 14h3" strokeLinecap="round"></path>
          </svg>
          <span>Services</span>
        </button>
        <button type="button" className="nav-btn" style={navCustomersStyle} onClick={handleNavCustomers}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="9" cy="9" r="3.2"></circle>
            <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"></path>
            <path d="M15.5 7a3 3 0 0 1 0 5.8"></path>
            <path d="M17 14.2c2.4.5 4 2.3 4 4.8"></path>
          </svg>
          <span>Customers</span>
        </button>
        <button type="button" className="nav-btn" style={navEarningsStyle} onClick={handleNavEarnings}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 20V10M12 20V4M19 20v-7" strokeLinecap="round"></path>
          </svg>
          <span>Earnings</span>
        </button>
        <button type="button" className="nav-btn" style={navExportStyle} onClick={handleNavExport}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
          border: '1px solid #e4e7eb',
          borderRadius: '12px',
          padding: '14px',
          background: '#f8fafc',
        }}
      >
        <div
          style={{
            fontSize: '10.5px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#94a3b8',
            fontFamily: "'Geist Mono',monospace",
            fontWeight: 500,
          }}
        >
          {periodLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '8px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.03em', color: '#0f172a' }}>{monthHours}</span>
          <span style={{ fontSize: '12.5px', color: '#94a3b8', fontFamily: "'Geist Mono',monospace" }}>
            / {monthDaysStr}d
          </span>
        </div>
        <div
          style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid #e4e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>Earnings</span>
          <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: "'Geist Mono',monospace", letterSpacing: '-0.02em', color: '#0f172a' }}>
            {monthEarnStr}
          </span>
        </div>
      </div>

      {!isAuthenticated && (
        <button
          type="button"
          style={{
            marginTop: '10px',
            width: '100%',
            height: '40px',
            border: 'none',
            background: accent,
            color: '#fff',
            borderRadius: '9px',
            cursor: 'pointer',
            fontSize: '13.5px',
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
          onClick={onSignIn}
        >
          Sign in with GitHub
        </button>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '4px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: syncColor }}>
          <SyncIcon status={syncStatus} />
          {syncLabel}
        </span>
        <button
          type="button"
          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
          title="Settings"
          onClick={handleOpenSettings}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8">
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
            <path d="M19.4 13.5c.04-.33.06-.66.06-1s-.02-.67-.06-1l1.85-1.44a.9.9 0 0 0 .21-1.15l-1.75-3.03a.9.9 0 0 0-1.1-.4l-2.18.88a7.4 7.4 0 0 0-1.73-1l-.33-2.32A.9.9 0 0 0 13.6 3h-3.5a.9.9 0 0 0-.9.76l-.33 2.32c-.63.25-1.21.59-1.73 1l-2.18-.88a.9.9 0 0 0-1.1.4L2.11 9.63a.9.9 0 0 0 .21 1.15L4.17 12.2c-.04.33-.06.66-.06 1s.02.67.06 1L2.32 15.6a.9.9 0 0 0-.21 1.15l1.75 3.03c.24.42.75.6 1.1.4l2.18-.88c.52.41 1.1.75 1.73 1l.33 2.32a.9.9 0 0 0 .9.76h3.5a.9.9 0 0 0 .9-.76l.33-2.32c.63-.25 1.21-.59 1.73-1l2.18.88c.42.17.93 0 1.1-.4l1.75-3.03a.9.9 0 0 0-.21-1.15L19.4 13.5Z" />
          </svg>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
