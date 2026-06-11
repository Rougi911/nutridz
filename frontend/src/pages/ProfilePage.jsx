import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useProfileStore, useAuthStore } from '../store';
import { calcBMR, calcTDEE, calcTarget, calcIMC, imcStatus } from '../utils/api';
import { useTranslation } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import api from '../utils/api';
import GradientHeader from '../components/GradientHeader';
import LanguageSelector from '../components/LanguageSelector';

const GOAL_ICONS = { perte: '📉', maintien: '⚖️', prise: '💪', sante: '🫀' };
const SPORT_EMOJIS = { marche: '🚶', velo: '🚴', course: '🏃', natation: '🏊' };

export default function ProfilePage() {
  const navigate = useNavigate();
  const { profile, updateProfile, setProfileLocal } = useProfileStore();
  const { user, logout } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('corps');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [nutriStats, setNutriStats] = useState(null);

  useEffect(() => {
    api.get('/nutrition/stats').then(r => setNutriStats(r.data)).catch(() => {});
  }, []);

  async function handleExport() {
    try {
      const response = await api.get('/user/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nutrivita-mes-donnees.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Erreur lors du téléchargement'); }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await api.delete('/user/account');
      toast.success('Compte supprimé définitivement');
      logout();
    } catch { toast.error('Erreur lors de la suppression'); }
    finally { setDeleting(false); setShowDeleteModal(false); }
  }
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { permission, subscribe, unsubscribe } = usePushNotifications();

  const p = profile;
  const bmr = calcBMR(p.age, p.weight, p.height, p.sexe);
  const tdee = calcTDEE(bmr, p.activity_level);
  const target = calcTarget(tdee, p.goal, p.pace);
  const imc = calcIMC(p.weight, p.height);
  const { label: imcLabel, color: imcColor } = imcStatus(imc);
  const imcPct = Math.min(98, Math.max(2, ((imc - 14) / 26) * 100));

  const handleSave = async () => {
    setSaving(true);
    try { await updateProfile(p); toast.success(t('profile.saved')); }
    catch { toast.error(t('profile.saveError')); }
    finally { setSaving(false); }
  };

  const set = (key, val) => setProfileLocal({ [key]: val });

  const TABS = [
    { id: 'corps', icon: 'ti-ruler-measure' },
    { id: 'activite', icon: 'ti-heartbeat' },
    { id: 'objectif', icon: 'ti-target' },
    { id: 'bilan', icon: 'ti-chart-bar' },
  ];

  const LEVELS = ['sed', 'light', 'mod', 'actif'].map(id => ({
    id, label: t(`profile.activity.levels.${id}.label`), sub: t(`profile.activity.levels.${id}.sub`)
  }));

  const GOALS = ['perte', 'maintien', 'prise', 'sante'].map(id => ({
    id, icon: GOAL_ICONS[id], label: t(`profile.goals.${id}.label`), desc: t(`profile.goals.${id}.desc`)
  }));

  const SPORTS = ['marche', 'velo', 'course', 'natation'].map(id => ({
    id, emoji: SPORT_EMOJIS[id], label: t(`profile.activity.sports.${id}`)
  }));

  const BODY_FIELDS = [
    { key: 'age', min: 15, max: 80, step: 1 },
    { key: 'weight', min: 30, max: 150, step: 0.5 },
    { key: 'height', min: 140, max: 210, step: 1 },
  ];

  return (
    <div>
      <GradientHeader
        variant="slate"
        title={user?.name || t('profile.title')}
        subtitle={user?.email}
        icon="👤"
      />

      <div className="card" style={{ margin: '1rem 1.25rem 0', overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(0,0,0,0.06)', padding: '4px 8px 0', gap: 'var(--space-2xs)' }}>
          {TABS.map(({ id, icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`pill${tab === id ? ' active' : ''}`} style={{ flex: 1, fontSize: 'var(--font-size-2xs)', textAlign: 'center', border: 'none', cursor: 'pointer', padding: '6px 0', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', background: tab === id ? 'var(--accent-green)' : 'transparent', color: tab === id ? 'white' : 'var(--text-secondary)' }}>
              <i className={`ti ${icon}`} style={{ display: 'block', fontSize: 'var(--font-size-base)', marginBottom: '2px' }} />
              {t(`profile.tabs.${id}`)}
            </button>
          ))}
        </div>

        <div style={{ padding: '14px 16px' }}>
          {tab === 'corps' && (
            <>
              {BODY_FIELDS.map(({ key, min, max, step }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', width: '50px' }}>{t(`profile.fields.${key}`)}</span>
                  <input type="range" min={min} max={max} step={step} value={p[key]} onChange={e => set(key, parseFloat(e.target.value))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, minWidth: '52px', textAlign: 'right' }}>{p[key]} {t(`profile.units.${key}`)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', width: '50px' }}>{t('profile.fields.sexe')}</span>
                <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                  {[['h', 'homme'], ['f', 'femme']].map(([v, k]) => (
                    <button key={v} onClick={() => set('sexe', v)} style={{ flex: 1, padding: '6px 0', fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-sm)', border: '0.5px solid', cursor: 'pointer', background: p.sexe === v ? 'var(--accent-green)' : 'var(--bg-secondary)', borderColor: p.sexe === v ? 'var(--accent-green)' : 'rgba(0,0,0,0.12)', color: p.sexe === v ? 'white' : 'var(--text-secondary)' }}>
                      {t(`profile.fields.${k}`)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'activite' && (
            <>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}>{t('profile.activity.title')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '14px' }}>
                {LEVELS.map(l => (
                  <button key={l.id} onClick={() => set('activity_level', l.id)} style={{ padding: '8px', fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-sm)', border: '0.5px solid', cursor: 'pointer', background: p.activity_level === l.id ? 'var(--accent-green)' : 'var(--bg-secondary)', borderColor: p.activity_level === l.id ? 'var(--accent-green)' : 'rgba(0,0,0,0.1)', color: p.activity_level === l.id ? 'white' : 'var(--text-secondary)', lineHeight: 1.4, textAlign: 'center' }}>
                    {l.label}<br /><span style={{ fontSize: 'var(--font-size-2xs)', opacity: 0.7 }}>{l.sub}</span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}>{t('profile.activity.sport')}</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {SPORTS.map(s => (
                  <button key={s.id} onClick={() => set('sport', s.id)} style={{ padding: '5px 12px', fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-xl)', border: '0.5px solid', cursor: 'pointer', background: p.sport === s.id ? 'var(--accent-green)' : 'transparent', borderColor: p.sport === s.id ? 'var(--accent-green)' : 'rgba(0,0,0,0.12)', color: p.sport === s.id ? 'white' : 'var(--text-secondary)' }}>
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'objectif' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-xs)' }}>
              {GOALS.map(g => (
                <button key={g.id} onClick={() => set('goal', g.id)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: p.goal === g.id ? '2px solid var(--accent-green)' : '0.5px solid rgba(0,0,0,0.1)', background: p.goal === g.id ? 'var(--color-success-bg)' : 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-2xs)' }}>{g.icon}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: p.goal === g.id ? '#27500A' : 'var(--text-primary)' }}>{g.label}</div>
                  <div style={{ fontSize: 'var(--font-size-2xs)', color: p.goal === g.id ? '#3B6D11' : 'var(--text-secondary)', marginTop: '2px' }}>{g.desc}</div>
                </button>
              ))}
            </div>
          )}

          {tab === 'bilan' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-xs)', marginBottom: '12px' }}>
                {[
                  { key: 'bmr', val: bmr, unit: `${t('common.kcal')}/j` },
                  { key: 'tdee', val: tdee, unit: `${t('common.kcal')}/j` },
                  { key: 'target', val: target, unit: `${t('common.kcal')}/j`, highlight: true },
                  { key: 'imc', val: imc, unit: imcLabel }
                ].map(({ key, val, unit, highlight }) => (
                  <div key={key} style={{ background: highlight ? 'var(--color-success-bg)' : 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 500, color: highlight ? '#27500A' : 'var(--accent-green)' }}>{val}</div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.3 }}>{t(`profile.bilan.${key}`)}<br />{unit}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2xs)' }}>
                  <span>{t('profile.bilan.imc')} {imc}</span><span style={{ color: imcColor }}>{imcLabel}</span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-2xs)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${imcPct}%`, background: imcColor, borderRadius: 'var(--radius-2xs)' }} />
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '10px', background: 'var(--accent-green)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? t('profile.saving') : t('profile.save')}
          </button>
        </div>
      </div>

      {/* Couverture nutritionnelle */}
      {nutriStats && (
        <div className="card" style={{ margin: '1rem 1.25rem 0', padding: '14px 16px' }}>
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>📊 Bases nutritionnelles</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            {[
              { key: 'local',  icon: '📦', color: 'var(--accent-green)', bg: 'var(--color-success-bg)' },
              { key: 'ciqual', icon: '🇫🇷', color: '#185FA5', bg: '#EBF2FC' },
              { key: 'usda',   icon: '🇺🇸', color: '#BA7517', bg: '#FFF4E0' },
            ].map(({ key, icon, color, bg }) => {
              const s = nutriStats[key];
              if (!s) return null;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: bg, borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', color }}>{icon} {s.label}</span>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color }}>{s.count.toLocaleString()} aliments</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mes données (RGPD) */}
      <div className="card" style={{ margin: '1rem 1.25rem 0', padding: '14px 16px' }}>
        <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>Mes données</h3>
        <button onClick={handleExport}
          style={{ width: '100%', padding: '10px', marginBottom: 'var(--space-xs)', background: 'var(--color-success-bg)', color: 'var(--accent-green)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
          📥 Télécharger mes données (JSON)
        </button>
        <button onClick={() => setShowDeleteModal(true)}
          style={{ width: '100%', padding: '10px', background: 'var(--color-danger-bg)', color: '#993C1D', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
          🗑️ Supprimer mon compte
        </button>
      </div>

      {/* Language + Dark mode */}
      <div className="card" style={{ margin: '1rem 1.25rem 0', padding: '14px 16px' }}>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-xs)' }}>Langue</div>
          <LanguageSelector />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Thème sombre</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{theme === 'dark' ? 'Activé' : 'Désactivé'}</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              data-testid="dark-mode-toggle"
              checked={theme === 'dark'}
              onChange={toggleTheme}
              aria-label="Thème sombre"
              style={{ width: '40px', height: '22px', cursor: 'pointer', accentColor: 'var(--accent-green)' }}
            />
          </label>
        </div>
      </div>

      {/* Settings link */}
      <div style={{ margin: '1rem 1.25rem 0', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', boxShadow: '0 1px 3px var(--shadow)', overflow: 'hidden' }}>
        <button
          onClick={() => navigate('/settings')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0.85rem 1rem', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-primary)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.3rem' }}>⚙️</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: '500', fontSize: 'var(--font-size-sm)' }}>Paramètres</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Unités, données, apparence</div>
            </div>
          </div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>›</span>
        </button>
      </div>

      {/* Notifications push */}
      <div className="card" style={{ margin: '1rem 1.25rem 0', padding: '1rem' }}>
        <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
          🔔 {t('profile.notifications')}
        </h3>
        {permission === 'default' && (
          <button onClick={subscribe} style={{
            width: '100%', padding: '10px', background: 'var(--color-success-bg)', color: 'var(--accent-green)',
            border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 600, cursor: 'pointer',
          }}>
            {t('profile.enableNotifications')}
          </button>
        )}
        {permission === 'granted' && (
          <button onClick={unsubscribe} style={{
            width: '100%', padding: '10px', background: 'var(--color-danger-bg)', color: '#993C1D',
            border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 600, cursor: 'pointer',
          }}>
            {t('profile.disableNotifications')}
          </button>
        )}
        {permission === 'denied' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            {t('profile.notificationsDenied')}
          </p>
        )}
      </div>

      <div style={{ margin: '1rem 1.25rem 1rem' }}>
        <button onClick={logout} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#993C1D', border: '0.5px solid #993C1D', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
          <i className="ti ti-logout" style={{ marginRight: '6px' }} />{t('profile.logout')}
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '340px', width: '100%' }}>
            <div style={{ fontSize: 'var(--font-size-4xl)', textAlign: 'center', marginBottom: 12 }}>⚠️</div>
            <h3 style={{ textAlign: 'center', fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>Supprimer mon compte</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5, margin: '0 0 20px' }}>
              Cette action est <strong>irréversible</strong>. Toutes vos données (journal, activités, profil) seront définitivement supprimées.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowDeleteModal(false)}
                style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontWeight: 600, fontSize: 'var(--font-size-sm)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                Annuler
              </button>
              <button onClick={handleDeleteAccount} disabled={deleting}
                style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-md)', border: 'none', background: '#993C1D', color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-sm)', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
