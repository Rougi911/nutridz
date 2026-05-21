import React from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { useTranslation } from '../i18n';
import LanguageSelector from './LanguageSelector';
import CookieBanner from './CookieBanner';

const NAV = [
  { to: '/journal',  icon: 'ti-notebook',   key: 'journal' },
  { to: '/products', icon: 'ti-search',      key: 'products' },
  { to: '/dishes',   icon: 'ti-soup',        key: 'dishes' },
  { to: '/scanner',  icon: 'ti-barcode',     key: 'scanner' },
  { to: '/vision',   icon: 'ti-camera',      key: 'vision' },
  { to: '/bilan',    icon: 'ti-heartbeat',   key: 'bilan' },
  { to: '/history',  icon: 'ti-chart-bar',   key: 'history' },
  { to: '/glucose',  icon: 'ti-droplet',     key: 'glucose' },
  { to: '/profile',  icon: 'ti-user',        key: 'profile' },
];

export default function Layout() {
  const { t } = useTranslation();
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
      {/* Language bar */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '0.5px solid rgba(0,0,0,0.07)', padding: '5px 14px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <LanguageSelector />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 64 }}>
        <Outlet />
        <footer style={{ padding: '16px 20px 8px', borderTop: '0.5px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
          <Link to="/confidentialite" style={{ fontSize: 11, color: '#aaa', textDecoration: 'none' }}>Confidentialité</Link>
          <Link to="/mentions-legales" style={{ fontSize: 11, color: '#aaa', textDecoration: 'none' }}>Mentions légales</Link>
          <a href="mailto:contact@nutrivita.app" style={{ fontSize: 11, color: '#aaa', textDecoration: 'none' }}>Contact</a>
        </footer>
      </div>

      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, background: 'var(--bg-primary)',
        borderTop: '0.5px solid rgba(0,0,0,0.1)',
        display: 'flex', zIndex: 100
      }}>
        {NAV.map(({ to, icon, key }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, padding: '6px 0 8px', textDecoration: 'none',
            color: isActive ? '#1A6B3C' : '#888780', fontSize: 9, fontWeight: 500,
            borderTop: isActive ? '2px solid #1A6B3C' : '2px solid transparent',
            transition: 'all 0.15s'
          })}>
            <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
            {t(`nav.${key}`)}
          </NavLink>
        ))}
      </nav>
      <CookieBanner />
    </div>
  );
}
