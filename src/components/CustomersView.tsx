import type { FC } from 'react';

import type { CustomersViewProps } from '../types';

const CustomersView: FC<CustomersViewProps> = ({ custRows, custEmpty }) => (
  <div style={{ flex: 1, overflow: 'auto', padding: '26px' }}>
    <div
      style={{
        maxWidth: '1000px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))',
        gap: '14px',
      }}
    >
      {custRows.map((customer) => (
        <div
          key={customer.id}
          className="customer-card"
          style={{
            background: '#fff',
            border: '1px solid #e9ebef',
            borderRadius: '14px',
            padding: '20px',
            cursor: 'pointer',
          }}
          onClick={customer.onClick}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={customer.avatarStyle}>{customer.initials}</div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {customer.name}
              </div>
              <div style={{ fontSize: '12.5px', color: '#9ca3af' }}>{customer.projectLabel}</div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '24px',
              marginTop: '18px',
              paddingTop: '16px',
              borderTop: '1px solid #eef0f3',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: "'Geist Mono',monospace",
                }}
              >
                Logged
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  fontFamily: "'Geist Mono',monospace",
                  marginTop: '3px',
                }}
              >
                {customer.hours}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: "'Geist Mono',monospace",
                }}
              >
                Earnings
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  fontFamily: "'Geist Mono',monospace",
                  marginTop: '3px',
                }}
              >
                {customer.earn}
              </div>
            </div>
          </div>
        </div>
      ))}

      {custEmpty && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', fontSize: '14px' }}>
          No customers yet.
        </div>
      )}
    </div>
  </div>
);

export default CustomersView;
