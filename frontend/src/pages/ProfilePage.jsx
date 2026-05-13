import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useProfileStore, useAuthStore } from '../store';
import { calcBMR, calcTDEE, calcTarget, calcIMC, imcStatus } from '../utils/api';

const LEVELS = [
  { id: 'sed', label: 'Sédentaire', sub: 'Peu de sport' },
  { id: 'light', label: 'Léger', sub: '1–3×/semaine' },
  { id: 'mod', label: 'Modéré', sub: '3–5×/semaine' },
  { id: 'actif', label: 'Actif', sub: '6–7×/semaine' }
];
const GOALS = [
  { id: 'perte', label: 'Perte de poids', icon: '📉', desc: 'Réduire la masse grasse' },
  { id: 'maintien', label: 'Maintien', icon: '⚖️', desc: 'Conserver son poids' },
  { id: 'prise', label: 'Prise de masse', icon: '💪', desc: 'Développer le muscle' },
  { id: 'sante', label: 'Santé générale', icon: '🫀', desc: 'Manger équilibré' }
];
const SPORTS = [
  { id: 'marche', label: 'Marche', emoji: '🚶' },
  { id: 'velo', label: 'Vélo', emoji: '🚴' },
  { id: 'course', label: 'Course', emoji: '🏃' },
  { id: 'natation', label: 'Natation', emoji: '🏊' }
];

export default function ProfilePage() {
  const { profile, updateProfile, setProfileLocal } = useProfileStore();
  const { user, logout } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('corps');

  const p = profile;
  const bmr = calcBMR(p.age, p.weight, p.height, p.sexe);
  const tdee = calcTDEE(bmr, p.activity_level);
  const target = calcTarget(tdee, p.goal, p.pace);
  const imc = calcIMC(p.weight, p.height);
  const { label: imcLabel, color: imcColor } = imcStatus(imc);
  const imcPct = Math.min(98, Math.max(2, ((imc - 14) / 26) * 100));

  const handleSave = async () => {
    setSaving(true);
    try { await updateProfile(p); toast.success('Profil enregistré !'); }
    catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setSaving(false); }
  };

  const set = (key, val) => setProfileLocal({ [key]: val });

  const TABS = [
    { id: 'corps', label: 'Corps', icon: 'ti-ruler-measure' },
    { id: 'activite', label: 'Activité', icon: 'ti-heartbeat' },
    { id: 'objectif', label: 'Objectif', icon: 'ti-target' },
    { id: 'bilan', label: 'Bilan', icon: 'ti-chart-bar' }
  ];

  return (
    <div>
      <div style={{ background: '#1A6B3C', color: 'white', padding: '1rem 1.25rem 1.5rem', borderRadius: '0 0 24px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>👤 Mon profil</h1>
        {user && <p style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{user.name} · {user.email}</p>}
      </div>

      <div style={{ margin: '1rem 1.25rem 0', background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '9px 0', fontSize: 10, fontWeight: 500, textAlign: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: tab === t.id ? '#1A6B3C' : '#888', borderBottom: tab === t.id ? '2px solid #1A6B3C' : '2px solid transparent' }}>
              <i className={`ti ${t.icon}`} style={{ display: 'block', fontSize: 16, marginBottom: 2 }} />{t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '14px 16px' }}>
          {tab === 'corps' && (
            <>
              {[
                { key: 'age', label: 'Âge', min: 15, max: 80, unit: 'ans' },
                { key: 'weight', label: 'Poids', min: 30, max: 150, unit: 'kg', step: 0.5 },
                { key: 'height', label: 'Taille', min: 140, max: 210, unit: 'cm' }
              ].map(({ key, label, min, max, unit, step = 1 }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: '#888', width: 50 }}>{label}</span>
                  <input type="range" min={min} max={max} step={step} value={p[key]} onChange={e => set(key, parseFloat(e.target.value))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, minWidth: 52, textAlign: 'right' }}>{p[key]} {unit}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#888', width: 50 }}>Sexe</span>
                <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                  {[['h','Homme'],['f','Femme']].map(([v,l]) => (
                    <button key={v} onClick={() => set('sexe', v)} style={{ flex: 1, padding: '6px 0', fontSize: 12, borderRadius: 8, border: '0.5px solid', cursor: 'pointer', background: p.sexe === v ? '#1A6B3C' : '#f5f5f2', borderColor: p.sexe === v ? '#1A6B3C' : 'rgba(0,0,0,0.12)', color: p.sexe === v ? 'white' : '#555' }}>{l}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'activite' && (
            <>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Niveau d'activité habituel</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 14 }}>
                {LEVELS.map(l => (
                  <button key={l.id} onClick={() => set('activity_level', l.id)} style={{ padding: '8px', fontSize: 11, borderRadius: 8, border: `0.5px solid`, cursor: 'pointer', background: p.activity_level === l.id ? '#1A6B3C' : '#f5f5f2', borderColor: p.activity_level === l.id ? '#1A6B3C' : 'rgba(0,0,0,0.1)', color: p.activity_level === l.id ? 'white' : '#555', lineHeight: 1.4, textAlign: 'center' }}>
                    {l.label}<br /><span style={{ fontSize: 10, opacity: 0.7 }}>{l.sub}</span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Sport favori (calcul effort)</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SPORTS.map(s => (
                  <button key={s.id} onClick={() => set('sport', s.id)} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 20, border: '0.5px solid', cursor: 'pointer', background: p.sport === s.id ? '#1A6B3C' : 'transparent', borderColor: p.sport === s.id ? '#1A6B3C' : 'rgba(0,0,0,0.12)', color: p.sport === s.id ? 'white' : '#555' }}>
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'objectif' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {GOALS.map(g => (
                <button key={g.id} onClick={() => set('goal', g.id)} style={{ padding: 10, borderRadius: 8, border: p.goal === g.id ? '2px solid #1A6B3C' : '0.5px solid rgba(0,0,0,0.1)', background: p.goal === g.id ? '#EAF3DE' : '#f5f5f2', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{g.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: p.goal === g.id ? '#27500A' : '#333' }}>{g.label}</div>
                  <div style={{ fontSize: 10, color: p.goal === g.id ? '#3B6D11' : '#888', marginTop: 2 }}>{g.desc}</div>
                </button>
              ))}
            </div>
          )}

          {tab === 'bilan' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Métabolisme de base', val: bmr, unit: 'kcal/j' },
                  { label: 'Dépense totale', val: tdee, unit: 'kcal/j' },
                  { label: 'Objectif calorique', val: target, unit: 'kcal/j', highlight: true },
                  { label: 'IMC', val: imc, unit: imcLabel }
                ].map(({ label, val, unit, highlight }) => (
                  <div key={label} style={{ background: highlight ? '#EAF3DE' : '#f5f9f2', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 500, color: highlight ? '#27500A' : '#1A6B3C' }}>{val}</div>
                    <div style={{ fontSize: 10, color: '#888', marginTop: 2, lineHeight: 1.3 }}>{label}<br />{unit}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
                  <span>IMC {imc}</span><span style={{ color: imcColor }}>{imcLabel}</span>
                </div>
                <div style={{ height: 8, background: '#f0f0ec', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${imcPct}%`, background: imcColor, borderRadius: 4 }} />
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 10, background: '#1A6B3C', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Enregistrement...' : '✓ Enregistrer le profil'}
          </button>
        </div>
      </div>

      <div style={{ margin: '1rem 1.25rem' }}>
        <button onClick={logout} style={{ width: '100%', padding: 10, background: 'transparent', color: '#993C1D', border: '0.5px solid #993C1D', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
          <i className="ti ti-logout" style={{ marginRight: 6 }} />Se déconnecter
        </button>
      </div>
    </div>
  );
}
