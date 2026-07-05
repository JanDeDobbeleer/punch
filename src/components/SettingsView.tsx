import type { CSSProperties, FC } from 'react';

import type { SettingsViewProps } from '../types';

const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e7eb',
  borderRadius: '12px',
  padding: '22px',
};

const secondaryButtonStyle: CSSProperties = {
  height: '44px',
  padding: '0 14px',
  border: '1px solid #e4e7eb',
  background: '#fff',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
};

const SettingsView: FC<SettingsViewProps> = ({
  onBack,
  demoMode,
  onToggleDemoMode,
  demoModeHint,
  syncDisabled,
  syncStatusLabel,
  syncStatusColor,
  onSyncNow,
  signedInAs,
  onSignOut,
  isAuthenticated,
  onSignIn,
  onDeleteAll,
}) => (
  <div style={{ flex: 1, overflow: 'auto', padding: '26px' }}>
    <div style={{ maxWidth: '880px', margin: '0 auto' }}>
      <button
        type="button"
        className="back-btn"
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
          color: '#64748b',
          padding: '0 0 18px',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 6l-6 6 6 6"></path>
        </svg>
        Back
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
          <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em' }}>Settings</div>
          <div style={{ marginTop: '4px', fontSize: '13px', color: '#64748b' }}>
            Manage demo mode, Azure sync and local data.
          </div>
        </div>

      <section style={cardStyle}>
        <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em' }}>Demo mode</div>
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>Use sample Punch data</div>
            <div style={{ marginTop: '6px', fontSize: '13px', color: '#64748b', lineHeight: 1.65 }}>{demoModeHint}</div>
          </div>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flexShrink: 0 }}>
            <input type="checkbox" checked={demoMode} onChange={onToggleDemoMode} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: demoMode ? '#0f172a' : '#64748b' }}>
              {demoMode ? 'On' : 'Off'}
            </span>
          </label>
        </div>
      </section>

      <section style={{ ...cardStyle, opacity: syncDisabled ? 0.6 : 1, pointerEvents: syncDisabled ? 'none' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em' }}>Azure sync</div>
            <div style={{ marginTop: '5px', fontSize: '13px', color: '#64748b' }}>
              Your data is stored in Azure Blob Storage behind the /api/state endpoint, protected by GitHub sign-in.
            </div>
          </div>

          {syncDisabled && (
            <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>Disabled while demo mode is active.</div>
          )}
        </div>

        <div style={{ marginTop: '18px', display: 'grid', gap: '16px' }}>
          {isAuthenticated ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) auto',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '1px solid #e4e7eb',
                  background: '#f8fafc',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8', fontFamily: "'Geist Mono',monospace" }}>
                    Signed in as
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '13px', fontFamily: "'Geist Mono',monospace", color: '#0f172a' }}>
                    {signedInAs || 'Unknown'}
                  </div>
                </div>

                <div style={{ fontSize: '13px', fontWeight: 500, color: syncStatusColor }}>{syncStatusLabel}</div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                 className="btn-primary"
                 style={{ ...secondaryButtonStyle, background: 'linear-gradient(135deg, #1e3a5f, color-mix(in srgb, #1e3a5f 72%, #2563eb))', borderColor: '#1e3a5f', color: '#fff' }}
                 onClick={onSyncNow}
                >
                 Sync now
                </button>
                <button type="button" className="btn-ghost" style={secondaryButtonStyle} onClick={onSignOut}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
                padding: '14px 16px',
                borderRadius: '10px',
                border: '1px solid #e4e7eb',
                background: '#f8fafc',
              }}
            >
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Sign in with GitHub to sync your data with Azure.
              </div>
              <button
                type="button"
                className="btn-primary"
                style={{ ...secondaryButtonStyle, background: 'linear-gradient(135deg, #1e3a5f, color-mix(in srgb, #1e3a5f 72%, #2563eb))', borderColor: '#1e3a5f', color: '#fff', flexShrink: 0 }}
                onClick={onSignIn}
              >
                Sign in with GitHub
              </button>
            </div>
          )}
        </div>
      </section>

      <section style={{ ...cardStyle, border: '1px solid #fecaca', background: '#fffafa' }}>
        <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em', color: '#b91c1c' }}>Danger zone</div>
        <div style={{ marginTop: '6px', fontSize: '13px', color: '#7f1d1d', lineHeight: 1.65 }}>
          Delete all data in the currently active store.
        </div>

        <button
          type="button"
          style={{
            ...secondaryButtonStyle,
            marginTop: '16px',
            borderColor: '#fca5a5',
            color: '#b91c1c',
            background: '#fff',
          }}
          onClick={onDeleteAll}
        >
          Delete all data
        </button>
      </section>
      </div>
    </div>
  </div>
);

export default SettingsView;
