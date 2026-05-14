import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, subDays, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useJournalStore, useProfileStore } from '../store';
import { useTranslation } from '../i18n';

const MEAL_ICONS = { pdej: 'ti-coffee', dej: 'ti-soup', coll: 'ti-apple', diner: 'ti-moon' };

export default function JournalPage() {
  const navigate = useNavigate();
  const { date, meals, totals, loading, fetchJournal, removeEntry, setDate } = useJournalStore();
  const { profile } = useProfileStore();
  const { t, dateFnsLocale } = useTranslation();
  const target = profile.target_kcal || 2310;

  useEffect(() => { fetchJournal(); }, []);

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

      {/* Repas */}
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
    </div>
  );
}
