import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useTranslation } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import useSettingsStore from '../store/useSettingsStore';

function Section({ title, icon, children }) {
  return (
    <div style={{
      margin: '0 1.25rem 1.25rem',
      background: 'var(--bg-primary)',
      borderRadius: '12px',
      boxShadow: '0 1px 3px var(--shadow)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '0.75rem 1rem',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span>{icon}</span>
        <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
      </div>
      <div>{children}</div>
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
        <div style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: '1rem' }}>{children}</div>
    </div>
  );
}

function UnitToggle({ value, options, onChange }) {
  return (
    <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '0.35rem 0.75rem',
            border: 'none',
            background: value === opt.value ? 'var(--accent-blue)' : 'var(--bg-primary)',
            color: value === opt.value ? 'white' : 'var(--text-secondary)',
            fontWeight: value === opt.value ? '700' : '400',
            cursor: 'pointer',
            fontSize: '0.85rem',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  useTranslation(); // keep language context active
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
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
    { id: 'journal', label: 'Effacer le journal alimentaire', desc: 'Supprime toutes les entrées de repas', icon: '🍽️', endpoint: '/journal/all', color: '#f59e0b' },
    { id: 'weight',  label: 'Effacer les données de poids',   desc: "Supprime tout l'historique de poids",   icon: '⚖️', endpoint: '/weight/all',  color: '#f59e0b' },
    { id: 'glucose', label: 'Effacer les données de glycémie', desc: 'Supprime toutes les lectures de glycémie', icon: '🩸', endpoint: '/glucose/all', color: '#f59e0b' },
    { id: 'all',     label: 'Réinitialiser toutes les données', desc: 'Supprime TOUTES les données (irréversible)', icon: '⚠️', endpoint: '/profile/reset-data', color: '#ef4444' },
  ];

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
        padding: '1rem 1.25rem',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        marginBottom: '1.25rem',
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
          ⚙️ Paramètres
        </h1>
      </div>

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
            { key: 'glucides',  label: '🍚 Glucides',  color: '#3b82f6' },
            { key: 'proteines', label: '🥩 Protéines', color: '#10b981' },
            { key: 'lipides',   label: '🥑 Lipides',   color: '#f59e0b' },
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
            padding: '0.5rem 0.75rem', borderRadius: '8px',
            background: macrosTotal === 100 ? '#dcfce7' : '#fee2e2',
            marginBottom: '0.75rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: macrosTotal === 100 ? '#10b981' : '#ef4444' }}>
              Total : {macrosTotal}%
            </span>
            <span style={{ fontSize: '0.85rem', color: macrosTotal === 100 ? '#10b981' : '#ef4444' }}>
              {macrosTotal === 100 ? '✅ Correct' : `${100 - macrosTotal > 0 ? '+' : ''}${100 - macrosTotal}% manquants`}
            </span>
          </div>
          <button
            onClick={saveMacros}
            disabled={macrosTotal !== 100}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none',
              background: macrosTotal === 100 ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
              color: macrosTotal === 100 ? 'white' : 'var(--text-secondary)',
              fontWeight: '600', cursor: macrosTotal === 100 ? 'pointer' : 'not-allowed',
            }}
          >
            Sauvegarder les objectifs
          </button>
        </div>
      </Section>

      {/* Apparence */}
      <Section title="Apparence" icon="🎨">
        <SettingRow label="Mode sombre" desc="Réduit la fatigue oculaire" last>
          <button
            onClick={toggleTheme}
            style={{
              padding: '0.4rem 1rem', borderRadius: '20px', border: 'none',
              background: theme === 'dark' ? 'var(--accent-purple)' : 'var(--accent-blue)',
              color: 'white', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem',
            }}
          >
            {theme === 'dark' ? '🌙 Sombre' : '☀️ Clair'}
          </button>
        </SettingRow>
      </Section>

      {/* Gestion des données */}
      <Section title="Gestion des données" icon="🗄️">
        {deleteOptions.map((option, i) => (
          <SettingRow key={option.id} label={`${option.icon} ${option.label}`} desc={option.desc} last={i === deleteOptions.length - 1}>
            <button
              onClick={() => setConfirmDelete(option)}
              style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: `1px solid ${option.color}`, background: 'transparent', color: option.color, fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
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
            style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid var(--accent-blue)', background: 'transparent', color: 'var(--accent-blue)', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
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

      {/* Modal confirmation suppression */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '1.5rem', maxWidth: '360px', width: '100%' }}>
            <h3 style={{ margin: '0 0 0.75rem', color: confirmDelete.color }}>
              {confirmDelete.icon} Confirmer la suppression
            </h3>
            <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              {confirmDelete.desc}. <strong>Cette action est irréversible.</strong>
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={deleting} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: confirmDelete.color, color: 'white', fontWeight: '700', cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? '...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
