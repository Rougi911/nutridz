import React from 'react';
import { Link } from 'react-router-dom';

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 24 }}>
    <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A6B3C', marginBottom: 8 }}>{title}</h2>
    <div style={{ fontSize: 13, color: '#444', lineHeight: 1.7 }}>{children}</div>
  </div>
);

export default function LegalPage() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px 40px', background: '#f7f7f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link to="/profile" style={{ color: '#1A6B3C', textDecoration: 'none', fontSize: 22 }}>←</Link>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Mentions légales</h1>
      </div>

      <div style={{ background: '#fff', borderRadius: 20, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

        <Section title="Éditeur de l'application">
          <p><strong>NutriVita</strong></p>
          <p>Application de suivi nutritionnel et de bien-être</p>
          <p style={{ marginTop: 8 }}>Contact : <a href="mailto:contact@nutrivita.app" style={{ color: '#1A6B3C' }}>contact@nutrivita.app</a></p>
          <p>Délégué à la Protection des Données : <a href="mailto:dpo@nutrivita.app" style={{ color: '#1A6B3C' }}>dpo@nutrivita.app</a></p>
        </Section>

        <Section title="Hébergement">
          <p><strong>Render.com</strong></p>
          <p>525 Brannan St, Suite 300<br />San Francisco, CA 94107<br />États-Unis</p>
          <p style={{ marginTop: 6 }}>Site web : <a href="https://render.com" target="_blank" rel="noopener noreferrer" style={{ color: '#1A6B3C' }}>render.com</a></p>
        </Section>

        <Section title="Propriété intellectuelle">
          <p>L'application NutriVita, son contenu et ses fonctionnalités sont protégés par le droit de la propriété intellectuelle. Toute reproduction, même partielle, est interdite sans autorisation préalable.</p>
        </Section>

        <Section title="Données de santé">
          <p>NutriVita traite des données de santé (poids, calories, activités physiques) avec le consentement explicite des utilisateurs, conformément au RGPD (Règlement UE 2016/679) et à la loi Informatique et Libertés.</p>
          <p style={{ marginTop: 8 }}>Pour exercer vos droits : <a href="mailto:dpo@nutrivita.app" style={{ color: '#1A6B3C' }}>dpo@nutrivita.app</a></p>
        </Section>

        <Section title="Limitation de responsabilité">
          <p>Les informations nutritionnelles fournies par NutriVita sont données à titre indicatif et ne constituent pas un avis médical. Consultez un professionnel de santé pour tout suivi médical.</p>
        </Section>

        <Section title="Droit applicable">
          <p>Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux français sont compétents.</p>
        </Section>

        <div style={{ marginTop: 24, padding: '12px 16px', background: '#f9f9f9', borderRadius: 12 }}>
          <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
            Voir aussi notre <Link to="/confidentialite" style={{ color: '#1A6B3C' }}>Politique de confidentialité</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
