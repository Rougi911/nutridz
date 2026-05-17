import React from 'react';
import { Link } from 'react-router-dom';

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 24 }}>
    <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A6B3C', marginBottom: 8 }}>{title}</h2>
    <div style={{ fontSize: 13, color: '#444', lineHeight: 1.7 }}>{children}</div>
  </div>
);

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px 40px', background: '#f7f7f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link to="/profile" style={{ color: '#1A6B3C', textDecoration: 'none', fontSize: 22 }}>←</Link>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Politique de confidentialité</h1>
      </div>

      <div style={{ background: '#fff', borderRadius: 20, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <p style={{ fontSize: 12, color: '#aaa', marginBottom: 20 }}>Dernière mise à jour : janvier 2025</p>

        <Section title="1. Données collectées">
          <p>NutriVita collecte les données suivantes dans le cadre de la fourniture de son service :</p>
          <ul style={{ paddingLeft: 18, marginTop: 6 }}>
            <li><strong>Données d'identification</strong> : adresse email, prénom et nom</li>
            <li><strong>Données de santé</strong> : poids, taille, âge, sexe, indice de masse corporelle (IMC)</li>
            <li><strong>Données nutritionnelles</strong> : calories ingérées, macronutriments (glucides, protéines, lipides), journal alimentaire</li>
            <li><strong>Données d'activité physique</strong> : activités sportives, calories dépensées, données synchronisées via Strava (durée, distance, type d'activité)</li>
            <li><strong>Données techniques</strong> : cookies de session, préférences de langue</li>
          </ul>
        </Section>

        <Section title="2. Finalité du traitement">
          <p>Vos données sont traitées exclusivement aux fins suivantes :</p>
          <ul style={{ paddingLeft: 18, marginTop: 6 }}>
            <li>Fourniture du service de suivi nutritionnel et de bien-être</li>
            <li>Calcul personnalisé de votre objectif calorique et de vos macronutriments</li>
            <li>Synchronisation de vos activités sportives via Strava</li>
            <li>Amélioration de l'expérience utilisateur (analytics anonymisés)</li>
          </ul>
          <p style={{ marginTop: 8 }}>Vos données de santé ne sont jamais vendues ni cédées à des tiers à des fins commerciales.</p>
        </Section>

        <Section title="3. Durée de conservation">
          <p>Vos données sont conservées pendant <strong>2 ans</strong> à compter de votre dernière connexion. À l'issue de cette période, elles sont automatiquement supprimées. Vous pouvez demander leur suppression à tout moment (voir section 6).</p>
        </Section>

        <Section title="4. Partenaires et sous-traitants">
          <p>NutriVita fait appel aux sous-traitants suivants :</p>
          <ul style={{ paddingLeft: 18, marginTop: 6 }}>
            <li><strong>Render.com</strong> (USA) — hébergement des serveurs et base de données. Données stockées aux États-Unis, couvertes par les clauses contractuelles types de l'UE.</li>
            <li><strong>Strava Inc.</strong> (USA) — synchronisation des activités sportives (optionnel, uniquement si vous connectez votre compte Strava).</li>
            <li><strong>Google Analytics</strong> — mesure d'audience anonymisée (uniquement si vous acceptez les cookies).</li>
          </ul>
        </Section>

        <Section title="5. Base légale du traitement">
          <p>Le traitement de vos données repose sur :</p>
          <ul style={{ paddingLeft: 18, marginTop: 6 }}>
            <li><strong>Votre consentement explicite</strong> pour les données de santé (recueilli à l'inscription)</li>
            <li><strong>L'exécution du contrat</strong> pour les données nécessaires au fonctionnement du service</li>
          </ul>
        </Section>

        <Section title="6. Vos droits">
          <p>Conformément au RGPD (Règlement UE 2016/679), vous disposez des droits suivants :</p>
          <ul style={{ paddingLeft: 18, marginTop: 6 }}>
            <li><strong>Droit d'accès</strong> : obtenir une copie de vos données personnelles</li>
            <li><strong>Droit de rectification</strong> : corriger des données inexactes</li>
            <li><strong>Droit à l'effacement</strong> : demander la suppression de votre compte et de toutes vos données</li>
            <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré (JSON)</li>
            <li><strong>Droit d'opposition</strong> : vous opposer au traitement à des fins d'analytics</li>
          </ul>
          <p style={{ marginTop: 10 }}>Ces droits peuvent être exercés directement depuis votre <Link to="/profile" style={{ color: '#1A6B3C' }}>profil</Link> (section "Mes données") ou par email à :</p>
          <p style={{ marginTop: 6, fontWeight: 600, color: '#1A6B3C' }}>dpo@nutrivita.app</p>
          <p style={{ marginTop: 6, fontSize: 12, color: '#aaa' }}>Vous pouvez également introduire une réclamation auprès de la CNIL (www.cnil.fr).</p>
        </Section>

        <Section title="7. Cookies">
          <p>NutriVita utilise des cookies strictement nécessaires au fonctionnement du service (session, langue). Des cookies analytics (Google Analytics) peuvent être déposés uniquement avec votre consentement explicite, que vous pouvez retirer à tout moment.</p>
        </Section>
      </div>
    </div>
  );
}
