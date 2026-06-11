import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useTranslation } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import useSettingsStore from '../store/useSettingsStore';
import { useProfileStore } from '../store';

function Section({ title, icon, children }) {
  return (
    <div style={{ margin: '0 1.25rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', paddingLeft: '2px' }}>
        <span style={{ fontSize: '0.9rem' }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
      </div>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, desc, children, last }) {
  return (
    <div style={{
      padding: '0.85rem 1rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: last ? 'none' : '1px solid var(--border-color)',
    }}>
      <div>
        <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: '1rem' }}>{children}</div>
    </div>
  );
}

function UnitToggle({ value, options, onChange }) {
  return (
    <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', padding: '3px', gap: '2px' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '0.3rem 0.7rem',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            background: value === opt.value ? 'var(--accent-blue)' : 'transparent',
            color: value === opt.value ? 'white' : 'var(--text-secondary)',
            fontWeight: value === opt.value ? 700 : 400,
            cursor: 'pointer',
            fontSize: '0.82rem',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const GOAL_LABELS = { perte: 'Perte de poids', maintien: 'Maintien', prise: 'Prise de masse', sante: 'Santé' };

export default function SettingsPage() {
  const { lang, setLang } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { profile } = useProfileStore();
  const {
    weightUnit,  setWeightUnit,
    heightUnit,  setHeightUnit,
    glucoseUnit, setGlucoseUnit,
    energyUnit,  setEnergyUnit,
    macroTargets, setMacroTargets,
  } = useSettingsStore();

  const [macros, setMacros] = useState(macroTargets);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const macrosTotal = macros.glucides + macros.proteines + macros.lipides;

  const saveMacros = () => {
    if (macrosTotal !== 100) {
      toast.error(`Total = ${macrosTotal}% — doit être égal à 100%`);
      return;
    }
    setMacroTargets(macros);
    toast.success('Objectifs macros sauvegardés');
  };

  const deleteOptions = [
    { id: 'journal', label: 'Effacer le journal alimentaire', desc: 'Supprime toutes les entrées de repas', icon: '🍽️', endpoint: '/journal/all', color: 'var(--accent-yellow)' },
    { id: 'weight',  label: 'Effacer les données de poids',   desc: "Supprime tout l'historique de poids",   icon: '⚖️', endpoint: '/weight/all',  color: 'var(--accent-yellow)' },
    { id: 'glucose', label: 'Effacer les données de glycémie', desc: 'Supprime toutes les lectures de glycémie', icon: '🩸', endpoint: '/glucose/all', color: 'var(--accent-yellow)' },
    { id: 'all',     label: 'Réinitialiser toutes les données', desc: 'Supprime TOUTES les données (irréversible)', icon: '⚠️', endpoint: '/profile/reset-data', color: 'var(--accent-red)' },
  ];

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api.delete('/user/account');
      localStorage.clear();
      toast.success('Compte supprimé');
      navigate('/login');
    } catch {
      toast.error('Erreur lors de la suppression du compte');
      setShowDeleteAccount(false);
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDelete = async (option) => {
    setDeleting(true);
    try {
      await api.delete(option.endpoint);
      toast.success(`${option.label} effectué`);
      setConfirmDelete(null);
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ paddingBottom: '5rem', background: 'var(--bg-secondary)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{
        padding: '0.85rem 1.25rem',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        marginBottom: '1rem',
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Paramètres
        </h1>
      </div>

      {/* Profile card */}
      {profile && (
        <div style={{ margin: '0 1.25rem 1rem' }}>
          <div className="gradient-hero" style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--font-size-2xl)', flexShrink: 0 }}>
                  👤
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{profile.prenom || 'Utilisateur'}</h2>
                  {profile.age && <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', opacity: 0.8 }}>{profile.age} ans{profile.height ? ` · ${profile.height} cm` : ''}{profile.weight ? ` · ${profile.weight} kg` : ''}</p>}
                  {profile.goal && <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', opacity: 0.8 }}>Objectif : {GOAL_LABELS[profile.goal] || profile.goal}</p>}
                  {profile.target_kcal && <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 600, opacity: 0.95 }}>{profile.target_kcal} kcal/jour recommandées</p>}
                </div>
              </div>
              <button onClick={() => navigate('/profile')} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)', color: 'white', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unités de mesure */}
      <Section title="Unités de mesure" icon="📐">
        <SettingRow label="Poids" desc="Affichage de votre poids et des aliments">
          <UnitToggle value={weightUnit} options={[{ value: 'kg', label: 'kg' }, { value: 'lbs', label: 'lbs' }]} onChange={setWeightUnit} />
        </SettingRow>
        <SettingRow label="Taille" desc="Affichage de votre taille dans le profil">
          <UnitToggle value={heightUnit} options={[{ value: 'cm', label: 'cm' }, { value: 'ft', label: 'ft' }]} onChange={setHeightUnit} />
        </SettingRow>
        <SettingRow label="Glycémie" desc={glucoseUnit === 'mmol/L' ? 'Cible : 3.9–10.0 mmol/L' : 'Cible : 70–180 mg/dL'}>
          <UnitToggle
            value={glucoseUnit}
            options={[{ value: 'mg/dL', label: 'mg/dL' }, { value: 'mmol/L', label: 'mmol/L' }]}
            onChange={(unit) => { setGlucoseUnit(unit); toast.success(unit === 'mmol/L' ? 'Glycémie en mmol/L' : 'Glycémie en mg/dL'); }}
          />
        </SettingRow>
        <SettingRow label="Énergie" desc="Unité pour les calories" last>
          <UnitToggle value={energyUnit} options={[{ value: 'kcal', label: 'kcal' }, { value: 'kJ', label: 'kJ' }]} onChange={setEnergyUnit} />
        </SettingRow>
      </Section>

      {/* Objectifs macros */}
      <Section title="Objectifs macronutriments" icon="🎯">
        <div style={{ padding: '1rem' }}>
          <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Répartition cible en % des calories journalières. Total = 100%.
          </p>
          {[
            { key: 'glucides',  label: '🍚 Glucides',  color: 'var(--accent-blue)' },
            { key: 'proteines', label: '🥩 Protéines', color: 'var(--accent-green)' },
            { key: 'lipides',   label: '🥑 Lipides',   color: 'var(--accent-yellow)' },
          ].map(macro => (
            <div key={macro.key} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{macro.label}</label>
                <span style={{ fontWeight: '700', color: macro.color }}>{macros[macro.key]}%</span>
              </div>
              <input
                type="range" min="5" max="75" step="5"
                value={macros[macro.key]}
                onChange={(e) => setMacros(prev => ({ ...prev, [macro.key]: parseInt(e.target.value) }))}
                style={{ width: '100%', accentColor: macro.color }}
              />
            </div>
          ))}
          <div style={{
            padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
            background: macrosTotal === 100 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            marginBottom: '0.75rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: macrosTotal === 100 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              Total : {macrosTotal}%
            </span>
            <span style={{ fontSize: '0.85rem', color: macrosTotal === 100 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {macrosTotal === 100 ? '✅ Correct' : `${100 - macrosTotal > 0 ? '+' : ''}${100 - macrosTotal}% manquants`}
            </span>
          </div>
          <button
            onClick={saveMacros}
            disabled={macrosTotal !== 100}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: 'none',
              background: macrosTotal === 100 ? 'var(--color-info-bg)' : 'var(--bg-tertiary)',
              color: macrosTotal === 100 ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontWeight: '600', cursor: macrosTotal === 100 ? 'pointer' : 'not-allowed',
            }}
          >
            Sauvegarder les objectifs
          </button>
        </div>
      </Section>

      {/* Apparence */}
      <Section title="Apparence" icon="🎨">
        <SettingRow label="Thème" desc="Apparence de l'application">
          <UnitToggle
            value={theme}
            options={[{ value: 'light', label: '☀️ Clair' }, { value: 'dark', label: '🌙 Sombre' }]}
            onChange={(v) => { if (v !== theme) toggleTheme(); }}
          />
        </SettingRow>
        <SettingRow label="Langue" last>
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', padding: '3px', gap: '2px' }}>
            {[['fr', 'FR'], ['en', 'EN'], ['ar', 'عربي']].map(([code, label]) => (
              <button key={code} onClick={() => setLang(code)} style={{
                padding: '0.3rem 0.6rem', border: 'none', borderRadius: 'var(--radius-full)',
                background: lang === code ? 'var(--accent-blue)' : 'transparent',
                color: lang === code ? 'white' : 'var(--text-secondary)',
                fontWeight: lang === code ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem', transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        </SettingRow>
      </Section>

      {/* Gestion des données */}
      <Section title="Gestion des données" icon="🗄️">
        {deleteOptions.map((option, i) => (
          <SettingRow key={option.id} label={`${option.icon} ${option.label}`} desc={option.desc} last={i === deleteOptions.length - 1}>
            <button
              onClick={() => setConfirmDelete(option)}
              style={{ padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-xs)', border: `1px solid ${option.color}`, background: 'transparent', color: option.color, fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
              Effacer
            </button>
          </SettingRow>
        ))}
        <SettingRow label="📦 Exporter mes données" desc="Télécharger toutes vos données (RGPD)" last>
          <button
            onClick={async () => {
              try {
                const res = await api.get('/user/export', { responseType: 'blob' });
                const url = URL.createObjectURL(res.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = `nutrivita-export-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                toast.success('Export téléchargé');
              } catch {
                toast.error('Erreur export');
              }
            }}
            style={{ padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--accent-blue)', background: 'transparent', color: 'var(--accent-blue)', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Exporter
          </button>
        </SettingRow>
      </Section>

      {/* À propos */}
      <Section title="À propos" icon="ℹ️">
        <SettingRow label="Version" last={false}><span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>NutriVita v1.0.0</span></SettingRow>
        <SettingRow label="Backend" last={false}><span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'monospace' }}>nutridz.onrender.com</span></SettingRow>
        <SettingRow label="Base alimentaire" last><span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>CIQUAL + USDA</span></SettingRow>
      </Section>

      {/* Delete account */}
      <div style={{ margin: '0.5rem 1.25rem 1.5rem' }}>
        <button
          onClick={() => setShowDeleteAccount(true)}
          style={{ width: '100%', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--accent-red)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-xs)' }}
        >
          🗑️ Supprimer mon compte
        </button>
      </div>

      {/* Modal confirmation suppression */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '1.5rem', maxWidth: '360px', width: '100%' }}>
            <h3 style={{ margin: '0 0 0.75rem', color: confirmDelete.color }}>
              {confirmDelete.icon} Confirmer la suppression
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              {confirmDelete.desc}. <strong>Cette action est irréversible.</strong>
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={deleting} style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: 'none', background: confirmDelete.color, color: 'white', fontWeight: '700', cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? '...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression compte */}
      {showDeleteAccount && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', maxWidth: '360px', width: '100%' }}>
            <h3 style={{ margin: '0 0 0.75rem', color: 'var(--accent-red)' }}>🗑️ Supprimer le compte</h3>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Cette action est <strong>irréversible</strong>. Toutes vos données (journal, poids, glycémie, profil) seront définitivement supprimées.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setShowDeleteAccount(false)} disabled={deletingAccount} style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={handleDeleteAccount} disabled={deletingAccount} style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent-red)', color: 'white', fontWeight: '700', cursor: deletingAccount ? 'not-allowed' : 'pointer' }}>
                {deletingAccount ? '...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
