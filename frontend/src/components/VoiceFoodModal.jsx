import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';
import api from '../utils/api';

const MEAL_LABELS = {
  pdej:  { fr: 'Petit-déjeuner', ar: 'فطور',   en: 'Breakfast' },
  dej:   { fr: 'Déjeuner',       ar: 'غداء',    en: 'Lunch'     },
  coll:  { fr: 'Collation',      ar: 'وجبة خفيفة', en: 'Snack'  },
  diner: { fr: 'Dîner',          ar: 'عشاء',    en: 'Dinner'    },
};

export default function VoiceFoodModal({ mealType, rawItems, onConfirm, onClose }) {
  const { t, lang } = useTranslation();
  const [items, setItems] = useState(
    rawItems.map(it => ({ ...it, kcal_per100: null, product_id: null, loading: true }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    rawItems.forEach((raw, idx) => {
      api.get(`/nutrition/search?q=${encodeURIComponent(raw.name)}&sources=local,ciqual`)
        .then(res => {
          const match = res.data[0];
          setItems(prev => {
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              loading: false,
              kcal_per100: match?.kcal ?? null,
              glucides:    match?.glucides ?? null,
              proteines:   match?.proteines ?? null,
              lipides:     match?.lipides ?? null,
              fibres:      match?.fibres ?? null,
              product_id:  match?.product_id ?? null,
            };
            return next;
          });
        })
        .catch(() => {
          setItems(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], loading: false };
            return next;
          });
        });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateGrams = (idx, val) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], amount_g: Math.max(1, parseInt(val) || 1) };
      return next;
    });
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = async () => {
    if (items.length === 0) { onClose(); return; }
    setSaving(true);
    try {
      const payload = items.map(it => ({
        name:       it.name,
        amount_g:   it.amount_g,
        product_id: it.product_id || undefined,
        kcal_per100: it.kcal_per100 || undefined,
        glucides:   it.glucides    || undefined,
        proteines:  it.proteines   || undefined,
        lipides:    it.lipides     || undefined,
        fibres:     it.fibres      || undefined,
      }));
      const res = await api.post('/voice/add-to-journal', { items: payload, meal_type: mealType });
      toast.success(t('voice.itemAdded').replace('{n}', res.data.count));
      onConfirm();
    } catch {
      toast.error(t('voice.addError'));
    } finally {
      setSaving(false);
    }
  };

  const mealLabel = MEAL_LABELS[mealType]?.[lang] || mealType;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '16px 16px 0 0',
        padding: '1.5rem',
        width: '100%', maxWidth: 500,
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
            {t('voice.confirmItems')} · {mealLabel}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {items.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>
            {t('voice.noItemsDetected')}
          </p>
        )}

        {items.map((item, idx) => {
          const estimatedKcal = item.kcal_per100
            ? Math.round(item.kcal_per100 * item.amount_g / 100)
            : null;
          return (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem', borderRadius: '8px',
              background: 'var(--bg-secondary)', marginBottom: '0.5rem',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {item.loading ? '...' : estimatedKcal !== null ? `~${estimatedKcal} kcal` : '~? kcal'}
                </div>
              </div>
              <input
                type="number"
                value={item.amount_g}
                min="1"
                onChange={e => updateGrams(idx, e.target.value)}
                style={{
                  width: 64, padding: '0.4rem',
                  borderRadius: '6px', border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)', color: 'var(--text-primary)',
                  textAlign: 'center', fontSize: '0.9rem',
                }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>g</span>
              <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem', padding: '4px', lineHeight: 1 }}>
                ✕
              </button>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '0.75rem', borderRadius: '8px',
            border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
            color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer',
          }}>
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || items.length === 0}
            style={{
              flex: 2, padding: '0.75rem', borderRadius: '8px', border: 'none',
              background: items.length > 0 && !saving ? '#1A6B3C' : 'var(--bg-tertiary)',
              color: items.length > 0 && !saving ? 'white' : 'var(--text-secondary)',
              fontWeight: 600, cursor: items.length > 0 && !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? t('common.saving') : t('voice.addAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
