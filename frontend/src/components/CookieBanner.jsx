import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'nutrivita_consent';

function loadGA(gaId) {
  if (!gaId || window.__nutrivita_ga_loaded) return;
  window.__nutrivita_ga_loaded = true;
  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  script.async = true;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', gaId);
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    } else if (consent === 'accepted') {
      loadGA(process.env.REACT_APP_GA_ID);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    loadGA(process.env.REACT_APP_GA_ID);
    setVisible(false);
  }

  function handleRefuse() {
    localStorage.setItem(CONSENT_KEY, 'refused');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)', maxWidth: '448px',
      background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-card)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
      zIndex: 200, border: '0.5px solid rgba(0,0,0,0.08)',
    }}>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', margin: '0 0 var(--space-tight)', lineHeight: 1.5 }}>
        NutraLance utilise des cookies pour améliorer votre expérience.{' '}
        <Link to="/confidentialite" style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
          Politique de confidentialité
        </Link>.
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleRefuse}
          style={{
            flex: 1, padding: '10px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)', fontWeight: 600, fontSize: 'var(--font-size-sm)', cursor: 'pointer',
          }}
        >
          Refuser
        </button>
        <button
          onClick={handleAccept}
          style={{
            flex: 1, padding: '10px', borderRadius: 'var(--radius-md)',
            border: 'none', background: 'var(--accent-green)',
            color: '#fff', fontWeight: 600, fontSize: 'var(--font-size-sm)', cursor: 'pointer',
          }}
        >
          Accepter
        </button>
      </div>
    </div>
  );
}
