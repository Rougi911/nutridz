import React from 'react';
import { useTranslation } from '../i18n';

export default function LanguageSelector() {
  const { lang, setLang } = useTranslation();
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2xs)' }}>
      {[['ar', 'عربي'], ['fr', 'FR'], ['en', 'EN']].map(([code, label]) => (
        <button key={code} onClick={() => setLang(code)} style={{
          padding: '2px 9px', borderRadius: 'var(--radius-xl)', fontSize: 'var(--font-size-xs)', fontWeight: 600,
          border: '0.5px solid', cursor: 'pointer', transition: 'all 0.15s',
          background: lang === code ? 'var(--accent-green)' : 'transparent',
          borderColor: lang === code ? 'var(--accent-green)' : 'rgba(0,0,0,0.18)',
          color: lang === code ? 'white' : 'var(--text-secondary)',
        }}>
          {label}
        </button>
      ))}
    </div>
  );
}
