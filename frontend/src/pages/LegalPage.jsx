import React from 'react';
import { Link } from 'react-router-dom';

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 'var(--space-section)' }}>
    <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--accent-green)', marginBottom: 'var(--space-xs)' }}>{title}</h2>
    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', lineHeight: 1.7 }}>{children}</div>
  </div>
);

export default function LegalPage() {
  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 20px 40px', background: 'var(--bg-secondary)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-tight)', marginBottom: 'var(--space-section)' }}>
        <Link to="/profile" style={{ color: 'var(--accent-green)', textDecoration: 'none', fontSize: 'var(--font-size-xl)' }}>←</Link>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Mentions légales</h1>
      </div>

      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '20px', boxShadow: '0 1px 4px var(--shadow)' }}>

        <Section title="Éditeur de l'application">
          <p><strong>NutriVita</strong></p>
          <p>Application de suivi nutritionnel et de bien-être</p>
          <p style={{ marginTop: 'var(--space-xs)' }}>Contact : <a href="mailto:contact@nutrivita.app" style={{ color: 'var(--accent-green)' }}>contact@nutrivita.app</a></p>
          <p>Délégué à la Protection des Données : <a href="mailto:dpo@nutrivita.app" style={{ color: 'var(--accent-green)' }}>dpo@nutrivita.app</a></p>
        </Section>

        <Section title="Hébergement">
          <p><strong>Render.com</strong></p>
          <p>525 Brannan St, Suite 300<br />San Francisco, CA 94107<br />États-Unis</p>
          <p style={{ marginTop: '6px' }}>Site web : <a href="https://render.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-green)' }}>render.com</a></p>
        </Section>

        <Section title="Propriété intellectuelle">
          <p>L'application NutriVita, son contenu et ses fonctionnalités sont protégés par le droit de la propriété intellectuelle. Toute reproduction, même partielle, est interdite sans autorisation préalable.</p>
        </Section>

        <Section title="Données de santé">
          <p>NutriVita traite des données de santé (poids, calories, activités physiques) avec le consentement explicite des utilisateurs, conformément au RGPD (Règlement UE 2016/679) et à la loi Informatique et Libertés.</p>
          <p style={{ marginTop: 'var(--space-xs)' }}>Pour exercer vos droits : <a href="mailto:dpo@nutrivita.app" style={{ color: 'var(--accent-green)' }}>dpo@nutrivita.app</a></p>
        </Section>

        <Section title="Limitation de responsabilité">
          <p>Les informations nutritionnelles fournies par NutriVita sont données à titre indicatif et ne constituent pas un avis médical. Consultez un professionnel de santé pour tout suivi médical.</p>
        </Section>

        <Section title="Droit applicable">
          <p>Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux français sont compétents.</p>
        </Section>

        <div style={{ marginTop: 'var(--space-section)', padding: 'var(--space-tight) var(--space-card)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', margin: 0 }}>
            Voir aussi notre <Link to="/confidentialite" style={{ color: 'var(--accent-green)' }}>Politique de confidentialité</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
