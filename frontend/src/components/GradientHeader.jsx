import React from 'react';

const VARIANT_MAP = {
  indigo:  'gradient-hero',
  emerald: 'gradient-health',
  glucose: 'gradient-glucose',
  slate:   'gradient-slate',
};

export default function GradientHeader({ title, subtitle, icon, variant = 'indigo', children }) {
  return (
    <div className={`gradient-header ${VARIANT_MAP[variant] || VARIANT_MAP.indigo}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{icon}</span>}
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        {children && <div style={{ display: 'flex', gap: 8 }}>{children}</div>}
      </div>
    </div>
  );
}
