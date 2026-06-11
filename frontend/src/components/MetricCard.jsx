import React from 'react';

export default function MetricCard({ label, value, unit, status = 'neutral', statusText }) {
  return (
    <div className={`metric-card metric-card--${status}`}>
      <span
        className="label-text"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2xs)' }}>
        <span style={{ fontSize: '1.875rem', fontWeight: 700 }}>{value}</span>
        {unit && (
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{unit}</span>
        )}
      </div>
      {statusText && (
        <span
          style={{
            display: 'inline-block',
            paddingBlock: '2px',
            paddingInline: '8px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            fontWeight: 500,
            background: 'color-mix(in srgb, currentColor 15%, transparent)',
          }}
        >
          {statusText}
        </span>
      )}
    </div>
  );
}
