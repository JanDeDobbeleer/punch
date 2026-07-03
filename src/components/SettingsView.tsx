import type { CSSProperties, FC } from 'react';

import type { SettingsViewProps } from '../types';

const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e9ebef',
  borderRadius: '12px',
  padding: '22px',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: '#626873',
  marginBottom: '6px',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  minHeight: '44px',
  border: '1px solid #d7dadf',
  borderRadius: '9px',
  fontSize: '16px',
  color: '#1a1c20',
  background: '#fff',
  outline: 'none',
};

const secondaryButtonStyle: CSSProperties = {
  height: '38px',
  padding: '0 14px',
  border: '1px solid #e2e4e8',
  background: '#fff',
  borderRadius: '9px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
  color: '#3a3f48',
};

const SettingsView: FC<SettingsViewProps> = ({
  onBack,
  demoMode,
  onToggleDemoMode,
  demoModeHint,
  syncDisabled,
  patValue,
  onPatChange,
  gistIdLabel,
  gistConnected,
  gistStatusLabel,
  gistStatusColor,
  onConnect,
  onSyncNow,
  onRestoreFromGist,
  onDisconnect,
  onDeleteAll,
}) => (
  <div style={{ flex: 1, overflow: 'auto', padding: '26px' }}>
    <div style={{ maxWidth: '880px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '28px', fontWeight: 600, letterSpacing: '-0.03em' }}>Settings</div>
          <div style={{ marginTop: '4px', fontSize: '13px', color: '#626873' }}>
            Manage demo mode, GitHub sync and local data.
          </div>
        </div>

        <button
          type="button"
          style={{ ...secondaryButtonStyle, padding: '0 16px' }}
          onClick={onBack}
        >
          ← Back
        </button>
      </div>

      <section style={cardStyle}>
        <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em' }}>Demo mode</div>
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>Use sample Tempo data</div>
            <div style={{ marginTop: '6px', fontSize: '13px', color: '#626873', lineHeight: 1.65 }}>{demoModeHint}</div>
          </div>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flexShrink: 0 }}>
            <input type="checkbox" checked={demoMode} onChange={onToggleDemoMode} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: demoMode ? '#1a1c20' : '#626873' }}>
              {demoMode ? 'On' : 'Off'}
            </span>
          </label>
        </div>
      </section>

      <section style={{ ...cardStyle, opacity: syncDisabled ? 0.6 : 1, pointerEvents: syncDisabled ? 'none' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em' }}>GitHub Gist sync</div>
            <div style={{ marginTop: '5px', fontSize: '13px', color: '#626873' }}>
              Sync your real Tempo data to a private GitHub Gist.
            </div>
          </div>

          {syncDisabled && (
            <div style={{ fontSize: '12.5px', color: '#9ca3af' }}>Disabled while demo mode is active.</div>
          )}
        </div>

        <div style={{ marginTop: '18px', display: 'grid', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Personal access token</label>
            <input
              type="password"
              style={inputStyle}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={patValue}
              onChange={onPatChange}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) auto',
              gap: '12px',
              alignItems: 'center',
              padding: '14px 16px',
              borderRadius: '10px',
              border: '1px solid #eef0f3',
              background: '#fbfcfd',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#9ca3af', fontFamily: "'Geist Mono',monospace" }}>
                Gist
              </div>
              <div style={{ marginTop: '4px', fontSize: '13px', fontFamily: "'Geist Mono',monospace", color: '#1a1c20' }}>
                {gistIdLabel}
              </div>
            </div>

            <div style={{ fontSize: '13px', fontWeight: 500, color: gistStatusColor }}>{gistStatusLabel}</div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button
              type="button"
              style={{ ...secondaryButtonStyle, background: '#1a1c20', borderColor: '#1a1c20', color: '#fff' }}
              onClick={onConnect}
            >
              Connect
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={onSyncNow} disabled={!gistConnected}>
              Sync now
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={onRestoreFromGist} disabled={!gistConnected}>
              Restore from Gist
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={onDisconnect} disabled={!gistConnected}>
              Disconnect
            </button>
          </div>
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
);

export default SettingsView;
