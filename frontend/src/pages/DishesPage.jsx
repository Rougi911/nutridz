import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useTranslation } from '../i18n';
import useFavoritesStore from '../store/useFavoritesStore';
import { SkeletonCard, SkeletonCircle, SkeletonLine } from '../components/Skeleton';

export default function DishesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { favorites, fetchFavorites } = useFavoritesStore();

  const [dishes, setDishes]       = useState([]);
  const [cuisines, setCuisines]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [query, setQuery]         = useState('');
  const [cuisine, setCuisine]     = useState('');
  const [filter, setFilter]       = useState('all');
  const [showModal, setShowModal] = useState(false);

  // Products mode
  const [mode, setMode]           = useState('dishes'); // 'dishes' | 'products'
  const [products, setProducts]   = useState([]);
  const [prodLoading, setProdLoading] = useState(false);

  // meal pre-selected via ?meal=dej
  const presetMeal = new URLSearchParams(location.search).get('meal') || 'dej';

  const fetchDishes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query)   params.set('q', query);
      if (cuisine) params.set('cuisine', cuisine);
      const { data } = await api.get(`/dishes?${params}`);
      setDishes(data);
    } catch { toast.error('Erreur chargement des plats'); }
    finally { setLoading(false); }
  }, [query, cuisine]);

  const fetchProducts = useCallback(async () => {
    setProdLoading(true);
    try {
      const params = query ? `?q=${encodeURIComponent(query)}` : '';
      const { data } = await api.get(`/products${params}`);
      setProducts(data);
    } catch { /* silent */ }
    finally { setProdLoading(false); }
  }, [query]);

  useEffect(() => {
    api.get('/dishes/cuisines').then(({ data }) => setCuisines(data)).catch(() => {});
    fetchFavorites();
  }, [fetchFavorites]);

  useEffect(() => {
    const t = setTimeout(fetchDishes, 250);
    return () => clearTimeout(t);
  }, [fetchDishes]);

  useEffect(() => {
    if (mode === 'products') {
      const timer = setTimeout(fetchProducts, 250);
      return () => clearTimeout(timer);
    }
  }, [mode, fetchProducts]);

  return (
    <div style={{ background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '32px' }}>
      {/* Header */}
      <div className="gradient-hero" style={{ color: '#fff', padding: '1.25rem 1.25rem 1.5rem', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 500, margin: 0 }}>Base de données</h1>
        <p style={{ fontSize: 'var(--font-size-sm)', opacity: 0.8, marginTop: '3px', marginBottom: '12px' }}>{t('dishes.subtitle')}</p>
        <div style={{ position: 'relative' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-base)' }} />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder={t('dishes.searchPlaceholder')}
            style={{ width: '100%', padding: '11px 12px 11px 40px', borderRadius: 'var(--radius-md)', border: 'none', fontSize: 'var(--font-size-sm)', boxSizing: 'border-box', background: 'rgba(255,255,255,0.95)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 'var(--space-xs)', padding: '12px 16px 0' }}>
        <button onClick={() => navigate('/vision')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '9px 0', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
          <i className="ti ti-camera" style={{ fontSize: 'var(--font-size-sm)' }} /> Photo
        </button>
        <button onClick={() => navigate('/scanner')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '9px 0', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
          <i className="ti ti-barcode" style={{ fontSize: 'var(--font-size-sm)' }} /> Scanner CB
        </button>
        <button onClick={() => setShowModal(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--accent-blue)', color: 'white', fontWeight: 700, fontSize: 'var(--font-size-xs)', cursor: 'pointer' }}>
          <i className="ti ti-plus" style={{ fontSize: 'var(--font-size-sm)' }} /> Créer plat
        </button>
      </div>

      {/* Cuisine chips + Produits pill */}
      <div style={{ overflowX: 'auto', display: 'flex', gap: 'var(--space-xs)', padding: '12px 16px', scrollbarWidth: 'none' }}>
        <button onClick={() => setCuisine('')} style={{
          flexShrink: 0, padding: '6px 14px', borderRadius: 'var(--radius-xl)', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 600,
          background: !cuisine && mode === 'dishes' ? 'var(--accent-blue)' : 'var(--bg-primary)', color: !cuisine && mode === 'dishes' ? '#fff' : 'var(--text-secondary)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
        }}>
          {t('dishes.allCuisines')}
        </button>
        {cuisines.map(c => (
          <button key={c.cuisine} onClick={() => { setMode('dishes'); setCuisine(c.cuisine === cuisine ? '' : c.cuisine); }} style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: 'var(--radius-xl)', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 600,
            background: cuisine === c.cuisine && mode === 'dishes' ? 'var(--accent-blue)' : 'var(--bg-primary)', color: cuisine === c.cuisine && mode === 'dishes' ? '#fff' : 'var(--text-secondary)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
          }}>
            {c.flag} {c.cuisine.charAt(0).toUpperCase() + c.cuisine.slice(1)}
          </button>
        ))}
        <button
          className={`pill${mode === 'products' ? ' active' : ''}`}
          onClick={() => setMode(mode === 'products' ? 'dishes' : 'products')}
          style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: 'var(--radius-xl)', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 600,
            background: mode === 'products' ? 'var(--accent-blue)' : 'var(--bg-primary)', color: mode === 'products' ? '#fff' : 'var(--text-secondary)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
          }}
        >
          Produits
        </button>
      </div>

      {/* Filtre Favoris */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0 16px 8px', justifyContent: 'center' }}>
        <button onClick={() => setFilter('all')} style={{
          padding: '0.4rem 1rem', borderRadius: 'var(--radius-xl)', cursor: 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 600,
          border: filter === 'all' ? 'none' : '1px solid var(--border-color)',
          background: filter === 'all' ? 'var(--accent-blue)' : 'var(--bg-primary)',
          color: filter === 'all' ? 'white' : 'var(--text-primary)',
        }}>Tous</button>
        <button onClick={() => setFilter('favorites')} style={{
          padding: '0.4rem 1rem', borderRadius: 'var(--radius-xl)', cursor: 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 600,
          border: filter === 'favorites' ? '2px solid var(--accent-yellow)' : '1px solid var(--border-color)',
          background: filter === 'favorites' ? 'var(--accent-yellow)' : 'var(--bg-primary)',
          color: filter === 'favorites' ? 'white' : 'var(--text-primary)',
        }}>⭐ Favoris ({favorites.length})</button>
      </div>

      {/* Products grid */}
      {mode === 'products' && (
        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {prodLoading
            ? <div>Chargement…</div>
            : products.map(p => (
                <div key={p.id} className="card" style={{ cursor: 'pointer' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: '0 0 4px' }}>{p.name}</p>
                  {p.brand && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{p.brand}</p>}
                  {p.calories_per_100g != null && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', margin: '4px 0 0', fontWeight: 600 }}>{p.calories_per_100g} kcal/100g</p>
                  )}
                </div>
              ))
          }
        </div>
      )}

      {/* Dish list */}
      {mode === 'dishes' && (
        <div style={{ padding: '0 16px' }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i}>
                  <SkeletonCircle size="56px" style={{ margin: '0 auto 0.5rem' }} />
                  <SkeletonLine width="80%" style={{ margin: '0 auto' }} />
                  <SkeletonLine width="50%" style={{ margin: '0.5rem auto 0' }} />
                </SkeletonCard>
              ))}
            </div>
          ) : (() => {
            const filtered = dishes
              .filter(d => filter === 'favorites' ? favorites.some(f => f.dish_id === d.id) : true)
              .filter(d => !query || d.name.toLowerCase().includes(query.toLowerCase()));
            return filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>🍽️</div>
                <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>{t('dishes.notFound')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {filtered.map(dish => (
                  <button key={dish.id} onClick={() => navigate(`/dishes/${dish.id}?meal=${presetMeal}`)}
                    className="card"
                    style={{ cursor: 'pointer', textAlign: 'left', position: 'relative' }}>
                    {favorites.some(f => f.dish_id === dish.id) && (
                      <span style={{ position: 'absolute', top: '8px', right: '8px', fontSize: 'var(--font-size-sm)', lineHeight: 1 }}>⭐</span>
                    )}
                    <div style={{ fontSize: 'var(--font-size-4xl)', marginBottom: '6px' }}>{dish.emoji}</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '3px', lineHeight: 1.3 }}>{dish.name}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '6px' }}>{dish.flag} {dish.cuisine}</div>
                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 500, color: 'var(--accent-blue)', marginBottom: '4px' }}>{dish.kcal_per_portion} kcal</div>
                    {(dish.proteines || dish.glucides || dish.lipides) && (
                      <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)' }}>
                        P {Math.round(dish.proteines || 0)}g · G {Math.round(dish.glucides || 0)}g · L {Math.round(dish.lipides || 0)}g
                      </div>
                    )}
                    {dish.is_user_created === 1 && (
                      <div style={{ marginTop: 'var(--space-2xs)', fontSize: 'var(--font-size-2xs)', color: 'var(--accent-blue)', fontWeight: 700 }}>✦ Custom</div>
                    )}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* FAB (fallback) */}
      <button onClick={() => setShowModal(true)} style={{
        position: 'fixed', bottom: '96px', right: '20px', width: '52px', height: '52px', borderRadius: 'var(--radius-full)',
        background: 'var(--accent-blue)', color: '#fff', border: 'none', fontSize: 'var(--font-size-2xl)', cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(99,102,241,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      }}>
        <i className="ti ti-plus" />
      </button>

      {showModal && <CreateDishModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); fetchDishes(); }} t={t} />}
    </div>
  );
}

// ─── Modal création plat custom ──────────────────────────────────────────────
function CreateDishModal({ onClose, onCreated, t }) {
  const [name, setName]           = useState('');
  const [emoji, setEmoji]         = useState('🍽️');
  const [cuisine, setCuisine]     = useState('divers');
  const [description, setDesc]    = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [search, setSearch]       = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [saving, setSaving]       = useState(false);

  const totalKcal = ingredients.reduce((s, i) => s + (i.kcal_preview || 0), 0);
  const totalG    = ingredients.reduce((s, i) => s + (i.grams || 0), 0);

  async function searchProducts(q) {
    if (!q.trim()) { setSuggestions([]); return; }
    try {
      const { data } = await api.get(`/nutrition/search?q=${encodeURIComponent(q)}`);
      setSuggestions(data.slice(0, 8));
    } catch {}
  }

  function addIngredient(item) {
    const grams = 100;
    const kcalPer100 = item.kcal || item.kcal_per100 || 0;
    setIngredients(prev => [...prev, {
      product_id: item.product_id || null,
      name: item.nom_fr || item.name,
      emoji: item.emoji || '🥘',
      grams,
      kcal_per100: kcalPer100,
      glucides:    item.glucides   || 0,
      proteines:   item.proteines  || 0,
      lipides:     item.lipides    || 0,
      fibres:      item.fibres     || 0,
      kcal_preview: Math.round(kcalPer100 * grams / 100),
      source: item.source || 'local',
    }]);
    setSearch(''); setSuggestions([]);
  }

  function updateGrams(idx, grams) {
    setIngredients(prev => prev.map((ing, i) => i !== idx ? ing : {
      ...ing, grams,
      kcal_preview: Math.round(ing.kcal_per100 * grams / 100),
    }));
  }

  function removeIngredient(idx) {
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Nom requis'); return; }
    if (!ingredients.length) { toast.error('Ajoutez au moins un ingrédient'); return; }
    setSaving(true);
    try {
      await api.post('/dishes', { name, emoji, cuisine, description, ingredients: ingredients.map(i => ({ product_id: i.product_id || null, grams: i.grams, name: i.name, kcal_per100: i.kcal_per100, glucides: i.glucides, proteines: i.proteines, lipides: i.lipides, fibres: i.fibres })) });
      toast.success('Plat créé !');
      onCreated();
    } catch { toast.error('Erreur lors de la création'); }
    finally { setSaving(false); }
  }

  const CUISINES = ['française','italienne','maghrébine','moyen-orient','asiatique','américaine','turque','indienne','mexicaine','japonaise','divers'];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', padding: '20px 20px 32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700 }}>{t('dishes.createTitle')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 'var(--font-size-xl)', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
        </div>

        {/* Emoji + Name */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
          <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2}
            style={{ width: '52px', height: '44px', fontSize: 'var(--font-size-2xl)', textAlign: 'center', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t('dishes.namePlaceholder')}
            style={{ flex: 1, padding: '10px 12px', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }} />
        </div>

        {/* Cuisine selector */}
        <div style={{ display: 'flex', overflowX: 'auto', gap: '6px', marginBottom: '12px', scrollbarWidth: 'none', paddingBottom: 'var(--space-2xs)' }}>
          {CUISINES.map(c => (
            <button key={c} onClick={() => setCuisine(c)} style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: 'var(--radius-xl)', border: 'none', fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer',
              background: cuisine === c ? 'var(--accent-green)' : 'var(--bg-tertiary)', color: cuisine === c ? '#fff' : 'var(--text-secondary)'
            }}>{c}</button>
          ))}
        </div>

        {/* Description */}
        <input value={description} onChange={e => setDesc(e.target.value)} placeholder={t('dishes.descPlaceholder')}
          style={{ width: '100%', padding: '9px 12px', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', marginBottom: '14px', boxSizing: 'border-box' }} />

        {/* Ingredient search */}
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-xs)' }}>{t('dishes.ingredients')}</div>
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <input value={search} onChange={e => { setSearch(e.target.value); searchProducts(e.target.value); }}
            placeholder={t('dishes.ingredientSearch')}
            style={{ width: '100%', padding: '9px 12px', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', boxSizing: 'border-box' }} />
          {suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-primary)', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              {suggestions.map((p, i) => (
                <button key={i} onClick={() => addIngredient(p)}
                  style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'var(--bg-primary)', cursor: 'pointer', textAlign: 'left', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '0.5px solid var(--border-color)' }}>
                  <span style={{ fontSize: 'var(--font-size-xl)' }}>{p.emoji || '🥘'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom_fr || p.name}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{p.kcal || p.kcal_per100 || 0} kcal/100g · <span style={{ color: p.source === 'usda' ? '#BA7517' : p.source === 'ciqual' ? '#185FA5' : 'var(--accent-green)' }}>{p.source || 'local'}</span></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ingredient list */}
        {ingredients.map((ing, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}>
            <span style={{ fontSize: 'var(--font-size-lg)' }}>{ing.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.name}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{ing.kcal_preview} kcal</div>
            </div>
            <input type="number" value={ing.grams} min={1} max={2000} onChange={e => updateGrams(idx, parseInt(e.target.value) || 0)}
              style={{ width: '60px', padding: '4px 6px', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', textAlign: 'center' }} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>g</span>
            <button onClick={() => removeIngredient(idx)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 'var(--font-size-base)', padding: '2px' }}>✕</button>
          </div>
        ))}

        {/* Total calories */}
        {ingredients.length > 0 && (
          <div style={{ background: 'var(--color-success-bg)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--accent-green)' }}>{Math.round(totalKcal)} kcal</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: '#5a8a5a' }}>pour {Math.round(totalG)}g au total</div>
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)' }}>🍽️</div>
          </div>
        )}

        <button onClick={handleSave} disabled={saving || !name.trim() || !ingredients.length}
          style={{ width: '100%', padding: '13px', background: (!name.trim() || !ingredients.length) ? '#ccc' : 'var(--accent-green)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Enregistrement...' : t('dishes.create')}
        </button>
      </div>
    </div>
  );
}
