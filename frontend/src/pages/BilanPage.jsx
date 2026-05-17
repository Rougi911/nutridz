import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';
import { useActivityStore, useProfileStore } from '../store';
import { calcBMR, calcTDEE, calcTarget } from '../utils/api';
import ActivityForm from '../components/ActivityForm';

const SPORT_ICONS = { marche: '🚶', course: '🏃', velo: '🚴', natation: '🏊', muscu: '💪' };

// ─── SVG donut ring ────────────────────────────────────────────────────────────
function CalorieRing({ ingested, burned, target }) {
  const SIZE = 200;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R_OUTER = 78;
  const R_INNER = 56;
  const C_OUTER = 2 * Math.PI * R_OUTER;
  const C_INNER = 2 * Math.PI * R_INNER;

  const burnedRatio = Math.min(burned / (target || 1), 1);
  const ingestedRatio = Math.min(ingested / (target || 1), 1);

  const balance = ingested - burned;
  const isDeficit = balance <= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Outer track — burned */}
        <circle cx={cx} cy={cy} r={R_OUTER} fill="none" stroke="#f0f0f0" strokeWidth={14} />
        <circle
          cx={cx} cy={cy} r={R_OUTER} fill="none"
          stroke="#FF6B35" strokeWidth={14}
          strokeDasharray={`${burnedRatio * C_OUTER} ${C_OUTER}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />

        {/* Inner track — ingested */}
        <circle cx={cx} cy={cy} r={R_INNER} fill="none" stroke="#f0f0f0" strokeWidth={14} />
        <circle
          cx={cx} cy={cy} r={R_INNER} fill="none"
          stroke="#1A6B3C" strokeWidth={14}
          strokeDasharray={`${ingestedRatio * C_INNER} ${C_INNER}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />

        {/* Center text */}
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={26} fontWeight={800}
          fill={isDeficit ? '#1A6B3C' : '#CC4400'}>
          {isDeficit ? `−${Math.abs(balance)}` : `+${balance}`}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={11} fill="#888">
          kcal
        </text>
        <text x={cx} y={cy + 28} textAnchor="middle" fontSize={10} fill={isDeficit ? '#1A6B3C' : '#CC4400'} fontWeight={600}>
          {isDeficit ? 'Déficit' : 'Surplus'}
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#666' }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#1A6B3C' }} />
          Ingérées
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#666' }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#FF6B35' }} />
          Dépensées
        </div>
      </div>
    </div>
  );
}

// ─── Activity row ──────────────────────────────────────────────────────────────
function ActivityRow({ activity, t }) {
  const icon = SPORT_ICONS[activity.type] || '🏃';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: '0.5px solid #f0f0f0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: '#FFF3ED',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#222' }}>
            {t(`bilan.sport.${activity.type}`) || activity.type}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
            {activity.duration_min} min
            {activity.distance_km > 0 && ` · ${activity.distance_km} km`}
            {' · '}
            <span style={{
              fontSize: 11, background: activity.source === 'strava' ? '#FC4C02' : '#e8f5e9',
              color: activity.source === 'strava' ? '#fff' : '#1A6B3C',
              padding: '1px 6px', borderRadius: 6, fontWeight: 600,
            }}>
              {activity.source === 'strava' ? 'Strava' : 'Manuel'}
            </span>
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#FF6B35' }}>
          −{Math.round(activity.calories_burned)}
        </div>
        <div style={{ fontSize: 11, color: '#aaa' }}>kcal</div>
      </div>
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function BilanPage() {
  const { t } = useTranslation();
  const { bilan, loading, fetchBilan, addActivity, fetchStravaToday, getStravaAuthUrl } = useActivityStore();
  const profile = useProfileStore(s => s.profile);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingStrava, setSyncingStrava] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const target_kcal = profile
    ? calcTarget(
        calcTDEE(calcBMR(profile.age, profile.weight, profile.height, profile.sexe), profile.activity_level),
        profile.goal,
        profile.pace
      )
    : bilan?.target_kcal || 2000;

  useEffect(() => { fetchBilan(today); }, []);

  // Handle return from Strava OAuth redirect (?strava=ok or ?strava=error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const strava = params.get('strava');
    if (strava === 'ok') {
      toast.success('Strava connecté avec succès !');
      fetchBilan(today);
      window.history.replaceState({}, '', '/bilan');
    } else if (strava === 'error') {
      toast.error('Échec connexion Strava');
      window.history.replaceState({}, '', '/bilan');
    }
  }, []);

  async function handleConnectStrava() {
    try {
      const url = await getStravaAuthUrl();
      // window.open is blocked on mobile PWA — use full-page redirect
      window.location.href = url;
    } catch (err) {
      const msg = err?.response?.data?.error || 'Impossible de se connecter à Strava';
      toast.error(msg);
    }
  }

  async function handleSyncStrava() {
    setSyncingStrava(true);
    try {
      const result = await fetchStravaToday();
      setStravaConnected(result.connected);
      if (result.connected) {
        toast.success(`${result.activities.length} activité(s) synchronisée(s)`);
      } else {
        toast.error('Strava non connecté');
      }
    } catch {
      toast.error('Erreur synchronisation Strava');
    } finally {
      setSyncingStrava(false);
    }
  }

  async function handleSaveActivity(activity) {
    setSaving(true);
    try {
      await addActivity({ ...activity, date: today });
      toast.success(t('bilan.saved'));
      setShowForm(false);
    } catch {
      toast.error(t('bilan.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  const ingested = bilan?.ingested_kcal || 0;
  const burned = bilan?.burned_kcal || 0;
  const activities = bilan?.activities || [];

  const statCards = [
    { label: t('bilan.ingested'), value: ingested, unit: 'kcal', color: '#1A6B3C', bg: '#EAF3DE', icon: '🍽️' },
    { label: t('bilan.burned'),   value: burned,   unit: 'kcal', color: '#FF6B35', bg: '#FFF3ED', icon: '🔥' },
    { label: t('bilan.target'),   value: target_kcal, unit: 'kcal', color: '#5B6EF5', bg: '#EEEFFE', icon: '🎯' },
  ];

  return (
    <div style={{ padding: '16px 16px 24px', minHeight: '100vh', background: '#f7f7f5' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
          {t('bilan.title')}
        </h1>
        <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
          {new Date().toLocaleDateString('fr-DZ', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Donut ring */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#aaa' }}>
          <i className="ti ti-loader" style={{ fontSize: 28 }} /> Chargement...
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: 20, padding: '20px 16px',
          marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          display: 'flex', justifyContent: 'center',
        }}>
          <CalorieRing ingested={ingested} burned={burned} target={target_kcal} />
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {statCards.map(({ label, value, unit, color, bg, icon }) => (
          <div key={label} style={{ background: bg, borderRadius: 16, padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color }}>{Math.round(value)}</div>
            <div style={{ fontSize: 10, color: '#888', fontWeight: 500 }}>{unit}</div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Strava buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button
          onClick={handleConnectStrava}
          style={{
            flex: 1, padding: '12px', borderRadius: 14, border: 'none',
            background: '#FC4C02', color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <i className="ti ti-brand-strava" style={{ fontSize: 18 }} />
          {t('bilan.connectStrava')}
        </button>
        <button
          onClick={handleSyncStrava}
          disabled={syncingStrava}
          style={{
            flex: 1, padding: '12px', borderRadius: 14,
            border: '2px solid #FC4C02', background: '#fff',
            color: '#FC4C02', fontWeight: 700, fontSize: 13,
            cursor: syncingStrava ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {syncingStrava
            ? <i className="ti ti-loader" style={{ fontSize: 16 }} />
            : <i className="ti ti-refresh" style={{ fontSize: 16 }} />}
          {t('bilan.syncStrava')}
        </button>
      </div>

      {/* Activities list */}
      <div style={{
        background: '#fff', borderRadius: 20, padding: '16px',
        marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#333' }}>
            {t('bilan.activities')}
          </h3>
          <span style={{
            background: '#FF6B35', color: '#fff',
            borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 700,
          }}>
            −{Math.round(burned)} kcal
          </span>
        </div>

        {activities.length === 0 ? (
          <p style={{ color: '#bbb', fontSize: 13, textAlign: 'center', margin: '16px 0' }}>
            {t('bilan.noActivities')}
          </p>
        ) : (
          activities.map(a => <ActivityRow key={a.id} activity={a} t={t} />)
        )}
      </div>

      {/* Add activity toggle */}
      <button
        onClick={() => setShowForm(v => !v)}
        style={{
          width: '100%', padding: '14px', borderRadius: 16, border: 'none',
          background: showForm ? '#f0f0f0' : '#1A6B3C',
          color: showForm ? '#444' : '#fff',
          fontWeight: 700, fontSize: 15, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 16,
        }}
      >
        <i className={`ti ${showForm ? 'ti-x' : 'ti-plus'}`} style={{ fontSize: 18 }} />
        {showForm ? 'Annuler' : t('bilan.addActivity')}
      </button>

      {/* Activity form */}
      {showForm && (
        <div style={{
          background: '#fff', borderRadius: 20, padding: '20px 16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <ActivityForm onSave={handleSaveActivity} saving={saving} />
        </div>
      )}
    </div>
  );
}
