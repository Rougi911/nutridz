import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from 'recharts';
import { useTranslation } from '../i18n';
import { useActivityStore, useProfileStore } from '../store';
import useSettingsStore from '../store/useSettingsStore';
import { kgToLbs } from '../utils/units';
import { calcBMR, calcTDEE, calcTarget } from '../utils/api';
import api from '../utils/api';
import ActivityForm from '../components/ActivityForm';
import MetricCard from '../components/MetricCard';
import { SkeletonCard, SkeletonLine } from '../components/Skeleton';
import { exportBilanPDF } from '../utils/exportPDF';

const SPORT_ICONS  = { marche: '🚶', course: '🏃', velo: '🚴', natation: '🏊', muscu: '💪' };
const DAY_LABELS   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const WEEK_DAYS    = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_NAMES  = ['Janvier','Février','Mars','Avril','Mai','Juin',
                      'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

// ─── Calendar color logic ─────────────────────────────────────────────────────
function getCellColor(day, goal) {
  if (!day.has_data) return '#E0E0E0';
  const dev = day.deviation;
  if (goal === 'perte') {
    if (dev <= 150)  return '#1A6B3C';
    if (dev <= 300)  return '#97C459';
    if (dev <= 500)  return '#F5C842';
    if (dev <= 800)  return '#E8873A';
    return '#D63B2F';
  }
  if (goal === 'prise') {
    if (dev >= -150) return '#1A6B3C';
    if (dev >= -300) return '#97C459';
    if (dev >= -500) return '#F5C842';
    if (dev >= -800) return '#E8873A';
    return '#D63B2F';
  }
  const abs = Math.abs(dev);
  if (abs <= 150)  return '#1A6B3C';
  if (abs <= 300)  return '#97C459';
  if (abs <= 500)  return '#F5C842';
  if (abs <= 800)  return '#E8873A';
  return '#D63B2F';
}

function getCellTextColor(bg) {
  return (bg === '#F5C842' || bg === '#E0E0E0') ? '#444' : '#fff';
}

// ─── SVG donut ────────────────────────────────────────────────────────────────
function CalorieRing({ ingested, burned, target }) {
  const SIZE = 190, cx = 95, cy = 95;
  const R_OUT = 74, R_IN = 52;
  const C_OUT = 2 * Math.PI * R_OUT, C_IN = 2 * Math.PI * R_IN;
  const burnRatio   = Math.min(burned   / (target || 1), 1);
  const ingestRatio = Math.min(ingested / (target || 1), 1);
  const balance = ingested - burned;
  const isDeficit = balance <= 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={cx} cy={cy} r={R_OUT} fill="none" stroke="#ededf7" strokeWidth={13} />
        <circle cx={cx} cy={cy} r={R_OUT} fill="none" stroke="#f59e0b" strokeWidth={13}
          strokeDasharray={`${burnRatio * C_OUT} ${C_OUT}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <circle cx={cx} cy={cy} r={R_IN} fill="none" stroke="#ededf7" strokeWidth={13} />
        <circle cx={cx} cy={cy} r={R_IN} fill="none" stroke="#6366f1" strokeWidth={13}
          strokeDasharray={`${ingestRatio * C_IN} ${C_IN}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={24} fontWeight={800}
          fill={isDeficit ? '#6366f1' : '#ef4444'}>
          {isDeficit ? `−${Math.abs(balance)}` : `+${balance}`}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={11} fill="#888">kcal</text>
        <text x={cx} y={cy + 26} textAnchor="middle" fontSize={10}
          fill={isDeficit ? '#6366f1' : '#ef4444'} fontWeight={700}>
          {isDeficit ? 'Déficit' : 'Surplus'}
        </text>
      </svg>
      <div style={{ display: 'flex', gap: '18px' }}>
        {[['#6366f1', 'Ingérées'], ['#f59e0b', 'Dépensées']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: 'var(--radius-2xs)', background: color }} />{label}
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
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{Math.round(value)}{unit} / {Math.round(target)}{unit} ({pct}%)</span>
      </div>
      <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-2xs)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 'var(--radius-2xs)',
          background: pct >= 90 ? color : pct >= 60 ? '#F5A623' : '#FF6B35',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Estimation gauge ──────────────────────────────────────────────────────────
function EstimationGauge({ avg_balance }) {
  let color, label, detail;
  if (avg_balance < -500) {
    color = '#E53E3E'; label = 'Perte de graisse rapide';
    detail = `~${Math.abs(avg_balance * 7 / 3500).toFixed(2)} kg/semaine`;
  } else if (avg_balance <= -200) {
    color = '#FF6B35'; label = 'Perte de graisse modérée';
    detail = `~${Math.abs(avg_balance * 7 / 3500).toFixed(2)} kg/semaine`;
  } else if (avg_balance <= 200) {
    color = '#1A6B3C'; label = 'Maintien de forme ✓'; detail = 'Solde équilibré';
  } else {
    color = '#3B82F6'; label = 'Prise de masse';
    detail = `~${Math.abs(avg_balance * 7 / 2800).toFixed(2)} kg/semaine`;
  }
  const RANGE = 800;
  const pct = ((Math.max(-RANGE, Math.min(RANGE, avg_balance)) + RANGE) / (2 * RANGE)) * 100;
  return (
    <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '16px', marginBottom: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>Estimation hebdomadaire</h3>
      <div style={{ marginBottom: '10px' }}>
        <div style={{ height: '10px', background: 'linear-gradient(to right, #E53E3E, #FF6B35, #1A6B3C, #3B82F6)', borderRadius: 'var(--radius-2xs)', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: -3, left: `${pct}%`, transform: 'translateX(-50%)',
            width: '16px', height: '16px', borderRadius: '50%', background: color,
            border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            transition: 'left 0.5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>
          <span>Perte rapide</span><span>Maintien</span><span>Prise de masse</span>
        </div>
      </div>
      <div style={{ background: color + '18', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color }}>{label}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>{detail}</div>
        </div>
        <div style={{ fontSize: 'var(--font-size-2xl)' }}>
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
      items.push({ icon: '📋', text: 'Commencez à logger vos repas pour obtenir des recommandations personnalisées.' });
      return items;
    }
    if (goal === 'perte' && avg_balance > 200)
      items.push({ icon: '⚠️', text: `Vous êtes en surplus (+${avg_balance} kcal/j en moyenne) — réduisez les portions ou augmentez l'activité.` });
    if (goal === 'prise' && avg_balance < -200)
      items.push({ icon: '⚠️', text: `Déficit calorique (${avg_balance} kcal/j) — mangez davantage pour progresser en masse musculaire.` });
    if (goal === 'prise' && weekly_protein_avg < proteinTarget)
      items.push({ icon: '💪', text: `Protéines insuffisantes (${weekly_protein_avg}g/j) — visez ${Math.round(proteinTarget)}g/j (1.6g × ${weight}kg).` });
    if (Math.abs(avg_balance) <= 200 && active_days >= 5)
      items.push({ icon: '✅', text: 'Excellent équilibre cette semaine — continuez ainsi !' });
    if (days_on_target >= 5)
      items.push({ icon: '🎯', text: `${days_on_target}/7 jours dans l'objectif calorique — très régulier !` });
    else if (days_on_target <= 2 && active_days >= 4)
      items.push({ icon: '📈', text: `Seulement ${days_on_target}/7 jours dans l'objectif — essayez d'être plus régulier.` });
    if (goal === 'sante' && active_days < 5)
      items.push({ icon: '🥗', text: 'Loggez vos repas tous les jours pour un meilleur suivi de votre santé.' });
    return items;
  }, [stats, profile]);

  if (recs.length === 0) return null;
  return (
    <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '16px', marginBottom: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>Recommandations personnalisées</h3>
      {recs.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: '10px', padding: '9px 0', borderBottom: i < recs.length - 1 ? '0.5px solid var(--border-color)' : 'none' }}>
          <span style={{ fontSize: 'var(--font-size-lg)', lineHeight: 1.4 }}>{r.icon}</span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>{r.text}</span>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '0.5px solid var(--border-color)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: isStrava ? '#FFF0EB' : 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--font-size-xl)' }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{label}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>{activity.duration_min} min</span>
            {activity.distance_km > 0 && <span>· {activity.distance_km} km</span>}
            <span style={{ fontSize: 'var(--font-size-2xs)', background: isStrava ? '#FC4C02' : 'var(--accent-green)', color: '#fff', padding: '1px 6px', borderRadius: 'var(--radius-xs)', fontWeight: 700 }}>
              {isStrava ? 'Strava' : 'Manuel'}
            </span>
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: '#FF6B35' }}>−{Math.round(activity.calories_burned)}</div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>kcal</div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function BilanPage({ embedded = false, activeTabOverride }) {
  const { t } = useTranslation();
  const {
    bilan, weeklyStats, monthlyStats, loading,
    fetchBilan, fetchWeeklyStats, fetchMonthlyStats,
    addActivity, fetchStravaToday, getStravaAuthUrl,
  } = useActivityStore();
  const profile = useProfileStore(s => s.profile);
  const { weightUnit } = useSettingsStore();

  const [view, setView] = useState('jour');
  useEffect(() => {
    if (activeTabOverride) setView(activeTabOverride.toLowerCase());
  }, [activeTabOverride]);
  const [monthYear, setMonthYear] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingStrava, setSyncingStrava] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const [evolutionData, setEvolutionData] = useState(null);
  const [evolutionPeriod, setEvolutionPeriod] = useState(30);
  const [loadingEvolution, setLoadingEvolution] = useState(false);

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

  useEffect(() => {
    if (view === 'mois') {
      fetchMonthlyStats(monthYear.year, monthYear.month);
    }
  }, [view, monthYear.year, monthYear.month]);

  useEffect(() => {
    if (view === 'evolution') {
      fetchEvolution();
    }
  }, [view, evolutionPeriod]);

  const fetchEvolution = async () => {
    setLoadingEvolution(true);
    try {
      const res = await api.get(`/weight/evolution?days=${evolutionPeriod}`);
      setEvolutionData(res.data);
    } catch {
      toast.error(t('evolution.error'));
    } finally {
      setLoadingEvolution(false);
    }
  };

  const prepareCompositionData = (data) => {
    if (!data.weight_entries || !data.weight_entries.length || !data.current_bf_pct) return [];
    const baseWeight = data.weight_entries[0].weight_kg;
    const baseLean = baseWeight * (1 - data.current_bf_pct / 100);
    const baseFat  = baseWeight * (data.current_bf_pct / 100);
    return data.weight_entries.map((entry, idx) => {
      const cum = (data.period.daily || []).slice(0, idx + 1).reduce(
        (acc, day) => ({ lean: acc.lean + day.delta_lean_kg, fat: acc.fat + day.delta_fat_kg }),
        { lean: 0, fat: 0 }
      );
      return {
        date: entry.date,
        lean_kg: +(baseLean + cum.lean).toFixed(1),
        fat_kg:  +(baseFat  + cum.fat).toFixed(1),
      };
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const strava = params.get('strava');
    if (strava === 'ok') {
      const athlete = params.get('athlete') || 'Strava';
      toast.success(`✅ ${athlete} connecté à Strava !`);
      fetchBilan(today);
      fetchWeeklyStats();
      window.history.replaceState({}, '', '/stats');
    } else if (strava === 'error') {
      toast.error(`Échec connexion Strava (${params.get('reason') || ''})`);
      window.history.replaceState({}, '', '/stats');
    }
  }, []);

  async function handleConnectStrava() {
    try { window.location.href = await getStravaAuthUrl(); }
    catch (err) { toast.error(err?.response?.data?.error || 'Impossible de se connecter à Strava'); }
  }

  async function handleSyncStrava() {
    setSyncingStrava(true); setSyncResult(null);
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

  const ingested          = bilan?.ingested_kcal      || 0;
  const burned            = bilan?.burned_kcal        || 0;
  const activities        = bilan?.activities         || [];
  const stravaConnected   = bilan?.strava_connected   || false;
  const stravaAthleteName = bilan?.strava_athlete_name || null;

  const glucTarget = Math.round(target_kcal * 0.50 / 4);
  const protTarget = Math.round(target_kcal * 0.25 / 4);
  const fatTarget  = Math.round(target_kcal * 0.25 / 9);

  const chartData = (weeklyStats?.days || []).map(d => ({
    label: DAY_LABELS[new Date(d.date + 'T12:00:00').getDay()],
    calories_in:  Math.round(d.calories_in),
    calories_out: Math.round(d.calories_out),
  }));

  const calendarCells = useMemo(() => {
    if (!monthlyStats?.days) return [];
    const firstDow = new Date(monthYear.year, monthYear.month - 1, 1).getDay();
    const startOffset = firstDow === 0 ? 6 : firstDow - 1;
    const cells = [...Array(startOffset).fill(null), ...monthlyStats.days];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthlyStats, monthYear]);

  const navBtnStyle = {
    width: '36px', height: '36px', borderRadius: 'var(--radius-md)', border: '0.5px solid rgba(0,0,0,0.1)',
    background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-lg)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)',
  };

  const handleExportPDF = async () => {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      await exportBilanPDF('bilan-content', `bilan-${view}-${dateStr}.pdf`);
      toast.success(t('bilan.exported'));
    } catch (err) {
      console.error(err);
      toast.error(t('bilan.exportError'));
    }
  };

  return (
    <div id="bilan-content" style={{ paddingBottom: '32px', minHeight: embedded ? 'auto' : '100vh', background: 'var(--bg-secondary)' }}>

      {/* Header */}
      {!embedded && (
      <div className="gradient-health" style={{ padding: '1.25rem 1.25rem 1.5rem', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)', color: 'white', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>{t('bilan.title')}</h1>
            <p style={{ fontSize: 'var(--font-size-sm)', opacity: 0.8, margin: '4px 0 0' }}>
              {new Date().toLocaleDateString('fr-DZ', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button onClick={handleExportPDF} style={{
            padding: '8px 14px', borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)',
            color: 'white', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)',
          }}>
            📄 {t('bilan.exportPDF')}
          </button>
        </div>
      </div>
      )}

      <div style={{ padding: '0 16px' }}>

      {/* View toggle */}
      <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-full)', padding: '4px', marginBottom: '16px', gap: 'var(--space-2xs)' }}>
        {[['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['evolution', t('evolution.title')]].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: '8px 0', borderRadius: 'var(--radius-full)', border: 'none',
            background: view === v ? '#10b981' : 'transparent',
            color: view === v ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: 'var(--font-size-xs)', cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══ VUE JOURNALIÈRE ═══ */}
      {view === 'jour' && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
              <i className="ti ti-loader-2" style={{ fontSize: 'var(--font-size-2xl)' }} /> Chargement...
            </div>
          ) : (
            <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '18px 16px', marginBottom: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)', display: 'flex', justifyContent: 'center' }}>
              <CalorieRing ingested={ingested} burned={burned} target={target_kcal} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            {[
              { label: t('bilan.ingested'), value: ingested,    unit: 'kcal', color: 'var(--accent-blue)',   bg: 'rgba(99,102,241,0.08)',  icon: '🍽️' },
              { label: t('bilan.burned'),   value: burned,      unit: 'kcal', color: 'var(--accent-yellow)', bg: 'rgba(245,158,11,0.08)', icon: '🔥' },
              { label: t('bilan.target'),   value: target_kcal, unit: 'kcal', color: 'var(--accent-green)',  bg: 'rgba(16,185,129,0.08)', icon: '🎯' },
            ].map(({ label, value, unit, color, bg, icon }) => (
              <div key={label} style={{ background: bg, borderRadius: 'var(--radius-lg)', padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-xl)' }}>{icon}</div>
                <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color }}>{Math.round(value)}</div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)' }}>{unit}</div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', marginTop: '1px' }}>{label}</div>
              </div>
            ))}
          </div>

          {ingested > 0 && (
            <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '16px', marginBottom: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>Macros du jour</h3>
              <MacroBar label="Glucides"  value={bilan?.glucides  || 0} target={glucTarget} color="#F5A623" />
              <MacroBar label="Protéines" value={bilan?.proteines || 0} target={protTarget} color="#3B82F6" />
              <MacroBar label="Lipides"   value={bilan?.lipides   || 0} target={fatTarget}  color="#8B5CF6" />
            </div>
          )}

          {/* Strava card */}
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '14px 16px', marginBottom: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
            {stravaConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: '#FC4C02', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="ti ti-brand-strava" style={{ fontSize: 'var(--font-size-xl)', color: '#fff' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>✅ {stravaAthleteName || 'Strava connecté'}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Compte Strava lié</div>
                  </div>
                </div>
                <button onClick={handleSyncStrava} disabled={syncingStrava}
                  style={{ padding: '9px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid #FC4C02', background: syncingStrava ? 'var(--bg-secondary)' : 'var(--bg-primary)', color: '#FC4C02', fontWeight: 700, fontSize: 'var(--font-size-xs)', cursor: syncingStrava ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <i className={`ti ${syncingStrava ? 'ti-loader-2' : 'ti-refresh'}`} style={{ fontSize: 'var(--font-size-base)' }} />
                  {syncingStrava ? 'Sync...' : '🔄 Synchroniser'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Strava non connecté</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Liez votre compte pour importer vos activités</div>
                </div>
                <button onClick={handleConnectStrava}
                  style={{ padding: '9px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: '#FC4C02', color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-xs)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <i className="ti ti-brand-strava" style={{ fontSize: 'var(--font-size-base)' }} />Connecter
                </button>
              </div>
            )}
            {syncResult !== null && (
              <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: syncResult.count > 0 ? 'var(--color-success-bg)' : 'var(--bg-secondary)', fontSize: 'var(--font-size-xs)', color: syncResult.count > 0 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                {syncResult.count > 0 ? `✅ ${syncResult.count} activité(s) importée(s)` : "Aucune activité Strava aujourd'hui"}
              </div>
            )}
          </div>

          {/* Activities list */}
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '16px', marginBottom: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{t('bilan.activities')}</h3>
              {burned > 0 && (
                <span style={{ background: '#FF6B35', color: '#fff', borderRadius: 'var(--radius-md)', padding: '2px 10px', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                  −{Math.round(burned)} kcal
                </span>
              )}
            </div>
            {activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '14px 0' }}>
                <div style={{ fontSize: 'var(--font-size-2xl)', marginBottom: '4px' }}>🏃</div>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                  {stravaConnected ? "Aucune activité Strava aujourd'hui — appuyez sur Synchroniser" : t('bilan.noActivities')}
                </p>
              </div>
            ) : (
              activities.map(a => <ActivityRow key={a.id} activity={a} t={t} />)
            )}
          </div>

          <button onClick={() => setShowForm(v => !v)}
            style={{ width: '100%', padding: '13px', borderRadius: 'var(--radius-lg)', border: 'none', background: showForm ? 'var(--bg-tertiary)' : 'var(--accent-blue)', color: showForm ? 'var(--text-primary)' : '#fff', fontWeight: 700, fontSize: 'var(--font-size-base)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-xs)', marginBottom: '12px' }}>
            <i className={`ti ${showForm ? 'ti-x' : 'ti-plus'}`} style={{ fontSize: 'var(--font-size-lg)' }} />
            {showForm ? 'Annuler' : t('bilan.addActivity')}
          </button>
          {showForm && (
            <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '20px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <ActivityForm onSave={handleSaveActivity} saving={saving} />
            </div>
          )}
        </>
      )}

      {/* ═══ VUE HEBDOMADAIRE ═══ */}
      {view === 'semaine' && (
        <>
          {/* Avg stats cards */}
          {weeklyStats ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              {[
                { label: 'Moy. ingérées',  value: weeklyStats.avg_calories_in,  color: 'var(--accent-green)', bg: 'var(--color-success-bg)', icon: '🍽️' },
                { label: 'Moy. dépensées', value: weeklyStats.avg_calories_out, color: '#FF6B35', bg: '#FFF3ED', icon: '🔥' },
                {
                  label: 'Solde moyen',
                  value: weeklyStats.avg_balance > 0 ? `+${weeklyStats.avg_balance}` : String(weeklyStats.avg_balance),
                  color: weeklyStats.avg_balance > 0 ? '#CC4400' : 'var(--accent-green)',
                  bg:    weeklyStats.avg_balance > 0 ? '#FFF3ED' : 'var(--color-success-bg)',
                  icon:  '⚖️',
                },
              ].map(({ label, value, color, bg, icon }) => (
                <div key={label} style={{ background: bg, borderRadius: 'var(--radius-lg)', padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-xl)' }}>{icon}</div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)' }}>kcal/j</div>
                  <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', marginTop: '1px' }}>{label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>Chargement des stats...</div>
          )}

          {/* Bar chart 7 jours */}
          {weeklyStats && weeklyStats.active_days > 0 && (
            <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '16px', marginBottom: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>7 derniers jours</h3>
                <div style={{ display: 'flex', gap: '12px', fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)' }}>
                  <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: 'var(--radius-2xs)', background: 'var(--accent-green)', marginRight: '3px' }} />Ingérées</span>
                  <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: 'var(--radius-2xs)', background: '#FF6B35', marginRight: '3px' }} />Dépensées</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={chartData} barGap={3} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                  <XAxis dataKey="label" tick={{ fontSize: 'var(--font-size-2xs)', fill: '#aaa' }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip
                    contentStyle={{ borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', border: '1px solid var(--border-color)' }}
                    formatter={(v, name) => [`${Math.round(v)} kcal`, name === 'calories_in' ? 'Ingérées' : 'Dépensées']}
                  />
                  <ReferenceLine y={weeklyStats.target_kcal} stroke="#5B6EF5" strokeDasharray="4 3" strokeWidth={1.5} />
                  <Bar dataKey="calories_in" radius={[4,4,0,0]} maxBarSize={18}>
                    {chartData.map((entry, index) => {
                      const r = entry.calories_in / (weeklyStats?.target_kcal || 2000);
                      return <Cell key={index} fill={r <= 1 ? '#10b981' : r <= 1.1 ? '#f59e0b' : '#ef4444'} />;
                    })}
                  </Bar>
                  <Bar dataKey="calories_out" fill="#FF6B35" radius={[4,4,0,0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', marginTop: '12px' }}>
                {[
                  { label: 'Moy. ingérées',  value: weeklyStats.avg_calories_in,  unit: 'kcal', color: 'var(--accent-green)' },
                  { label: 'Moy. dépensées', value: weeklyStats.avg_calories_out, unit: 'kcal', color: '#FF6B35' },
                  { label: 'Solde moyen',    value: weeklyStats.avg_balance,       unit: 'kcal', color: weeklyStats.avg_balance > 0 ? '#CC4400' : 'var(--accent-green)' },
                  { label: 'Jours ✓',        value: weeklyStats.days_on_target,    unit: `/ ${weeklyStats.active_days}`, color: '#5B6EF5' },
                ].map(({ label, value, unit, color }) => (
                  <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color }}>
                      {label === 'Solde moyen' && value > 0 ? `+${value}` : value}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)' }}>{unit}</div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', marginTop: '1px' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estimation text */}
          {weeklyStats && weeklyStats.active_days > 0 && (
            <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '16px', marginBottom: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>Estimation cette semaine</h3>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {weeklyStats.goal === 'perte' && (
                  weeklyStats.avg_balance < 0
                    ? `Déficit moyen ${Math.abs(weeklyStats.avg_balance)} kcal/j → perte estimée ${Math.abs(weeklyStats.avg_balance * 7 / 3500).toFixed(2)} kg cette semaine`
                    : `Surplus moyen +${weeklyStats.avg_balance} kcal/j — réduisez les apports pour maigrir`
                )}
                {weeklyStats.goal === 'prise' && (
                  weeklyStats.avg_balance > 0
                    ? `Surplus moyen +${weeklyStats.avg_balance} kcal/j → gain estimé ${(weeklyStats.avg_balance * 7 / 2800).toFixed(2)} kg cette semaine`
                    : `Déficit moyen ${weeklyStats.avg_balance} kcal/j — mangez plus pour prendre de la masse`
                )}
                {(weeklyStats.goal === 'maintien' || weeklyStats.goal === 'sante') && (
                  `Équilibre à ${weeklyStats.avg_balance > 0 ? '+' : ''}${weeklyStats.avg_balance} kcal/j de votre objectif`
                )}
              </p>
            </div>
          )}

          {weeklyStats && weeklyStats.active_days > 0 && (
            <EstimationGauge avg_balance={weeklyStats.avg_balance} />
          )}

          <Recommendations stats={weeklyStats} profile={profile} />

          {(!weeklyStats || weeklyStats.active_days === 0) && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>📊</div>
              <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>Pas encore de données cette semaine.<br />Commencez à logger vos repas !</p>
            </div>
          )}
        </>
      )}

      {/* ═══ VUE MENSUELLE ═══ */}
      {view === 'mois' && (
        <>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '16px', marginBottom: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
            {/* Month navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <button style={navBtnStyle}
                onClick={() => setMonthYear(my => my.month === 1 ? { year: my.year - 1, month: 12 } : { ...my, month: my.month - 1 })}>
                ‹
              </button>
              <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
                {MONTH_NAMES[monthYear.month - 1]} {monthYear.year}
              </span>
              <button style={navBtnStyle}
                onClick={() => setMonthYear(my => my.month === 12 ? { year: my.year + 1, month: 1 } : { ...my, month: my.month + 1 })}>
                ›
              </button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '6px' }}>
              {WEEK_DAYS.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', fontWeight: 600, paddingBottom: '2px' }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            {monthlyStats && monthlyStats.year === monthYear.year && monthlyStats.month === monthYear.month ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                {calendarCells.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} style={{ minHeight: '52px' }} />;
                  const bg = getCellColor(day, monthlyStats.goal);
                  const tc = getCellTextColor(bg);
                  return (
                    <div key={day.date} style={{
                      background: bg, borderRadius: 'var(--radius-sm)', minHeight: '52px',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', padding: '4px 2px',
                    }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: tc }}>{day.day}</div>
                      {day.has_data && (
                        <div style={{ fontSize: 'var(--font-size-2xs)', color: tc, marginTop: '2px', fontWeight: 600, lineHeight: 1.2 }}>
                          {day.deviation > 0 ? '+' : ''}{day.deviation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                <i className="ti ti-loader-2" style={{ fontSize: 'var(--font-size-xl)' }} />
              </div>
            )}

            {/* Legend */}
            <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
              {[
                ['#1A6B3C', 'Parfait (±150)'],
                ['#97C459', 'Bon (±300)'],
                ['#F5C842', 'Attention (±500)'],
                ['#E8873A', 'Mauvais (±800)'],
                ['#D63B2F', 'Très mauvais'],
                ['#E0E0E0', 'Pas de données'],
              ].map(([color, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2xs)', fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: 'var(--radius-2xs)', background: color, flexShrink: 0, border: '0.5px solid rgba(0,0,0,0.08)' }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Monthly summary */}
          {monthlyStats && monthlyStats.total_tracked > 0 && (
            <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: '16px', marginBottom: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>Résumé du mois</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xs)', marginBottom: '10px' }}>
                <div style={{ background: 'var(--color-success-bg)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--accent-green)' }}>
                    {monthlyStats.days_on_target}
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>/{monthlyStats.total_tracked}</span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: '#5a8a5a', marginTop: '2px' }}>Jours dans la cible</div>
                </div>
                <div style={{ background: monthlyStats.avg_balance > 200 ? '#FFF3ED' : 'var(--color-success-bg)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: monthlyStats.avg_balance > 200 ? '#CC4400' : 'var(--accent-green)' }}>
                    {monthlyStats.avg_balance > 0 ? '+' : ''}{monthlyStats.avg_balance}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>Solde moyen (kcal/j)</div>
                </div>
                {monthlyStats.best_day && (
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--accent-green)' }}>
                      {new Date(monthlyStats.best_day + 'T12:00:00').toLocaleDateString('fr-DZ', { day: 'numeric', month: 'short' })}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>Meilleur jour 🏆</div>
                  </div>
                )}
                {monthlyStats.worst_day && (
                  <div style={{ background: '#fff5f5', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: '#CC4400' }}>
                      {new Date(monthlyStats.worst_day + 'T12:00:00').toLocaleDateString('fr-DZ', { day: 'numeric', month: 'short' })}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>Pire jour 📉</div>
                  </div>
                )}
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong>Projection fin de mois :</strong>{' '}
                  {monthlyStats.projected_weight_change > 0
                    ? `+${monthlyStats.projected_weight_change.toFixed(2)} kg (surplus moyen)`
                    : monthlyStats.projected_weight_change < 0
                    ? `${monthlyStats.projected_weight_change.toFixed(2)} kg (déficit moyen)`
                    : 'Poids stable'}
                </div>
              </div>
            </div>
          )}

          {monthlyStats && monthlyStats.total_tracked === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 'var(--font-size-4xl)', marginBottom: '8px' }}>📅</div>
              <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>Aucune donnée pour ce mois.</p>
            </div>
          )}
        </>
      )}

      {/* ═══ VUE ÉVOLUTION ═══ */}
      {view === 'evolution' && (
        <div>
          {loadingEvolution ? (
            <div style={{ padding: '1rem' }}>
              <SkeletonCard style={{ marginBottom: '1rem' }}>
                <SkeletonLine width="50%" height="1.5rem" style={{ marginBottom: '1rem' }} />
                <SkeletonLine height="200px" />
              </SkeletonCard>
            </div>
          ) : evolutionData ? (
            <>
              {/* Sélecteur période */}
              <div style={{ display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-full)', padding: '4px', marginBottom: '1rem', gap: 'var(--space-2xs)' }}>
                {[7, 30, 90, 365].map(days => (
                  <button key={days} onClick={() => { setEvolutionPeriod(days); setEvolutionData(null); }} style={{
                    flex: 1, padding: '0.45rem 0', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                    background: evolutionPeriod === days ? 'var(--accent-blue)' : 'transparent',
                    color: evolutionPeriod === days ? '#fff' : 'var(--text-secondary)',
                    fontWeight: evolutionPeriod === days ? 700 : 400, fontSize: 'var(--font-size-xs)', transition: 'all 0.2s',
                  }}>
                    {days}j
                  </button>
                ))}
              </div>

              {/* Graphique poids */}
              <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {t('evolution.weightChart')}
                </h3>
                {evolutionData.weight_entries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={evolutionData.weight_entries.map(e => ({ ...e, weight_display: weightUnit === 'lbs' ? kgToLbs(e.weight_kg) : e.weight_kg }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="date" tick={{ fontSize: 'var(--font-size-2xs)', fill: '#aaa' }} tickFormatter={d => d.slice(5)} />
                      <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 'var(--font-size-2xs)' }} unit={` ${weightUnit}`} width={55} />
                      <Tooltip formatter={(v) => [`${v} ${weightUnit}`, t('evolution.weightChart')]} labelFormatter={l => l} />
                      <Line type="monotone" dataKey="weight_display" stroke="#6366F1" strokeWidth={2} dot={{ r: 4, fill: '#6366F1' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                    Aucune entrée de poids sur cette période
                  </div>
                )}
              </div>

              {/* Graphique composition */}
              {evolutionData.period && evolutionData.weight_entries.length > 1 && (
                <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {t('evolution.compositionChart')}
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={prepareCompositionData(evolutionData)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="date" tick={{ fontSize: 'var(--font-size-2xs)', fill: '#aaa' }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 'var(--font-size-2xs)' }} unit=" kg" width={50} />
                      <Tooltip formatter={(v, name) => [`${v} kg`, name]} />
                      <Area type="monotone" dataKey="lean_kg" stackId="1" stroke="#1A6B3C" fill="#EAF3DE" name={t('evolution.leanMass')} />
                      <Area type="monotone" dataKey="fat_kg"  stackId="1" stroke="#ef4444" fill="#fee2e2" name={t('evolution.fatMass')} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                    {t('evolution.disclaimer')}
                  </p>
                </div>
              )}

              {/* Récap période — MetricCards 2×2 */}
              {evolutionData.period && (
                <>
                  <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{t('evolution.summary')}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <MetricCard
                        label="Poids perdu"
                        value={`${evolutionData.period.total_delta_weight_kg > 0 ? '+' : ''}${evolutionData.period.total_delta_weight_kg?.toFixed(1)} kg`}
                        status={evolutionData.period.total_delta_weight_kg < 0 ? 'good' : evolutionData.period.total_delta_weight_kg > 0.5 ? 'warning' : 'neutral'}
                      />
                      <MetricCard
                        label="Muscle"
                        value={`${evolutionData.period.total_delta_lean_kg > 0 ? '+' : ''}${evolutionData.period.total_delta_lean_kg?.toFixed(2)} kg`}
                        status={evolutionData.period.total_delta_lean_kg >= 0 ? 'good' : 'neutral'}
                      />
                      <MetricCard
                        label="Graisse"
                        value={`${evolutionData.period.total_delta_fat_kg > 0 ? '+' : ''}${evolutionData.period.total_delta_fat_kg?.toFixed(2)} kg`}
                        status={evolutionData.period.total_delta_fat_kg < 0 ? 'good' : evolutionData.period.total_delta_fat_kg > 0.3 ? 'danger' : 'neutral'}
                      />
                      <MetricCard
                        label="Body fat %"
                        value={`${evolutionData.current_bf_pct}%`}
                        unit="masse grasse"
                        status="neutral"
                      />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '10px', fontStyle: 'italic', lineHeight: 1.4 }}>
                      {t('evolution.disclaimer')}
                    </p>
                  </div>
                  <button onClick={handleExportPDF} style={{
                    width: '100%', padding: '0.85rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    border: '1px solid var(--accent-blue)', background: 'transparent', color: 'var(--accent-blue)',
                    fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-xs)',
                  }}>
                    📄 Exporter en PDF
                  </button>
                </>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>⚖️</div>
              <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>Aucune donnée disponible</p>
            </div>
          )}
        </div>
      )}

      </div>{/* /padding wrapper */}
    </div>
  );
}
