import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, subDays, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useJournalStore, useProfileStore } from '../store';
import { useTranslation } from '../i18n';
import api from '../utils/api';
import VoiceInput from '../components/VoiceInput';
import VoiceFoodModal from '../components/VoiceFoodModal';
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
      setTodayWeight(todayRes.data.length > 0 ? todayRes.data[0].weight_kg : '');
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
      if (!res.data || res.data.length === 0) {
        toast.error(t('journal.noMealsYesterday'));
        return;
      }
      for (const entry of res.data) {
        await api.post('/journal', {
          product_id: entry.product_id,
          meal_type: entry.meal_type,
          grams: entry.grams,
          date,
        });
      }
      toast.success(`${res.data.length} ${t('journal.duplicated')}`);
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

  const MEALS = ['pdej', 'dej', 'coll', 'diner'].map(id => ({ id, label: t(`journal.meals.${id}`), icon: MEAL_ICONS[id] }));

  const pct = Math.min(100, Math.round(totals.kcal / target * 100));
  const remaining = target - totals.kcal;
  const barColor = pct > 110 ? '#993C1D' : pct > 90 ? '#BA7517' : '#1A6B3C';

  const changeDate = (delta) => {
    const newDate = format(addDays(parseISO(date), delta), 'yyyy-MM-dd');
    setDate(newDate);
  };

  const handleDelete = async (id) => {
    try { await removeEntry(id); toast.success(t('journal.deleted')); }
    catch { toast.error(t('common.error')); }
  };

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* Header */}
      <div style={{ background: '#1A6B3C', color: 'white', padding: '1rem 1.25rem 1.5rem', borderRadius: '0 0 24px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>{t('journal.title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <button onClick={() => changeDate(-1)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 18 }}>‹</button>
          <span style={{ fontSize: 14, opacity: 0.9 }}>
            {format(parseISO(date), 'EEEE d MMMM', { locale: dateFnsLocale })}
          </span>
          <button onClick={() => changeDate(1)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 18 }}>›</button>
        </div>
      </div>

      {/* Résumé calories */}
      <div style={{ margin: '1rem 1.25rem 0', background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 500, color: '#1A6B3C' }}>{totals.kcal} {t('common.kcal')}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{t('journal.consumed')} / {target} {t('common.kcal')} {t('journal.target')}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: remaining < 0 ? '#993C1D' : remaining < 200 ? '#BA7517' : '#1A6B3C' }}>
              {Math.max(0, remaining)} {t('common.kcal')}
            </div>
            <div style={{ fontSize: 11, color: '#888' }}>{t('journal.remaining')}</div>
          </div>
        </div>
        <div style={{ padding: '0 16px 4px' }}>
          <div style={{ height: 10, background: '#f0f0ec', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 5, transition: 'width 0.4s' }} />
          </div>
        </div>
        {/* Macros */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
          {[
            { key: 'glucides', val: totals.glucides, color: '#BA7517', ratio: [0.5, 4] },
            { key: 'proteines', val: totals.proteines, color: '#185FA5', ratio: [0.2, 4] },
            { key: 'lipides', val: totals.lipides, color: '#993C1D', ratio: [0.3, 9] }
          ].map(({ key, val, color, ratio }) => {
            const tgt = Math.round(target * ratio[0] / ratio[1]);
            return (
              <div key={key} style={{ padding: '8px 10px', textAlign: 'center', borderRight: '0.5px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{val}g</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{t(`common.${key}`)}</div>
                <div style={{ height: 4, background: '#f0f0ec', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, Math.round(val / tgt * 100))}%`, background: color, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Poids du jour */}
      <div style={{ margin: '0.8rem 1.25rem 0', padding: '1rem', borderRadius: '8px', background: 'var(--bg-primary)', boxShadow: '0 1px 3px var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: '600' }}>
            ⚖️ {t('weight.title')}
          </span>
          {yesterdayWeight && (
            <span style={{ fontSize: '0.85rem', color: weightDelta >= 0 ? '#ef4444' : '#10b981', fontWeight: '500' }}>
              {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} {weightUnit}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <input
            type="number"
            step="0.1"
            placeholder={weightPlaceholder(weightUnit)}
            value={todayWeight}
            onChange={(e) => setTodayWeight(e.target.value)}
            onBlur={handleWeightSubmit}
            onKeyPress={(e) => e.key === 'Enter' && handleWeightSubmit()}
            style={{ flex: 1, padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '1rem' }}
          />
          <VoiceInput
            context="weight"
            onResult={handleVoiceWeight}
            showTranscript={false}
            buttonStyle={{ padding: '0.6rem' }}
          />
        </div>
      </div>

      {/* Dupliquer repas d'hier */}
      <div style={{ margin: '0.8rem 1.25rem 0', textAlign: 'center' }}>
        <button onClick={duplicateYesterdayMeals} style={{
          padding: '0.6rem 1.5rem', borderRadius: 20,
          border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
          color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: 13,
        }}>
          <span>📋</span>
          <span>{t('journal.duplicateYesterday')}</span>
        </button>
      </div>

      {/* Saisie vocale aliments */}
      <div style={{ margin: '0.8rem 1.25rem 0', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px', boxShadow: '0 1px 3px var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>🎤 {t('voice.addFoodVoice')}</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 0.8rem' }}>
          {t('voice.foodHelp')}
        </p>
        <VoiceInput context="food" onResult={handleVoiceFood} showTranscript={true} />
      </div>

      {/* Repas */}
      {loading ? (
        <>
          <SkeletonCard style={{ margin: '0.8rem 1.25rem 0' }}>
            <SkeletonLine width="40%" height="1.2rem" style={{ marginBottom: '0.8rem' }} />
            <SkeletonLine width="90%" />
            <SkeletonLine width="70%" style={{ marginTop: '0.5rem' }} />
          </SkeletonCard>
          {[1, 2, 3].map(i => (
            <SkeletonCard key={i} style={{ margin: '0.8rem 1.25rem 0' }}>
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
          <div key={id} style={{ margin: '0.8rem 1.25rem 0', background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: items.length ? '0.5px solid rgba(0,0,0,0.06)' : 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className={`ti ${icon}`} style={{ fontSize: 16, color: '#1A6B3C' }} />
                {label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {mealKcal > 0 && <span style={{ fontSize: 12, color: '#888' }}>{mealKcal} {t('common.kcal')}</span>}
                <button onClick={() => navigate(`/products?meal=${id}`)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '0.5px solid #1A6B3C', color: '#1A6B3C', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <i className="ti ti-plus" style={{ fontSize: 12 }} /> {t('journal.add')}
                </button>
                <button onClick={() => navigate(`/dishes?meal=${id}`)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '0.5px solid #BA7517', color: '#BA7517', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <i className="ti ti-soup" style={{ fontSize: 12 }} /> {t('dishes.addDish')}
                </button>
                <button onClick={() => setVoiceMeal(id)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 20, border: '0.5px solid #6b7280', color: voiceMeal === id ? '#ef4444' : '#6b7280', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  🎤
                </button>
              </div>
            </div>
            {items.length === 0 && <div style={{ padding: 12, fontSize: 12, color: '#bbb', fontStyle: 'italic', paddingLeft: 16 }}>{t('journal.empty')}</div>}
            {items.map((entry, idx) => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderTop: idx > 0 ? '0.5px solid rgba(0,0,0,0.05)' : 'none' }}>
                <span style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{entry.product.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{entry.product.name}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{entry.grams}g · {entry.product.brand}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{entry.kcal} {t('common.kcal')}</span>
                <button onClick={() => handleDelete(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 16, padding: 4 }}>
                  <i className="ti ti-trash" />
                </button>
              </div>
            ))}
          </div>
        );
      })}
      {/* Floating voice recorder for specific meal */}
      {voiceMeal && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--bg-primary)', borderRadius: '16px 16px 0 0',
          padding: '1.25rem', boxShadow: '0 -2px 16px rgba(0,0,0,0.15)', zIndex: 500,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              🎤 {MEALS.find(m => m.id === voiceMeal)?.label}
            </span>
            <button onClick={() => setVoiceMeal(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
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
    </div>
  );
}
