import React from 'react';
import { Link } from 'react-router-dom';

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 'var(--space-section)' }}>
    <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--accent-green)', marginBottom: 'var(--space-xs)' }}>{title}</h2>
    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', lineHeight: 1.7 }}>{children}</div>
  </div>
);

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 20px 40px', background: 'var(--bg-secondary)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-tight)', marginBottom: 'var(--space-section)' }}>
        <Link to="/profile" style={{ color: 'var(--accent-green)', textDecoration: 'none', fontSize: 'var(--font-size-xl)' }}>←</Link>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Politique de confidentialité</h1>
      </div>

      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '20px', boxShadow: '0 1px 4px var(--shadow)' }}>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-section)' }}>Dernière mise à jour : janvier 2025</p>

        <Section title="1. Données collectées">
          <p>NutraLance collecte les données suivantes dans le cadre de la fourniture de son service :</p>
          <ul style={{ paddingLeft: '18px', marginTop: '6px' }}>
            <li><strong>Données d'identification</strong> : adresse email, prénom et nom</li>
            <li><strong>Données de santé</strong> : poids, taille, âge, sexe, indice de masse corporelle (IMC)</li>
            <li><strong>Données nutritionnelles</strong> : calories ingérées, macronutriments (glucides, protéines, lipides), journal alimentaire</li>
            <li><strong>Données d'activité physique</strong> : activités sportives, calories dépensées, données synchronisées via Strava (durée, distance, type d'activité)</li>
            <li><strong>Données techniques</strong> : cookies de session, préférences de langue</li>
          </ul>
        </Section>

        <Section title="2. Finalité du traitement">
          <p>Vos données sont traitées exclusivement aux fins suivantes :</p>
          <ul style={{ paddingLeft: '18px', marginTop: '6px' }}>
            <li>Fourniture du service de suivi nutritionnel et de bien-être</li>
            <li>Calcul personnalisé de votre objectif calorique et de vos macronutriments</li>
            <li>Synchronisation de vos activités sportives via Strava</li>
            <li>Amélioration de l'expérience utilisateur (analytics anonymisés)</li>
          </ul>
          <p style={{ marginTop: 'var(--space-xs)' }}>Vos données de santé ne sont jamais vendues ni cédées à des tiers à des fins commerciales.</p>
        </Section>

        <Section title="3. Durée de conservation">
          <p>Vos données sont conservées pendant <strong>2 ans</strong> à compter de votre dernière connexion. À l'issue de cette période, elles sont automatiquement supprimées. Vous pouvez demander leur suppression à tout moment (voir section 6).</p>
        </Section>

        <Section title="4. Partenaires et sous-traitants">
          <p>NutraLance fait appel aux sous-traitants suivants :</p>
          <ul style={{ paddingLeft: '18px', marginTop: '6px' }}>
            <li><strong>Render.com</strong> (USA) — hébergement des serveurs et base de données. Données stockées aux États-Unis, couvertes par les clauses contractuelles types de l'UE.</li>
            <li><strong>Strava Inc.</strong> (USA) — synchronisation des activités sportives (optionnel, uniquement si vous connectez votre compte Strava).</li>
            <li><strong>Google Analytics</strong> — mesure d'audience anonymisée (uniquement si vous acceptez les cookies).</li>
          </ul>
        </Section>

        <Section title="5. Base légale du traitement">
          <p>Le traitement de vos données repose sur :</p>
          <ul style={{ paddingLeft: '18px', marginTop: '6px' }}>
            <li><strong>Votre consentement explicite</strong> pour les données de santé (recueilli à l'inscription)</li>
            <li><strong>L'exécution du contrat</strong> pour les données nécessaires au fonctionnement du service</li>
          </ul>
        </Section>

        <Section title="6. Vos droits">
          <p>Conformément au RGPD (Règlement UE 2016/679), vous disposez des droits suivants :</p>
          <ul style={{ paddingLeft: '18px', marginTop: '6px' }}>
            <li><strong>Droit d'accès</strong> : obtenir une copie de vos données personnelles</li>
            <li><strong>Droit de rectification</strong> : corriger des données inexactes</li>
            <li><strong>Droit à l'effacement</strong> : demander la suppression de votre compte et de toutes vos données</li>
            <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré (JSON)</li>
            <li><strong>Droit d'opposition</strong> : vous opposer au traitement à des fins d'analytics</li>
          </ul>
          <p style={{ marginTop: '10px' }}>Ces droits peuvent être exercés directement depuis votre <Link to="/profile" style={{ color: 'var(--accent-green)' }}>profil</Link> (section "Mes données") ou par email à :</p>
          <p style={{ marginTop: '6px', fontWeight: 600, color: 'var(--accent-green)' }}>dpo@nutrivita.app</p>
          <p style={{ marginTop: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Vous pouvez également introduire une réclamation auprès de la CNIL (www.cnil.fr).</p>
        </Section>

        <Section title="7. Cookies">
          <p>NutraLance utilise des cookies strictement nécessaires au fonctionnement du service (session, langue). Des cookies analytics (Google Analytics) peuvent être déposés uniquement avec votre consentement explicite, que vous pouvez retirer à tout moment.</p>
        </Section>
      </div>
    </div>
  );
}
