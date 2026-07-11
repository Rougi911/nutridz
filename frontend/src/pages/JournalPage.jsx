import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, subDays, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useJournalStore, useProfileStore } from '../store';
import { useTranslation } from '../i18n';
import api from '../utils/api';
import GradientHeader from '../components/GradientHeader';
import BarcodeScanner from '../components/BarcodeScanner';
import VoiceInput from '../components/VoiceInput';
import VoiceFoodModal from '../components/VoiceFoodModal';
import FoodVisionPage from './FoodVisionPage';
import { SkeletonLine, SkeletonCard } from '../components/Skeleton';
import useSettingsStore from '../store/useSettingsStore';
import { weightPlaceholder, inputWeightToKg, kgToLbs } from '../utils/units';

const MEAL_ICONS = { pdej: 'ti-coffee', dej: 'ti-soup', coll: 'ti-apple', diner: 'ti-moon' };

export default function JournalPage() {
  const navigate = useNavigate();
  const { date, meals, totals, loading, fetchJournal, removeEntry, setDate } = useJournalStore();
  const { profile } = useProfileStore();
  const { t, dateFnsLocale, lang } = useTranslation();
  const target = profile.target_kcal || 2310;

  const [todayWeight, setTodayWeight] = useState('');
  const [yesterdayWeight, setYesterdayWeight] = useState(null);
  const [voiceMeal, setVoiceMeal] = useState(null);
  const [voiceModal, setVoiceModal] = useState({ open: false, mealType: null, items: [] });
  const [showScanner, setShowScanner] = useState(false);
  const [showVision,  setShowVision]  = useState(false);
  const [showVoice,   setShowVoice]   = useState(false);
  const { weightUnit } = useSettingsStore();
  const yesterdayInUnit = yesterdayWeight ? (weightUnit === 'lbs' ? kgToLbs(yesterdayWeight) : yesterdayWeight) : null;
  const weightDelta = todayWeight && yesterdayInUnit ? parseFloat(todayWeight) - yesterdayInUnit : 0;

  useEffect(() => { fetchJournal(); }, []);

  const fetchWeights = async () => {
    try {
      const today = format(parseISO(date), 'yyyy-MM-dd');
      const yesterday = format(subDays(parseISO(date), 1), 'yyyy-MM-dd');
      const [todayRes, yesterdayRes] = await Promise.all([
        api.get(`/weight?from=${today}&to=${today}`),
        api.get(`/weight?from=${yesterday}&to=${yesterday}`),
      ]);
      // E7 (ultrareview) : afficher dans l'unité choisie. L'input est ré-interprété en lbs
      // par handleWeightSubmit ; sans conversion, 70 kg affiché était re-sauvé comme 31,75 kg.
      const rawToday = todayRes.data.length > 0 ? todayRes.data[0].weight_kg : null;
      setTodayWeight(rawToday != null ? (weightUnit === 'lbs' ? kgToLbs(rawToday) : rawToday) : '');
      setYesterdayWeight(yesterdayRes.data.length > 0 ? yesterdayRes.data[0].weight_kg : null);
    } catch (err) {
      console.error('Weight fetch error:', err);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchWeights(); }, [date]);

  const handleWeightSubmit = async () => {
    const kg = inputWeightToKg(todayWeight, weightUnit);
    if (!kg || kg < 20 || kg > 300) return;
    try {
      await api.post('/weight', { weight_kg: kg, date: format(parseISO(date), 'yyyy-MM-dd') });
      toast.success(t('weight.saved'));
    } catch {
      toast.error(t('weight.error'));
    }
  };

  const duplicateYesterdayMeals = async () => {
    try {
      const yesterday = format(subDays(parseISO(date), 1), 'yyyy-MM-dd');
      const res = await api.get(`/journal?date=${yesterday}`);
      // E8 (ultrareview) : GET /journal renvoie { date, entries, meals, totals } — itérer
      // res.data.entries (l'ancien res.data.length / for..of res.data levait une TypeError).
      const entries = res.data?.entries || [];
      if (entries.length === 0) {
        toast.error(t('journal.noMealsYesterday'));
        return;
      }
      for (const entry of entries) {
        await api.post('/journal', {
          product_id: entry.product_id,
          meal_type: entry.meal_type,
          grams: entry.grams,
          date,
        });
      }
      toast.success(`${entries.length} ${t('journal.duplicated')}`);
      fetchJournal();
    } catch (err) {
      console.error(err);
      toast.error(t('journal.duplicateError'));
    }
  };

  const handleVoiceFood = async (transcript) => {
    try {
      const res = await api.post('/voice/parse', { text: transcript, context: 'food', lang });
      if (res.data.items && res.data.items.length > 0) {
        setVoiceModal({ open: true, mealType: 'dej', items: res.data.items });
      } else {
        toast.error(t('voice.noItemsDetected'));
      }
    } catch {
      toast.error(t('voice.parseError'));
    }
  };

  const handleMealVoice = async (transcript, mealType) => {
    setVoiceMeal(null);
    try {
      const res = await api.post('/voice/parse', { text: transcript, context: 'food', lang });
      if (res.data.items && res.data.items.length > 0) {
        setVoiceModal({ open: true, mealType, items: res.data.items });
      } else {
        toast.error(t('voice.noItemsDetected'));
      }
    } catch {
      toast.error(t('voice.parseError'));
    }
  };

  const handleVoiceWeight = async (transcript) => {
    try {
      const res = await api.post('/voice/parse', { text: transcript, context: 'weight', lang });
      if (res.data.weight_kg) {
        const displayVal = weightUnit === 'lbs' ? kgToLbs(res.data.weight_kg) : res.data.weight_kg;
        setTodayWeight(String(displayVal));
        await api.post('/weight', { weight_kg: res.data.weight_kg, date: format(parseISO(date), 'yyyy-MM-dd') });
        toast.success(t('weight.saved'));
        fetchWeights();
      } else {
        toast.error(t('voice.weightNotDetected'));
      }
    } catch {
      toast.error(t('voice.parseError'));
    }
  };

  const handleScanResult = async (code) => {
    if (!code) return;
    try {
      const { data: product } = await api.get(`/scanner/barcode/${code}`);
      if (product?.id) {
        await api.post('/journal', { product_id: product.id, meal_type: 'dej', grams: 100, date });
        fetchJournal?.();
      }
    } catch { /* silent fail */ }
    setShowScanner(false);
  };

  const handleVisionResult = async (food) => {
    if (!food?.product_id) return;
    await api.post('/journal', { product_id: food.product_id, meal_type: 'dej', grams: 100, date });
    fetchJournal?.();
    setShowVision(false);
  };

  const MEALS = ['pdej', 'dej', 'coll', 'diner'].map(id => ({ id, label: t(`journal.meals.${id}`), icon: MEAL_ICONS[id] }));

  const pct = Math.min(100, Math.round(totals.kcal / target * 100));
  const remaining = target - totals.kcal;

  const changeDate = (delta) => {
    const newDate = format(addDays(parseISO(date), delta), 'yyyy-MM-dd');
    setDate(newDate);
  };

  const handleDelete = async (id) => {
    try { await removeEntry(id); toast.success(t('journal.deleted')); }
    catch { toast.error(t('common.error')); }
  };

  // SVG calorie ring dimensions
  const ringSize = 180;
  const ringRadius = (ringSize - 20) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (pct / 100) * ringCircumference;
  const overTarget = totals.kcal > target;

  return (
    <div style={{ paddingBottom: 'var(--space-card)' }}>
      {/* Gradient header */}
      <GradientHeader
        title={t('journal.title')}
        subtitle={format(parseISO(date), 'EEEE d MMMM', { locale: dateFnsLocale })}
        variant="indigo"
      >
        <button onClick={() => changeDate(-1)} aria-label="Jour précédent"
          style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', borderRadius: 'var(--radius-full)', width: 'var(--size-icon-btn)', height: 'var(--size-icon-btn)', cursor: 'pointer', fontSize: 'var(--font-size-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <button onClick={() => changeDate(1)} aria-label="Jour suivant"
          style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', borderRadius: 'var(--radius-full)', width: 'var(--size-icon-btn)', height: 'var(--size-icon-btn)', cursor: 'pointer', fontSize: 'var(--font-size-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        <button onClick={() => setShowScanner(true)} aria-label="Scanner"
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 'var(--radius-full)', width: 'var(--size-icon-btn)', height: 'var(--size-icon-btn)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ti ti-barcode" style={{ fontSize: 'var(--font-size-lg)' }} />
        </button>
        <button onClick={() => setShowVision(true)} aria-label="Photo"
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 'var(--radius-full)', width: 'var(--size-icon-btn)', height: 'var(--size-icon-btn)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ti ti-camera" style={{ fontSize: 'var(--font-size-lg)' }} />
        </button>
        <button onClick={() => setShowVoice(true)} aria-label="Voix"
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 'var(--radius-full)', width: 'var(--size-icon-btn)', height: 'var(--size-icon-btn)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ti ti-microphone" style={{ fontSize: 'var(--font-size-lg)' }} />
        </button>
      </GradientHeader>

      {/* Calorie ring */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '1.25rem 1.25rem 0', background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color)', padding: '1.25rem', boxShadow: '0 2px 12px var(--shadow)' }}>
        <div style={{ position: 'relative', width: ringSize, height: ringSize }}>
          <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke="var(--bg-tertiary)" strokeWidth={12} />
            <defs>
              <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={overTarget ? '#ef4444' : '#6366f1'} />
                <stop offset="100%" stopColor={overTarget ? '#f97316' : '#8b5cf6'} />
              </linearGradient>
            </defs>
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
              fill="none" stroke="url(#calGrad)" strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span className="hero-number" style={{ color: 'var(--text-primary)' }}>{totals.kcal}</span>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>/ {target} kcal</span>
          </div>
        </div>
        <span style={{ marginTop: 'var(--space-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: overTarget ? 'var(--accent-red)' : 'var(--accent-green)' }}>
          {overTarget ? `+${Math.abs(remaining)} kcal` : `${remaining} kcal ${t('journal.remaining')}`}
        </span>
      </div>

      {/* Macro pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '0.75rem 1.25rem 0' }}>
        {[
          { key: 'glucides', val: totals.glucides, icon: '🍚', ratio: [0.5, 4], color: 'var(--accent-yellow)' },
          { key: 'proteines', val: totals.proteines, icon: '🥩', ratio: [0.2, 4], color: 'var(--accent-blue)' },
          { key: 'lipides', val: totals.lipides, icon: '🥑', ratio: [0.3, 9], color: 'var(--accent-green)' }
        ].map(({ key, val, icon, ratio, color }) => {
          const tgt = Math.round(target * ratio[0] / ratio[1]);
          const pctMacro = Math.min(100, Math.round(val / tgt * 100));
          return (
            <div key={key} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2xs)', boxShadow: '0 1px 6px var(--shadow)' }}>
              <span style={{ fontSize: 'var(--font-size-xl)' }}>{icon}</span>
              <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{val}<span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-secondary)' }}>g</span></span>
              <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>{t(`common.${key}`)}</span>
              <div style={{ height: '4px', width: '100%', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-2xs)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pctMacro}%`, background: color, borderRadius: 'var(--radius-2xs)', transition: 'width 0.5s ease' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 'var(--space-xs)', overflowX: 'auto', padding: '0.75rem 1.25rem 0', scrollbarWidth: 'none' }}>
        {[
          { icon: 'ti-camera', label: t('nav.vision'), action: () => navigate('/vision') },
          { icon: 'ti-barcode', label: t('nav.scanner'), action: () => navigate('/scanner') },
          { icon: 'ti-copy', label: t('journal.duplicateYesterday'), action: duplicateYesterdayMeals },
        ].map(({ icon, label, action }, i) => (
          <button key={i} onClick={action} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--text-primary)', boxShadow: '0 1px 4px var(--shadow)', flexShrink: 0 }}>
            <i className={`ti ${icon}`} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent-blue)' }} />
            {label}
          </button>
        ))}
        <VoiceInput context="food" onResult={handleVoiceFood} showTranscript={false}
          buttonStyle={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 'var(--font-size-xs)', fontWeight: 500, boxShadow: '0 1px 4px var(--shadow)', flexShrink: 0 }}
        />
      </div>

      {/* Poids du jour */}
      <div style={{ margin: '0.75rem 1.25rem 0', padding: '1rem', borderRadius: 'var(--radius-lg)', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', boxShadow: '0 1px 6px var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="ti ti-scale" style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)' }} />
            {t('weight.title')}
          </span>
          {yesterdayWeight && (
            <span style={{ fontSize: '0.8rem', color: weightDelta >= 0 ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: 600 }}>
              {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} {weightUnit}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input
            type="number"
            step="0.1"
            placeholder={weightPlaceholder(weightUnit)}
            value={todayWeight}
            onChange={(e) => setTodayWeight(e.target.value)}
            onBlur={handleWeightSubmit}
            onKeyPress={(e) => e.key === 'Enter' && handleWeightSubmit()}
            style={{ flex: 1, padding: '0.6rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.95rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
          <VoiceInput
            context="weight"
            onResult={handleVoiceWeight}
            showTranscript={false}
            buttonStyle={{ padding: '0.6rem' }}
          />
        </div>
      </div>

      {/* Repas */}
      {loading ? (
        <>
          <SkeletonCard style={{ margin: '0.75rem 1.25rem 0' }}>
            <SkeletonLine width="40%" height="1.2rem" style={{ marginBottom: '0.8rem' }} />
            <SkeletonLine width="90%" />
            <SkeletonLine width="70%" style={{ marginTop: '0.5rem' }} />
          </SkeletonCard>
          {[1, 2, 3].map(i => (
            <SkeletonCard key={i} style={{ margin: '0.75rem 1.25rem 0' }}>
              <SkeletonLine width="30%" height="1rem" style={{ marginBottom: '0.8rem' }} />
              <SkeletonLine width="80%" />
            </SkeletonCard>
          ))}
        </>
      ) : null}
      {MEALS.map(({ id, label, icon }) => {
        const items = meals[id] || [];
        const mealKcal = items.reduce((s, e) => s + e.kcal, 0);
        return (
          <div key={id} style={{ margin: '0.75rem 1.25rem 0', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 1px 6px var(--shadow)' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: items.length ? '1px solid var(--border-color)' : 'none' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-primary)' }}>
                <i className={`ti ${icon}`} style={{ fontSize: 'var(--font-size-base)', color: 'var(--accent-blue)' }} />
                {label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                {mealKcal > 0 && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>{mealKcal} kcal</span>}
                <button onClick={() => navigate(`/products?meal=${id}`)} style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
                  <i className="ti ti-plus" style={{ fontSize: 'var(--font-size-xs)' }} /> {t('journal.add')}
                </button>
                <button onClick={() => navigate(`/dishes?meal=${id}`)} style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
                  <i className="ti ti-soup" style={{ fontSize: 'var(--font-size-xs)' }} />
                </button>
                <button onClick={() => setVoiceMeal(id)} style={{ fontSize: 'var(--font-size-sm)', width: 'var(--size-icon-btn-sm)', height: 'var(--size-icon-btn-sm)', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', color: voiceMeal === id ? 'var(--accent-red)' : 'var(--text-secondary)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  🎤
                </button>
              </div>
            </div>
            {items.length === 0 && <div style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{t('journal.empty')}</div>}
            {items.map((entry, idx) => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none' }}>
                <span style={{ fontSize: 'var(--font-size-xl)', width: '26px', textAlign: 'center' }}>{entry.product.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{entry.product.name}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '1px' }}>{entry.grams}g · {entry.product.brand}</div>
                </div>
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{entry.kcal} kcal</span>
                <button onClick={() => handleDelete(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-base)', padding: '4px' }}>
                  <i className="ti ti-trash" />
                </button>
              </div>
            ))}
          </div>
        );
      })}

      {/* Floating voice recorder for specific meal */}
      {voiceMeal && (
        <div className="slide-up" style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          width: 'calc(100% - 2rem)', maxWidth: '448px',
          background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)',
          padding: '1.25rem', boxShadow: '0 -4px 24px var(--shadow)', zIndex: 500,
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🎤 {MEALS.find(m => m.id === voiceMeal)?.label}
            </span>
            <button onClick={() => setVoiceMeal(null)} style={{ background: 'var(--bg-tertiary)', border: 'none', width: 'var(--size-icon-btn-sm)', height: 'var(--size-icon-btn-sm)', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-base)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
            {t('voice.foodHelp')}
          </p>
          <VoiceInput
            context="food"
            onResult={(transcript) => handleMealVoice(transcript, voiceMeal)}
            showTranscript={true}
          />
        </div>
      )}

      {/* Voice food confirmation modal */}
      {voiceModal.open && (
        <VoiceFoodModal
          mealType={voiceModal.mealType}
          rawItems={voiceModal.items}
          onConfirm={() => {
            setVoiceModal({ open: false, mealType: null, items: [] });
            fetchJournal();
          }}
          onClose={() => setVoiceModal({ open: false, mealType: null, items: [] })}
        />
      )}

      {/* Scanner modal overlay */}
      {showScanner && (
        <div className="modal-overlay" onClick={() => setShowScanner(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <BarcodeScanner onDetected={handleScanResult} onClose={() => setShowScanner(false)} />
          </div>
        </div>
      )}

      {/* Vision (photo) modal overlay */}
      {showVision && (
        <div className="modal-overlay" onClick={() => setShowVision(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <FoodVisionPage onResult={handleVisionResult} onClose={() => setShowVision(false)} />
          </div>
        </div>
      )}

      {/* Voice modal overlay */}
      {showVoice && (
        <div className="modal-overlay" onClick={() => setShowVoice(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <VoiceInput onResult={() => setShowVoice(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
