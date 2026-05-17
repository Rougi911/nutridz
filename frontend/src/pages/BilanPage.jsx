import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { useTranslation } from '../i18n';
import { useActivityStore, useProfileStore } from '../store';
import { calcBMR, calcTDEE, calcTarget } from '../utils/api';
import ActivityForm from '../components/ActivityForm';

const SPORT_ICONS = { marche: '🚶', course: '🏃', velo: '🚴', natation: '🏊', muscu: '💪' };
const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// ─── SVG donut ────────────────────────────────────────────────────────────────
function CalorieRing({ ingested, burned, target }) {
  const SIZE = 190;
  const cx = SIZE / 2, cy = SIZE / 2;
  const R_OUT = 74, R_IN = 52;
  const C_OUT = 2 * Math.PI * R_OUT;
  const C_IN  = 2 * Math.PI * R_IN;
  const burnRatio     = Math.min(burned   / (target || 1), 1);
  const ingestRatio   = Math.min(ingested / (target || 1), 1);
  const balance = ingested - burned;
  const isDeficit = balance <= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={cx} cy={cy} r={R_OUT} fill="none" stroke="#f0f0f0" strokeWidth={13} />
        <circle cx={cx} cy={cy} r={R_OUT} fill="none" stroke="#FF6B35" strokeWidth={13}
          strokeDasharray={`${burnRatio * C_OUT} ${C_OUT}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <circle cx={cx} cy={cy} r={R_IN} fill="none" stroke="#f0f0f0" strokeWidth={13} />
        <circle cx={cx} cy={cy} r={R_IN} fill="none" stroke="#1A6B3C" strokeWidth={13}
          strokeDasharray={`${ingestRatio * C_IN} ${C_IN}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={24} fontWeight={800}
          fill={isDeficit ? '#1A6B3C' : '#CC4400'}>
          {isDeficit ? `−${Math.abs(balance)}` : `+${balance}`}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={11} fill="#888">kcal</text>
        <text x={cx} y={cy + 26} textAnchor="middle" fontSize={10}
          fill={isDeficit ? '#1A6B3C' : '#CC4400'} fontWeight={700}>
          {isDeficit ? 'Déficit' : 'Surplus'}
        </text>
      </svg>
      <div style={{ display: 'flex', gap: 18 }}>
        {[['#1A6B3C', 'Ingérées'], ['#FF6B35', 'Dépensées']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#666' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />{label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Macro progress bar ────────────────────────────────────────────────────────
function MacroBar({ label, value, target, color, unit = 'g' }) {
  const pct = Math.min(Math.round((value / (target || 1)) * 100), 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: '#444' }}>{label}</span>
        <span style={{ color: '#888' }}>{Math.round(value)}{unit} / {Math.round(target)}{unit} ({pct}%)</span>
      </div>
      <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 4,
          background: pct >= 90 ? color : pct >= 60 ? '#F5A623' : '#FF6B35',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Estimation gauge ──────────────────────────────────────────────────────────
function EstimationGauge({ avg_balance, projected_weight_change, goal, weight, weekly_protein_avg }) {
  const absBalance = Math.abs(avg_balance);
  let color, label, detail;

  if (avg_balance < -500) {
    color = '#E53E3E';
    label = 'Perte de graisse rapide';
    detail = `~${Math.abs((avg_balance * 7 / 3500)).toFixed(2)} kg/semaine`;
  } else if (avg_balance <= -200) {
    color = '#FF6B35';
    label = 'Perte de graisse modérée';
    detail = `~${Math.abs((avg_balance * 7 / 3500)).toFixed(2)} kg/semaine`;
  } else if (avg_balance <= 200) {
    color = '#1A6B3C';
    label = 'Maintien de forme ✓';
    detail = 'Solde équilibré';
  } else if (avg_balance > 200) {
    color = '#3B82F6';
    label = 'Prise de masse';
    detail = `~${Math.abs((avg_balance * 7 / 2800)).toFixed(2)} kg/semaine`;
  }

  // Gauge: center=0, left=déficit, right=surplus, range -800 to +800
  const RANGE = 800;
  const clampedBalance = Math.max(-RANGE, Math.min(RANGE, avg_balance));
  const pct = ((clampedBalance + RANGE) / (2 * RANGE)) * 100;

  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: '16px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#333' }}>
        Estimation hebdomadaire
      </h3>
      <div style={{ marginBottom: 10 }}>
        <div style={{ height: 10, background: 'linear-gradient(to right, #E53E3E, #FF6B35, #1A6B3C, #3B82F6)', borderRadius: 5, position: 'relative' }}>
          <div style={{
            position: 'absolute', top: -3, left: `${pct}%`, transform: 'translateX(-50%)',
            width: 16, height: 16, borderRadius: '50%', background: color,
            border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            transition: 'left 0.5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginTop: 4 }}>
          <span>Perte rapide</span><span>Maintien</span><span>Prise de masse</span>
        </div>
      </div>
      <div style={{ background: color + '18', borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color }}>{label}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{detail}</div>
        </div>
        <div style={{ fontSize: 26 }}>
          {avg_balance < -500 ? '🔥' : avg_balance <= -200 ? '📉' : avg_balance <= 200 ? '⚖️' : '💪'}
        </div>
      </div>
    </div>
  );
}

// ─── Recommendations ──────────────────────────────────────────────────────────
function Recommendations({ stats, profile }) {
  const recs = useMemo(() => {
    if (!stats || !profile) return [];
    const items = [];
    const { avg_balance, weekly_protein_avg, days_on_target, active_days } = stats;
    const goal = profile.goal || 'maintien';
    const weight = profile.weight || 70;
    const proteinTarget = weight * 1.6;

    if (active_days === 0) {
      items.push({ icon: '📋', color: '#888', text: 'Commencez à logger vos repas pour obtenir des recommandations personnalisées.' });
      return items;
    }

    if (goal === 'perte' && avg_balance > 200) {
      items.push({ icon: '⚠️', color: '#FF6B35', text: `Vous êtes en surplus (+${avg_balance} kcal/j en moyenne) — réduisez les portions ou augmentez l'activité.` });
    }
    if (goal === 'prise' && avg_balance < -200) {
      items.push({ icon: '⚠️', color: '#3B82F6', text: `Déficit calorique (${avg_balance} kcal/j) — mangez davantage pour progresser en masse musculaire.` });
    }
    if (goal === 'prise' && weekly_protein_avg < proteinTarget) {
      items.push({ icon: '💪', color: '#1A6B3C', text: `Protéines insuffisantes (${weekly_protein_avg}g/j) — visez ${Math.round(proteinTarget)}g/j (1.6g × ${weight}kg).` });
    }
    if (Math.abs(avg_balance) <= 200 && active_days >= 5) {
      items.push({ icon: '✅', color: '#1A6B3C', text: 'Excellent équilibre cette semaine — continuez ainsi !' });
    }
    if (days_on_target >= 5) {
      items.push({ icon: '🎯', color: '#1A6B3C', text: `${days_on_target}/7 jours dans l'objectif calorique — très régulier !` });
    } else if (days_on_target <= 2 && active_days >= 4) {
      items.push({ icon: '📈', color: '#F5A623', text: `Seulement ${days_on_target}/7 jours dans l'objectif — essayez d'être plus régulier.` });
    }
    if (goal === 'sante' && active_days < 5) {
      items.push({ icon: '🥗', color: '#888', text: 'Loggez vos repas tous les jours pour un meilleur suivi de votre santé.' });
    }

    return items;
  }, [stats, profile]);

  if (recs.length === 0) return null;

  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: '16px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#333' }}>
        Recommandations personnalisées
      </h3>
      {recs.map((r, i) => (
        <div key={i} style={{
          display: 'flex', gap: 10, padding: '9px 0',
          borderBottom: i < recs.length - 1 ? '0.5px solid #f5f5f5' : 'none',
        }}>
          <span style={{ fontSize: 18, lineHeight: 1.4 }}>{r.icon}</span>
          <span style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Activity row ─────────────────────────────────────────────────────────────
function ActivityRow({ activity, t }) {
  const icon = SPORT_ICONS[activity.type] || '🏃';
  const isStrava = activity.source === 'strava';
  const label = activity.name || t(`bilan.sport.${activity.type}`) || activity.type;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '0.5px solid #f0f0f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: isStrava ? '#FFF0EB' : '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#222' }}>{label}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>{activity.duration_min} min</span>
            {activity.distance_km > 0 && <span>· {activity.distance_km} km</span>}
            <span style={{ fontSize: 10, background: isStrava ? '#FC4C02' : '#1A6B3C', color: '#fff', padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>
              {isStrava ? 'Strava' : 'Manuel'}
            </span>
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#FF6B35' }}>−{Math.round(activity.calories_burned)}</div>
        <div style={{ fontSize: 11, color: '#aaa' }}>kcal</div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function BilanPage() {
  const { t } = useTranslation();
  const { bilan, weeklyStats, loading, fetchBilan, fetchWeeklyStats, addActivity, fetchStravaToday, getStravaAuthUrl } = useActivityStore();
  const profile = useProfileStore(s => s.profile);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingStrava, setSyncingStrava] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  const target_kcal = profile
    ? calcTarget(
        calcTDEE(calcBMR(profile.age, profile.weight, profile.height, profile.sexe), profile.activity_level),
        profile.goal, profile.pace
      )
    : bilan?.target_kcal || 2000;

  useEffect(() => {
    fetchBilan(today);
    fetchWeeklyStats();
  }, []);

  // Strava OAuth return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const strava = params.get('strava');
    if (strava === 'ok') {
      const athlete = params.get('athlete') || 'Strava';
      toast.success(`✅ ${athlete} connecté à Strava !`);
      fetchBilan(today);
      fetchWeeklyStats();
      window.history.replaceState({}, '', '/bilan');
    } else if (strava === 'error') {
      toast.error(`Échec connexion Strava (${params.get('reason') || ''})`);
      window.history.replaceState({}, '', '/bilan');
    }
  }, []);

  async function handleConnectStrava() {
    try {
      window.location.href = await getStravaAuthUrl();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Impossible de se connecter à Strava');
    }
  }

  async function handleSyncStrava() {
    setSyncingStrava(true);
    setSyncResult(null);
    try {
      const result = await fetchStravaToday();
      if (result.connected) {
        setSyncResult({ count: result.activities.length });
        toast.success(result.activities.length > 0
          ? `🔄 ${result.activities.length} activité(s) synchronisée(s)`
          : "Aucune activité Strava aujourd'hui");
        fetchWeeklyStats();
      } else {
        toast.error('Strava non connecté — reconnectez votre compte');
      }
    } catch { toast.error('Erreur synchronisation Strava'); }
    finally { setSyncingStrava(false); }
  }

  async function handleSaveActivity(activity) {
    setSaving(true);
    try {
      await addActivity({ ...activity, date: today });
      toast.success(t('bilan.saved'));
      setShowForm(false);
      fetchWeeklyStats();
    } catch { toast.error(t('bilan.errorSave')); }
    finally { setSaving(false); }
  }

  const ingested  = bilan?.ingested_kcal || 0;
  const burned    = bilan?.burned_kcal   || 0;
  const activities = bilan?.activities   || [];
  const stravaConnected   = bilan?.strava_connected    || false;
  const stravaAthleteName = bilan?.strava_athlete_name || null;

  // Macro targets from caloric target
  const glucTarget   = Math.round(target_kcal * 0.50 / 4);
  const protTarget   = Math.round(target_kcal * 0.25 / 4);
  const fatTarget    = Math.round(target_kcal * 0.25 / 9);

  // Weekly chart data
  const chartData = (weeklyStats?.days || []).map(d => ({
    label: DAY_LABELS[new Date(d.date + 'T12:00:00').getDay()],
    calories_in:  Math.round(d.calories_in),
    calories_out: Math.round(d.calories_out),
  }));

  const statCards = [
    { label: t('bilan.ingested'), value: ingested,   unit: 'kcal', color: '#1A6B3C', bg: '#EAF3DE', icon: '🍽️' },
    { label: t('bilan.burned'),   value: burned,     unit: 'kcal', color: '#FF6B35', bg: '#FFF3ED', icon: '🔥' },
    { label: t('bilan.target'),   value: target_kcal, unit: 'kcal', color: '#5B6EF5', bg: '#EEEFFE', icon: '🎯' },
  ];

  return (
    <div style={{ padding: '16px 16px 32px', minHeight: '100vh', background: '#f7f7f5' }}>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a', margin: 0 }}>{t('bilan.title')}</h1>
        <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>
          {new Date().toLocaleDateString('fr-DZ', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Donut ring */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#aaa' }}>
          <i className="ti ti-loader-2" style={{ fontSize: 28 }} /> Chargement...
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 20, padding: '18px 16px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'center' }}>
          <CalorieRing ingested={ingested} burned={burned} target={target_kcal} />
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        {statCards.map(({ label, value, unit, color, bg, icon }) => (
          <div key={label} style={{ background: bg, borderRadius: 16, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color }}>{Math.round(value)}</div>
            <div style={{ fontSize: 10, color: '#888' }}>{unit}</div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Macros du jour */}
      {ingested > 0 && (
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#333' }}>Macros du jour</h3>
          <MacroBar label="Glucides" value={bilan?.glucides || 0} target={glucTarget} color="#F5A623" />
          <MacroBar label="Protéines" value={bilan?.proteines || 0} target={protTarget} color="#3B82F6" />
          <MacroBar label="Lipides" value={bilan?.lipides || 0} target={fatTarget} color="#8B5CF6" />
        </div>
      )}

      {/* Graphique 7 jours */}
      {weeklyStats && weeklyStats.active_days > 0 && (
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#333' }}>7 derniers jours</h3>
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#888' }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#1A6B3C', marginRight: 3 }} />Ingérées</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#FF6B35', marginRight: 3 }} />Dépensées</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData} barGap={3} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #f0f0f0' }}
                formatter={(v, name) => [`${Math.round(v)} kcal`, name === 'calories_in' ? 'Ingérées' : 'Dépensées']}
              />
              <ReferenceLine y={weeklyStats.target_kcal} stroke="#5B6EF5" strokeDasharray="4 3" strokeWidth={1.5} />
              <Bar dataKey="calories_in"  fill="#1A6B3C" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="calories_out" fill="#FF6B35" radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>

          {/* Hebdo summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginTop: 12 }}>
            {[
              { label: 'Moy. ingérées', value: weeklyStats.avg_calories_in, unit: 'kcal', color: '#1A6B3C' },
              { label: 'Moy. dépensées', value: weeklyStats.avg_calories_out, unit: 'kcal', color: '#FF6B35' },
              { label: 'Solde moyen', value: weeklyStats.avg_balance, unit: 'kcal', color: weeklyStats.avg_balance > 0 ? '#CC4400' : '#1A6B3C' },
              { label: 'Jours ✓', value: weeklyStats.days_on_target, unit: `/ ${weeklyStats.active_days}`, color: '#5B6EF5' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} style={{ background: '#f9f9f9', borderRadius: 12, padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color }}>{value > 0 && label === 'Solde moyen' ? `+${value}` : value}</div>
                <div style={{ fontSize: 9, color: '#aaa' }}>{unit}</div>
                <div style={{ fontSize: 9, color: '#bbb', marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estimation + jauge */}
      {weeklyStats && weeklyStats.active_days > 0 && (
        <EstimationGauge
          avg_balance={weeklyStats.avg_balance}
          projected_weight_change={weeklyStats.projected_weight_change}
          goal={weeklyStats.goal}
          weight={weeklyStats.weight}
          weekly_protein_avg={weeklyStats.weekly_protein_avg}
        />
      )}

      {/* Recommandations */}
      <Recommendations stats={weeklyStats} profile={profile} />

      {/* Strava card */}
      <div style={{ background: '#fff', borderRadius: 20, padding: '14px 16px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {stravaConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FC4C02', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-brand-strava" style={{ fontSize: 20, color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#222' }}>✅ {stravaAthleteName || 'Strava connecté'}</div>
                <div style={{ fontSize: 11, color: '#aaa' }}>Compte Strava lié</div>
              </div>
            </div>
            <button onClick={handleSyncStrava} disabled={syncingStrava}
              style={{ padding: '9px 14px', borderRadius: 12, border: '1.5px solid #FC4C02', background: syncingStrava ? '#f5f5f5' : '#fff', color: '#FC4C02', fontWeight: 700, fontSize: 12, cursor: syncingStrava ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <i className={`ti ${syncingStrava ? 'ti-loader-2' : 'ti-refresh'}`} style={{ fontSize: 15 }} />
              {syncingStrava ? 'Sync...' : '🔄 Synchroniser'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#555' }}>Strava non connecté</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>Liez votre compte pour importer vos activités</div>
            </div>
            <button onClick={handleConnectStrava}
              style={{ padding: '9px 14px', borderRadius: 12, border: 'none', background: '#FC4C02', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <i className="ti ti-brand-strava" style={{ fontSize: 15 }} />Connecter
            </button>
          </div>
        )}
        {syncResult !== null && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: syncResult.count > 0 ? '#EAF3DE' : '#f5f5f5', fontSize: 12, color: syncResult.count > 0 ? '#1A6B3C' : '#888' }}>
            {syncResult.count > 0 ? `✅ ${syncResult.count} activité(s) importée(s)` : "Aucune activité Strava aujourd'hui"}
          </div>
        )}
      </div>

      {/* Activities list */}
      <div style={{ background: '#fff', borderRadius: 20, padding: '16px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#333' }}>{t('bilan.activities')}</h3>
          {burned > 0 && (
            <span style={{ background: '#FF6B35', color: '#fff', borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
              −{Math.round(burned)} kcal
            </span>
          )}
        </div>
        {activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '14px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🏃</div>
            <p style={{ color: '#bbb', fontSize: 13, margin: 0 }}>
              {stravaConnected ? "Aucune activité Strava aujourd'hui — appuyez sur Synchroniser" : t('bilan.noActivities')}
            </p>
          </div>
        ) : (
          activities.map(a => <ActivityRow key={a.id} activity={a} t={t} />)
        )}
      </div>

      {/* Add activity */}
      <button onClick={() => setShowForm(v => !v)}
        style={{ width: '100%', padding: '13px', borderRadius: 16, border: 'none', background: showForm ? '#f0f0f0' : '#1A6B3C', color: showForm ? '#444' : '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
        <i className={`ti ${showForm ? 'ti-x' : 'ti-plus'}`} style={{ fontSize: 18 }} />
        {showForm ? 'Annuler' : t('bilan.addActivity')}
      </button>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <ActivityForm onSave={handleSaveActivity} saving={saving} />
        </div>
      )}
    </div>
  );
}
