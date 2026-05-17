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
  const isStrava = activity.source === 'strava';
  const label = activity.name || t(`bilan.sport.${activity.type}`) || activity.type;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: '0.5px solid #f0f0f0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: isStrava ? '#FFF0EB' : '#EAF3DE',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#222' }}>{label}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>{activity.duration_min} min</span>
            {activity.distance_km > 0 && <span>· {activity.distance_km} km</span>}
            <span style={{
              fontSize: 10, background: isStrava ? '#FC4C02' : '#1A6B3C',
              color: '#fff', padding: '1px 6px', borderRadius: 6, fontWeight: 700,
            }}>
              {isStrava ? 'Strava' : 'Manuel'}
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
  const [syncResult, setSyncResult] = useState(null); // { count, newCount }

  const today = new Date().toISOString().split('T')[0];

  const target_kcal = profile
    ? calcTarget(
        calcTDEE(calcBMR(profile.age, profile.weight, profile.height, profile.sexe), profile.activity_level),
        profile.goal,
        profile.pace
      )
    : bilan?.target_kcal || 2000;

  useEffect(() => { fetchBilan(today); }, []);

  // Handle return from Strava OAuth redirect (?strava=ok|error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const strava = params.get('strava');
    if (strava === 'ok') {
      const athlete = params.get('athlete') || 'Strava';
      toast.success(`✅ ${athlete} connecté à Strava !`);
      fetchBilan(today);
      window.history.replaceState({}, '', '/bilan');
    } else if (strava === 'error') {
      const reason = params.get('reason') || '';
      toast.error(`Échec connexion Strava${reason ? ` (${reason})` : ''}`);
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
    setSyncResult(null);
    try {
      const result = await fetchStravaToday();
      if (result.connected) {
        setSyncResult({ count: result.activities.length });
        toast.success(
          result.activities.length > 0
            ? `🔄 ${result.activities.length} activité(s) synchronisée(s)`
            : 'Aucune activité Strava aujourd\'hui'
        );
      } else {
        toast.error('Strava non connecté — reconnectez votre compte');
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
  const stravaConnected = bilan?.strava_connected || false;
  const stravaAthleteName = bilan?.strava_athlete_name || null;

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

      {/* Strava connection card */}
      <div style={{
        background: '#fff', borderRadius: 20, padding: '14px 16px',
        marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        {stravaConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: '#FC4C02',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="ti ti-brand-strava" style={{ fontSize: 20, color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#222' }}>
                  ✅ {stravaAthleteName || 'Strava connecté'}
                </div>
                <div style={{ fontSize: 11, color: '#aaa' }}>Compte Strava lié</div>
              </div>
            </div>
            <button
              onClick={handleSyncStrava}
              disabled={syncingStrava}
              style={{
                padding: '9px 14px', borderRadius: 12,
                border: '1.5px solid #FC4C02', background: syncingStrava ? '#f5f5f5' : '#fff',
                color: '#FC4C02', fontWeight: 700, fontSize: 12,
                cursor: syncingStrava ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <i className={`ti ${syncingStrava ? 'ti-loader-2' : 'ti-refresh'}`}
                style={{ fontSize: 15, animation: syncingStrava ? 'spin 1s linear infinite' : 'none' }} />
              {syncingStrava ? 'Sync...' : '🔄 Synchroniser'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#555' }}>Strava non connecté</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>Liez votre compte pour importer vos activités</div>
            </div>
            <button
              onClick={handleConnectStrava}
              style={{
                padding: '9px 14px', borderRadius: 12, border: 'none',
                background: '#FC4C02', color: '#fff',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <i className="ti ti-brand-strava" style={{ fontSize: 15 }} />
              Connecter
            </button>
          </div>
        )}

        {syncResult !== null && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 10,
            background: syncResult.count > 0 ? '#EAF3DE' : '#f5f5f5',
            fontSize: 12, color: syncResult.count > 0 ? '#1A6B3C' : '#888',
          }}>
            {syncResult.count > 0
              ? `✅ ${syncResult.count} activité(s) importée(s) depuis Strava`
              : 'Aucune activité Strava enregistrée aujourd\'hui'}
          </div>
        )}
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
          {burned > 0 && (
            <span style={{
              background: '#FF6B35', color: '#fff',
              borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 700,
            }}>
              −{Math.round(burned)} kcal
            </span>
          )}
        </div>

        {activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🏃</div>
            <p style={{ color: '#bbb', fontSize: 13, margin: 0 }}>
              {stravaConnected
                ? 'Aucune activité Strava aujourd\'hui — appuyez sur Synchroniser'
                : t('bilan.noActivities')}
            </p>
          </div>
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
