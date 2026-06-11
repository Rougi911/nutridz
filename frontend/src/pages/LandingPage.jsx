import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';

const FEATURES = [
  { icon: '🍽️', title: 'Journal alimentaire', desc: 'Suivez vos repas quotidiens avec calcul automatique des macros' },
  { icon: '⚖️', title: 'Suivi du poids', desc: "Graphiques d'évolution avec estimation composition corporelle Forbes" },
  { icon: '🩸', title: 'Mode diabète', desc: 'Import LibreView, métriques GMI/TIR/CV, graphiques AGP' },
  { icon: '🎤', title: 'Saisie vocale', desc: 'Ajoutez vos aliments par la voix en FR/AR/EN' },
  { icon: '🌙', title: 'Dark mode', desc: 'Interface adaptative jour/nuit pour confort visuel' },
  { icon: '🌍', title: 'Multilingue', desc: 'Support complet FR/AR/EN avec RTL pour l\'arabe' },
];

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', overflowX: 'hidden' }}>
      {/* Hero */}
      <div className="gradient-header gradient-hero" style={{ padding: '48px 24px 56px', textAlign: 'center', color: '#fff', borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🥗</div>
        <h1 style={{ fontSize: '2.5rem', margin: '0 0 1rem', fontWeight: '800' }}>NutriVita</h1>
        <p style={{ fontSize: '1.2rem', margin: '0 0 2rem', opacity: 0.9 }}>
          {t('landing.tagline')}
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/register')} className="pill active">
            {t('landing.getStarted')}
          </button>
          <button onClick={() => navigate('/login')} className="pill" style={{ border: '2px solid white', color: 'white', background: 'transparent' }}>
            {t('landing.login')}
          </button>
        </div>
      </div>

      {/* Features */}
      <section style={{ padding: '3rem 1.5rem', maxWidth: '960px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2.5rem', fontSize: '1.8rem', color: 'var(--text-primary)' }}>
          {t('landing.featuresTitle')}
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.5rem',
        }}>
          {FEATURES.map((feature, i) => (
            <div key={i} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{feature.icon}</div>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                {feature.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        background: 'var(--accent-green)', color: 'white',
        padding: '3rem 2rem', textAlign: 'center',
      }}>
        <h2 style={{ fontSize: '1.8rem', margin: '0 0 1rem' }}>
          {t('landing.ctaTitle')}
        </h2>
        <p style={{ fontSize: '1.1rem', margin: '0 0 2rem', opacity: 0.9 }}>
          {t('landing.ctaDesc')}
        </p>
        <button onClick={() => navigate('/register')} className="pill active">
          {t('landing.getStarted')}
        </button>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        <a href="/confidentialite" style={{ color: 'var(--text-secondary)', marginRight: '1rem' }}>
          Politique de confidentialité
        </a>
        <a href="/mentions-legales" style={{ color: 'var(--text-secondary)' }}>
          Mentions légales
        </a>
      </footer>
    </div>
  );
}
