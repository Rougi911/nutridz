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

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 88 }}>
        <Outlet />
        <footer style={{ padding: '16px 20px 8px', borderTop: '0.5px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
          <Link to="/confidentialite" style={{ fontSize: 11, color: '#aaa', textDecoration: 'none' }}>Confidentialité</Link>
          <Link to="/mentions-legales" style={{ fontSize: 11, color: '#aaa', textDecoration: 'none' }}>Mentions légales</Link>
          <a href="mailto:contact@nutrivita.app" style={{ fontSize: 11, color: '#aaa', textDecoration: 'none' }}>Contact</a>
        </footer>
      </div>

      {/* Floating pill navigation */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, padding: '0 12px 12px', zIndex: 100,
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
      }}>
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          background: 'var(--nav-glass)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--border-color)',
          borderRadius: 9999,
          padding: '6px 8px',
          boxShadow: '0 4px 24px var(--shadow)',
        }}>
          {NAV.map(({ to, icon, key }) => (
            <NavLink key={to} to={to} title={t(`nav.${key}`)} style={({ isActive }) => ({
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 9999,
              textDecoration: 'none',
              color: isActive ? '#fff' : 'var(--text-secondary)',
              background: isActive ? 'var(--accent-blue)' : 'transparent',
              transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
              flexShrink: 0,
            })}>
              <i className={`ti ${icon}`} style={{ fontSize: 18, lineHeight: 1 }} />
            </NavLink>
          ))}
        </nav>
      </div>

      <CookieBanner />
    </div>
  );
}
