import React from 'react';
import { useTranslation } from '../i18n';

export default function LanguageSelector() {
  const { lang, setLang } = useTranslation();
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[['ar', 'عربي'], ['fr', 'FR'], ['en', 'EN']].map(([code, label]) => (
        <button key={code} onClick={() => setLang(code)} style={{
          padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
          border: '0.5px solid', cursor: 'pointer', transition: 'all 0.15s',
          background: lang === code ? '#1A6B3C' : 'transparent',
          borderColor: lang === code ? '#1A6B3C' : 'rgba(0,0,0,0.18)',
          color: lang === code ? 'white' : '#666',
        }}>
          {label}
        </button>
      ))}
    </div>
  );
}
