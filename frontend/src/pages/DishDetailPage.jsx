import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useTranslation } from '../i18n';
import useFavoritesStore from '../store/useFavoritesStore';

const MEAL_IDS = ['pdej', 'dej', 'coll', 'diner'];

const DIFF_STYLE = {
  facile:   { bg: '#E8F5E9', color: '#2E7D32', label: '✅ Facile' },
  moyen:    { bg: '#FFF3E0', color: '#E65100', label: '🟡 Moyen' },
  difficile:{ bg: '#FFEBEE', color: '#C62828', label: '🔴 Difficile' },
};

export default function DishDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, lang } = useTranslation();

  const [dish, setDish] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portion, setPortion] = useState(300);
  const [mealType, setMealType] = useState(searchParams.get('meal') || 'dej');
  const [logging, setLogging] = useState(false);

  const { isFavorite, addFavorite, removeFavorite, fetchFavorites } = useFavoritesStore();
  const favorite = isFavorite(parseInt(id));

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const [modifierCatalog, setModifierCatalog] = useState(null);
  const [modifiers, setModifiers] = useState([]);
  const [openCategory, setOpenCategory] = useState(null);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    api.get(`/dishes/${id}`)
      .then(res => {
        setDish(res.data);
        setPortion(res.data.default_portion_g || 300);
      })
      .catch(() => { toast.error('Plat non trouvé'); navigate('/dishes'); })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api.get('/modifiers')
      .then(({ data }) => setModifierCatalog(data))
      .catch(() => setModifierCatalog({}));
  }, []);

  useEffect(() => {
    if (dish?.cuisine) {
      api.get(`/modifiers/defaults/${encodeURIComponent(dish.cuisine)}`)
        .then(({ data }) => {
          if (Array.isArray(data) && data.length) {
            setModifiers(data.map(d => ({ id: d.id, amount_g: d.amount_g })));
          }
        })
        .catch(() => {});
    }
  }, [dish?.cuisine]);

  const findInCatalog = (modId) => {
    if (!modifierCatalog) return null;
    for (const items of Object.values(modifierCatalog)) {
      const found = items.find(i => i.id === modId);
      if (found) return found;
    }
    return null;
  };

  const computed = useMemo(() => {
    if (!dish) return { kcal: 0, glucides: 0, proteines: 0, lipides: 0, fibres: 0 };
    const ratio = portion / (dish.default_portion_g || 300);
    let kcal      = (dish.kcal_per_portion || 0) * ratio;
    let glucides  = (dish.glucides  || 0) * ratio;
    let proteines = (dish.proteines || 0) * ratio;
    let lipides   = (dish.lipides   || 0) * ratio;
    let fibres    = (dish.fibres    || 0) * ratio;

    for (const m of modifiers) {
      const mod = findInCatalog(m.id);
      if (!mod) continue;
      const f = (m.amount_g || 0) / 100;
      kcal      += (mod.kcal_per_100g || 0) * f;
      glucides  += (mod.glucides  || 0) * f;
      proteines += (mod.proteines || 0) * f;
      lipides   += (mod.lipides   || 0) * f;
      fibres    += (mod.fibres    || 0) * f;
    }

    return {
      kcal:      Math.round(kcal),
      glucides:  Math.round(glucides  * 10) / 10,
      proteines: Math.round(proteines * 10) / 10,
      lipides:   Math.round(lipides   * 10) / 10,
      fibres:    Math.round(fibres    * 10) / 10,
    };
  }, [dish, portion, modifiers, modifierCatalog]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#888', fontSize: 14 }}>
      {t('common.loading')}
    </div>
  );
  if (!dish) return null;

  const defaultPortion = dish.default_portion_g || 300;

  const dishName = lang === 'ar' && dish.name_ar ? dish.name_ar
    : lang === 'en' && dish.name_en ? dish.name_en
    : dish.name;

  const diff = DIFF_STYLE[dish.difficulty] || DIFF_STYLE.moyen;

  const handleLog = async () => {
    setLogging(true);
    try {
      await api.post(`/dishes/${id}/log`, {
        meal_type: mealType,
        portion_g: portion,
        modifiers,
      });
      toast.success(`${dishName} ajouté — ${computed.kcal} kcal`);
      navigate('/journal');
    } catch {
      toast.error("Erreur lors de l'ajout au journal");
    } finally {
      setLogging(false);
    }
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: '#1A6B3C', color: 'white', padding: '1rem 1.25rem 2rem', borderRadius: '0 0 24px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 14 }}>
            ‹ Retour
          </button>
          <button
            onClick={() => favorite ? removeFavorite(parseInt(id)) : addFavorite(parseInt(id))}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontSize: 18 }}
          >
            {favorite ? '⭐' : '☆'}
          </button>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 72, lineHeight: 1.1, marginBottom: 10 }}>{dish.emoji || '🍽️'}</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>{dishName}</h1>
          <div style={{ fontSize: 13, opacity: 0.85 }}>{dish.flag} {dish.cuisine} · {t(`dishes.categories.${dish.category}`) || dish.category}</div>
        </div>
      </div>

      <div style={{ padding: '1rem 1.25rem' }}>
        {/* Badges */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          {dish.prep_time_min > 0 && (
            <span style={{ background: '#f0f5ee', color: '#1A6B3C', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 500 }}>
              ⏲ {t('dishes.prep')} {dish.prep_time_min} min
            </span>
          )}
          {dish.cook_time_min > 0 && (
            <span style={{ background: '#f0f5ee', color: '#1A6B3C', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 500 }}>
              🔥 {t('dishes.cook')} {dish.cook_time_min} min
            </span>
          )}
          <span style={{ background: diff.bg, color: diff.color, borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 500 }}>
            {diff.label}
          </span>
          {dish.is_user_created ? (
            <span style={{ background: '#E3F2FD', color: '#1565C0', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 500 }}>
              ✨ {t('dishes.customBadge')}
            </span>
          ) : null}
        </div>

        {/* Description */}
        {dish.description ? (
          <p style={{ fontSize: 13, color: '#666', textAlign: 'center', margin: '0 0 14px', fontStyle: 'italic', lineHeight: 1.5 }}>
            {dish.description}
          </p>
        ) : null}

        {/* Portion slider */}
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{t('dishes.adjustPortion')}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#1A6B3C' }}>{portion}g</span>
          </div>
          <input type="range" min={50} max={800} step={10} value={portion}
            onChange={e => setPortion(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#1A6B3C', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#bbb', marginTop: 2 }}>
            <span>50g</span><span style={{ color: '#1A6B3C', fontWeight: 500 }}>{defaultPortion}g défaut</span><span>800g</span>
          </div>
        </div>

        {/* Modifier panel */}
        {modifierCatalog && (
          <div style={{ marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setShowPanel(!showPanel)}
              style={{ width: '100%', padding: '12px 16px', background: '#f5f5f3', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>⚙️ {t('modifiers.title')} {modifiers.length > 0 && <span style={{ color: '#1A6B3C' }}>({modifiers.length})</span>}</span>
              <span style={{ color: '#888' }}>{showPanel ? '▼' : '▶'}</span>
            </button>

            {showPanel && (
              <div style={{ marginTop: 6, border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                {Object.entries(modifierCatalog).map(([category, items]) => {
                  const isOpen = openCategory === category;
                  const selectedInCategory = modifiers.filter(m => items.some(i => i.id === m.id));
                  return (
                    <div key={category} style={{ borderBottom: '0.5px solid #f0f0ec' }}>
                      <button
                        type="button"
                        onClick={() => setOpenCategory(isOpen ? null : category)}
                        style={{ width: '100%', padding: '11px 14px', background: '#fff', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}
                      >
                        <span style={{ fontWeight: 500 }}>
                          {t(`modifiers.categories.${category}`)}
                          {selectedInCategory.length > 0 && <span style={{ marginLeft: 6, color: '#1A6B3C', fontWeight: 700 }}>· {selectedInCategory.length}</span>}
                        </span>
                        <span style={{ color: '#aaa', fontSize: 11 }}>{isOpen ? '▼' : '▶'}</span>
                      </button>

                      {isOpen && (
                        <div style={{ padding: '8px 14px 12px', background: '#fafaf8' }}>
                          {selectedInCategory.map(m => {
                            const item = items.find(i => i.id === m.id);
                            if (!item) return null;
                            return (
                              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.emoji}</span>
                                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                                <input
                                  type="range"
                                  min={0}
                                  max={50}
                                  step={1}
                                  value={m.amount_g}
                                  onChange={e => setModifiers(modifiers.map(x => x.id === m.id ? { ...x, amount_g: +e.target.value } : x))}
                                  style={{ width: 80, accentColor: '#1A6B3C' }}
                                />
                                <span style={{ minWidth: 34, textAlign: 'right', fontSize: 12, color: '#555' }}>{m.amount_g}g</span>
                                <button
                                  type="button"
                                  onClick={() => setModifiers(modifiers.filter(x => x.id !== m.id))}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cc4444', fontSize: 16, padding: 2, flexShrink: 0 }}
                                >✕</button>
                              </div>
                            );
                          })}
                          <select
                            value=""
                            onChange={e => {
                              if (!e.target.value) return;
                              const item = items.find(i => i.id === e.target.value);
                              if (item) setModifiers([...modifiers, { id: item.id, amount_g: item.default_amount_g || 10 }]);
                            }}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.15)', fontSize: 12, marginTop: 4, background: '#fff' }}
                          >
                            <option value="">+ {t('modifiers.add')}...</option>
                            {items.filter(i => !modifiers.some(m => m.id === i.id)).map(i => (
                              <option key={i.id} value={i.id}>{i.emoji} {i.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Calories card */}
        <div style={{ background: '#1A6B3C', color: 'white', borderRadius: 12, padding: '16px 20px', marginBottom: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{computed.kcal} <span style={{ fontSize: 16, opacity: 0.8 }}>kcal</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 12 }}>
            {[['Glucides', computed.glucides], ['Protéines', computed.proteines], ['Lipides', computed.lipides]].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{val}g</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          {computed.fibres > 0 && (
            <div style={{ fontSize: 11, opacity: 0.65, marginTop: 8 }}>Fibres : {computed.fibres}g</div>
          )}
        </div>

        {/* Ingredients */}
        {dish.ingredients?.length > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px', color: '#333' }}>{t('dishes.ingredients')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {dish.ingredients.map((ing, i) => {
                const ratio = portion / defaultPortion;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span style={{ color: '#444' }}>{ing.name || `Ingrédient ${i + 1}`}</span>
                    <span style={{ color: '#888', fontWeight: 500 }}>{Math.round(ing.grams * ratio)}g</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Meal type selector */}
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px', color: '#333' }}>Repas</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MEAL_IDS.map(m => (
              <button key={m} onClick={() => setMealType(m)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: 500,
                border: mealType === m ? 'none' : '0.5px solid #e0e0e0',
                background: mealType === m ? '#1A6B3C' : '#f5f5f3',
                color: mealType === m ? '#fff' : '#555',
                transition: 'all 0.15s',
              }}>
                {t(`journal.meals.${m}`)}
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button onClick={handleLog} disabled={logging} style={{
          width: '100%', padding: '15px 24px',
          background: logging ? '#ccc' : '#1A6B3C',
          color: 'white', border: 'none', borderRadius: 14,
          fontSize: 15, fontWeight: 700,
          cursor: logging ? 'not-allowed' : 'pointer',
          boxShadow: logging ? 'none' : '0 4px 14px rgba(26,107,60,0.3)',
        }}>
          {logging ? 'Ajout en cours...' : `📓 ${t('dishes.addToJournal')} — ${computed.kcal} kcal`}
        </button>
      </div>
    </div>
  );
}
