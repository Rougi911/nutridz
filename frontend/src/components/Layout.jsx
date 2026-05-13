import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';

const navItems = [
  { to: '/journal',  icon: 'ti-notebook',   label: 'Journal' },
  { to: '/products', icon: 'ti-search',      label: 'Produits' },
  { to: '/scanner',  icon: 'ti-barcode',     label: 'Scanner' },
  { to: '/vision',   icon: 'ti-camera',      label: 'Analyser' },
  { to: '/history',  icon: 'ti-chart-bar',   label: 'Historique' },
  { to: '/profile',  icon: 'ti-user',        label: 'Profil' },
];

export default function Layout() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f7f7f5' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 64 }}>
        <Outlet />
      </div>
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, background: '#fff',
        borderTop: '0.5px solid rgba(0,0,0,0.1)',
        display: 'flex', zIndex: 100
      }}>
        {navItems.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, padding: '6px 0 8px', textDecoration: 'none',
            color: isActive ? '#1A6B3C' : '#888780', fontSize: 9, fontWeight: 500,
            borderTop: isActive ? '2px solid #1A6B3C' : '2px solid transparent',
            transition: 'all 0.15s'
          })}>
            <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
