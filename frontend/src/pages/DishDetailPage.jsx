import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useTranslation } from '../i18n';
import useFavoritesStore from '../store/useFavoritesStore';
import { useProfileStore } from '../store';
import GradientHeader from '../components/GradientHeader';
import MacroPillCard from '../components/MacroPillCard';

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

  const { profile } = useProfileStore();
  const targetKcal = profile.target_kcal || 2000;

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
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
    <div style={{ paddingBottom: '100px' }}>
      {/* Header */}
      <GradientHeader
        title={dishName || ''}
        subtitle={dish.cuisine || ''}
        icon={dish.emoji || '🍽️'}
        variant="emerald"
      >
        <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 'var(--radius-sm)', padding: '5px 12px', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
          ‹ Retour
        </button>
        <button
          onClick={() => favorite ? removeFavorite(parseInt(id)) : addFavorite(parseInt(id))}
          style={{
            background: favorite ? 'var(--color-warning-bg)' : 'rgba(255,255,255,0.15)',
            border: 'none',
            color: favorite ? 'var(--accent-yellow)' : 'white',
            borderRadius: 'var(--radius-xl)', padding: '5px 14px', cursor: 'pointer', fontSize: 'var(--font-size-lg)',
          }}
        >
          {favorite ? '⭐' : '☆'}
        </button>
      </GradientHeader>

      <div style={{ padding: '1rem 1.25rem' }}>
        {/* Badges */}
        <div style={{ display: 'flex', gap: 'var(--space-xs)', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
          {dish.prep_time_min > 0 && (
            <span style={{ background: 'var(--color-success-bg)', color: 'var(--accent-green)', borderRadius: 'var(--radius-xl)', padding: '5px 12px', fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>
              ⏲ {t('dishes.prep')} {dish.prep_time_min} min
            </span>
          )}
          {dish.cook_time_min > 0 && (
            <span style={{ background: 'var(--color-success-bg)', color: 'var(--accent-green)', borderRadius: 'var(--radius-xl)', padding: '5px 12px', fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>
              🔥 {t('dishes.cook')} {dish.cook_time_min} min
            </span>
          )}
          <span style={{ background: diff.bg, color: diff.color, borderRadius: 'var(--radius-xl)', padding: '5px 12px', fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>
            {diff.label}
          </span>
          {dish.is_user_created ? (
            <span style={{ background: '#E3F2FD', color: '#1565C0', borderRadius: 'var(--radius-xl)', padding: '5px 12px', fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>
              ✨ {t('dishes.customBadge')}
            </span>
          ) : null}
        </div>

        {/* Description */}
        {dish.description ? (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 14px', fontStyle: 'italic', lineHeight: 1.5 }}>
            {dish.description}
          </p>
        ) : null}

        {/* Portion slider */}
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{t('dishes.adjustPortion')}</span>
            <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--accent-blue)' }}>{portion}g</span>
          </div>
          {/* Quick-pick portion chips */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {[50, 100, 150, 200].map(g => (
              <button key={g} onClick={() => setPortion(g)} style={{
                padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer',
                border: portion === g ? 'none' : '1px solid var(--border-color)',
                background: portion === g ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                color: portion === g ? 'white' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}>{g}g</button>
            ))}
          </div>
          <input type="range" min={50} max={800} step={10} value={portion}
            onChange={e => setPortion(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
          />
          {/* Quick presets */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            {[
              { label: '½ portion', val: Math.round(defaultPortion / 2) },
              { label: 'Normal',   val: defaultPortion },
              { label: 'Double',   val: defaultPortion * 2 },
            ].map(({ label, val }) => (
              <button key={label} onClick={() => setPortion(val)} style={{
                flex: 1, padding: '5px 0', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer',
                border: portion === val ? 'none' : '1px solid var(--border-color)',
                background: portion === val ? 'rgba(99,102,241,0.12)' : 'var(--bg-secondary)',
                color: portion === val ? 'var(--accent-blue)' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Modifier panel */}
        {modifierCatalog && (
          <div style={{ marginBottom: '10px' }}>
            <button
              type="button"
              onClick={() => setShowPanel(!showPanel)}
              style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-primary)' }}
            >
              <span>⚙️ {t('modifiers.title')} {modifiers.length > 0 && <span style={{ color: 'var(--accent-green)' }}>({modifiers.length})</span>}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{showPanel ? '▼' : '▶'}</span>
            </button>

            {showPanel && (
              <div style={{ marginTop: '6px', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-primary)' }}>
                {Object.entries(modifierCatalog).map(([category, items]) => {
                  const isOpen = openCategory === category;
                  const selectedInCategory = modifiers.filter(m => items.some(i => i.id === m.id));
                  return (
                    <div key={category} style={{ borderBottom: '0.5px solid var(--border-color)' }}>
                      <button
                        type="button"
                        onClick={() => setOpenCategory(isOpen ? null : category)}
                        style={{ width: '100%', padding: '11px 14px', background: 'var(--bg-primary)', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-sm)' }}
                      >
                        <span style={{ fontWeight: 500 }}>
                          {t(`modifiers.categories.${category}`)}
                          {selectedInCategory.length > 0 && <span style={{ marginLeft: '6px', color: 'var(--accent-green)', fontWeight: 700 }}>· {selectedInCategory.length}</span>}
                        </span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>{isOpen ? '▼' : '▶'}</span>
                      </button>

                      {isOpen && (
                        <div style={{ padding: '8px 14px 12px', background: 'var(--bg-secondary)' }}>
                          {selectedInCategory.map(m => {
                            const item = items.find(i => i.id === m.id);
                            if (!item) return null;
                            return (
                              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: '10px' }}>
                                <span style={{ fontSize: 'var(--font-size-lg)', flexShrink: 0 }}>{item.emoji}</span>
                                <span style={{ flex: 1, fontSize: 'var(--font-size-xs)', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                                <input
                                  type="range"
                                  min={0}
                                  max={50}
                                  step={1}
                                  value={m.amount_g}
                                  onChange={e => setModifiers(modifiers.map(x => x.id === m.id ? { ...x, amount_g: +e.target.value } : x))}
                                  style={{ width: '80px', accentColor: 'var(--accent-green)' }}
                                />
                                <span style={{ minWidth: '34px', textAlign: 'right', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{m.amount_g}g</span>
                                <button
                                  type="button"
                                  onClick={() => setModifiers(modifiers.filter(x => x.id !== m.id))}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', fontSize: 'var(--font-size-base)', padding: '2px', flexShrink: 0 }}
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
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '0.5px solid rgba(0,0,0,0.15)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-2xs)', background: 'var(--bg-primary)' }}
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

        {/* Macros grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '0 0', marginTop: '12px', marginBottom: '10px' }}>
          <MacroPillCard
            icon="🥩"
            value={computed.proteines}
            target={Math.round(targetKcal * 0.25 / 4)}
            label="Protéines"
            unit="g"
          />
          <MacroPillCard
            icon="🍞"
            value={computed.glucides}
            target={Math.round(targetKcal * 0.5 / 4)}
            label="Glucides"
            unit="g"
          />
          <MacroPillCard
            icon="🫒"
            value={computed.lipides}
            target={Math.round(targetKcal * 0.3 / 9)}
            label="Lipides"
            unit="g"
          />
          <MacroPillCard
            icon="🔥"
            value={computed.kcal}
            target={targetKcal}
            label="Calories"
            unit="kcal"
          />
        </div>

        {/* Ingredients + actions */}
        <div className="card" style={{ margin: '12px 0' }}>
          {/* Ingredients */}
          {dish.ingredients?.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, margin: '0 0 10px', color: 'var(--text-primary)' }}>{t('dishes.ingredients')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {dish.ingredients.map((ing, i) => {
                  const ratio = portion / defaultPortion;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-sm)' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{ing.name || `Ingrédient ${i + 1}`}</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{Math.round(ing.grams * ratio)}g</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Meal type selector */}
          <div style={{ marginBottom: '14px' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, margin: '0 0 10px', color: 'var(--text-primary)' }}>Repas</p>
            <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
              {MEAL_IDS.map(m => (
                <button key={m} onClick={() => setMealType(m)} style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-xl)', fontSize: 'var(--font-size-xs)', cursor: 'pointer', fontWeight: 500,
                  border: mealType === m ? 'none' : '1px solid var(--border-color)',
                  background: mealType === m ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                  color: mealType === m ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}>
                  {t(`journal.meals.${m}`)}
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button onClick={handleLog} disabled={logging} style={{
            width: '100%', padding: '16px',
            background: logging ? 'var(--bg-tertiary)' : 'var(--accent-blue)',
            color: logging ? 'var(--text-secondary)' : 'white',
            border: 'none', borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--font-size-base)', fontWeight: 700,
            cursor: logging ? 'not-allowed' : 'pointer',
            boxShadow: logging ? 'none' : '0 4px 14px rgba(99,102,241,0.3)',
          }}>
            {logging ? 'Ajout en cours...' : `Ajouter au ${t(`journal.meals.${mealType}`)} · ${computed.kcal} kcal`}
          </button>
        </div>
      </div>
    </div>
  );
}
