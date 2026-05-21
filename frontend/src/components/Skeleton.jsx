import React from 'react';

export const SkeletonLine = ({ width = '100%', height = '1rem', style = {} }) => (
  <div style={{
    width, height,
    background: 'var(--bg-tertiary)',
    borderRadius: '4px',
    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
    ...style,
  }} />
);

export const SkeletonCircle = ({ size = '3rem', style = {} }) => (
  <div style={{
    width: size, height: size,
    background: 'var(--bg-tertiary)',
    borderRadius: '50%',
    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
    ...style,
  }} />
);

export const SkeletonCard = ({ children, style = {} }) => (
  <div style={{
    padding: '1rem',
    background: 'var(--bg-primary)',
    borderRadius: '8px',
    boxShadow: '0 1px 3px var(--shadow)',
    ...style,
  }}>
    {children}
  </div>
);
