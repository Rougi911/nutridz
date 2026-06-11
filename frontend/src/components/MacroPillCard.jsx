import React from 'react';

export default function MacroPillCard({ icon, value, target, label, unit = 'g' }) {
  const pct = Math.min(Math.round((value / target) * 100), 100);
  const complete = value >= target;
  return (
    <div className="macro-pill">
      <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{icon}</span>
      <div>
        <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>{value}</span>
        <span style={{ fontWeight: 400, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {unit}
        </span>
      </div>
      <span className="label-text" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="macro-pill__bar">
        <div
          className={`macro-pill__fill${complete ? ' macro-pill__fill--complete' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
