import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useTranslation } from '../i18n';
import useFavoritesStore from '../store/useFavoritesStore';
import { SkeletonCard, SkeletonCircle, SkeletonLine } from '../components/Skeleton';

const DIFF_COLORS = { facile: '#1A6B3C', moyen: '#BA7517', difficile: '#993C1D' };
const DIFF_BG     = { facile: '#EAF3DE', moyen: '#FFF3DC', difficile: '#FAECE7' };

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

  useEffect(() => {
    api.get('/dishes/cuisines').then(({ data }) => setCuisines(data)).catch(() => {});
    fetchFavorites();
  }, [fetchFavorites]);

  useEffect(() => {
    const t = setTimeout(fetchDishes, 250);
    return () => clearTimeout(t);
  }, [fetchDishes]);

  return (
    <div style={{ background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ background: '#1A6B3C', color: '#fff', padding: '1rem 1.25rem 1.5rem', borderRadius: '0 0 24px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('dishes.title')}</h1>
        <p style={{ fontSize: 13, opacity: 0.8, marginTop: 3, marginBottom: 12 }}>{t('dishes.subtitle')}</p>
        <div style={{ position: 'relative' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: 16 }} />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder={t('dishes.searchPlaceholder')}
            style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10, border: 'none', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Cuisine chips */}
      <div style={{ overflowX: 'auto', display: 'flex', gap: 8, padding: '12px 16px', scrollbarWidth: 'none' }}>
        <button onClick={() => setCuisine('')} style={{
          flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          background: !cuisine ? '#1A6B3C' : '#fff', color: !cuisine ? '#fff' : '#555',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
        }}>
          {t('dishes.allCuisines')}
        </button>
        {cuisines.map(c => (
          <button key={c.cuisine} onClick={() => setCuisine(c.cuisine === cuisine ? '' : c.cuisine)} style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: cuisine === c.cuisine ? '#1A6B3C' : '#fff', color: cuisine === c.cuisine ? '#fff' : '#555',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
          }}>
            {c.flag} {c.cuisine.charAt(0).toUpperCase() + c.cuisine.slice(1)}
          </button>
        ))}
      </div>

      {/* Filtre Favoris */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0 16px 8px', justifyContent: 'center' }}>
        <button onClick={() => setFilter('all')} style={{
          padding: '0.4rem 1rem', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
          border: filter === 'all' ? '2px solid #1A6B3C' : '1px solid var(--border-color)',
          background: filter === 'all' ? '#1A6B3C' : 'var(--bg-primary)',
          color: filter === 'all' ? 'white' : 'var(--text-primary)',
        }}>Tous</button>
        <button onClick={() => setFilter('favorites')} style={{
          padding: '0.4rem 1rem', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
          border: filter === 'favorites' ? '2px solid var(--accent-yellow)' : '1px solid var(--border-color)',
          background: filter === 'favorites' ? 'var(--accent-yellow)' : 'var(--bg-primary)',
          color: filter === 'favorites' ? 'white' : 'var(--text-primary)',
        }}>⭐ Favoris ({favorites.length})</button>
      </div>

      {/* Dish list */}
      <div style={{ padding: '0 16px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i}>
                <SkeletonCircle size="56px" style={{ margin: '0 auto 0.5rem' }} />
                <SkeletonLine width="80%" style={{ margin: '0 auto' }} />
                <SkeletonLine width="50%" style={{ margin: '0.5rem auto 0' }} />
              </SkeletonCard>
            ))}
          </div>
        ) : dishes.filter(d => filter === 'favorites' ? favorites.some(f => f.dish_id === d.id) : true).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
            <p style={{ fontSize: 13, margin: 0 }}>{t('dishes.notFound')}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {dishes.filter(d => filter === 'favorites' ? favorites.some(f => f.dish_id === d.id) : true).map(dish => (
              <button key={dish.id} onClick={() => navigate(`/dishes/${dish.id}?meal=${presetMeal}`)}
                style={{ background: 'var(--bg-primary)', borderRadius: 16, padding: '14px 12px', border: 'none', cursor: 'pointer', textAlign: 'left', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: 36, marginBottom: 6 }}>{dish.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 4, lineHeight: 1.3 }}>{dish.name}</div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>{dish.flag} {dish.cuisine}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#1A6B3C' }}>{dish.kcal_per_portion} kcal</span>
                  {dish.difficulty && (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: DIFF_BG[dish.difficulty] || '#f0f0f0', color: DIFF_COLORS[dish.difficulty] || '#555', fontWeight: 600 }}>
                      {dish.difficulty}
                    </span>
                  )}
                </div>
                {dish.is_user_created === 1 && (
                  <div style={{ marginTop: 6, fontSize: 10, color: '#5B6EF5', fontWeight: 700 }}>✦ Custom</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* FAB + create dish */}
      <button onClick={() => setShowModal(true)} style={{
        position: 'fixed', bottom: 80, right: 20, width: 52, height: 52, borderRadius: 26,
        background: '#1A6B3C', color: '#fff', border: 'none', fontSize: 26, cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(26,107,60,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
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
      <div style={{ background: 'var(--bg-primary)', borderRadius: '20px 20px 0 0', padding: '20px 20px 32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('dishes.createTitle')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        {/* Emoji + Name */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2}
            style={{ width: 52, height: 44, fontSize: 26, textAlign: 'center', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, flexShrink: 0 }} />
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t('dishes.namePlaceholder')}
            style={{ flex: 1, padding: '10px 12px', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, fontSize: 13 }} />
        </div>

        {/* Cuisine selector */}
        <div style={{ display: 'flex', overflowX: 'auto', gap: 6, marginBottom: 12, scrollbarWidth: 'none', paddingBottom: 4 }}>
          {CUISINES.map(c => (
            <button key={c} onClick={() => setCuisine(c)} style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: cuisine === c ? '#1A6B3C' : '#f0f0ec', color: cuisine === c ? '#fff' : '#555'
            }}>{c}</button>
          ))}
        </div>

        {/* Description */}
        <input value={description} onChange={e => setDesc(e.target.value)} placeholder={t('dishes.descPlaceholder')}
          style={{ width: '100%', padding: '9px 12px', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }} />

        {/* Ingredient search */}
        <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>{t('dishes.ingredients')}</div>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input value={search} onChange={e => { setSearch(e.target.value); searchProducts(e.target.value); }}
            placeholder={t('dishes.ingredientSearch')}
            style={{ width: '100%', padding: '9px 12px', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, fontSize: 13, boxSizing: 'border-box' }} />
          {suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-primary)', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 10, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              {suggestions.map((p, i) => (
                <button key={i} onClick={() => addIngredient(p)}
                  style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'var(--bg-primary)', cursor: 'pointer', textAlign: 'left', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, borderBottom: '0.5px solid #f5f5f5' }}>
                  <span style={{ fontSize: 20 }}>{p.emoji || '🥘'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom_fr || p.name}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{p.kcal || p.kcal_per100 || 0} kcal/100g · <span style={{ color: p.source === 'usda' ? '#BA7517' : p.source === 'ciqual' ? '#185FA5' : '#1A6B3C' }}>{p.source || 'local'}</span></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ingredient list */}
        {ingredients.map((ing, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, background: '#f9f9f9', borderRadius: 10, padding: '8px 10px' }}>
            <span style={{ fontSize: 18 }}>{ing.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.name}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{ing.kcal_preview} kcal</div>
            </div>
            <input type="number" value={ing.grams} min={1} max={2000} onChange={e => updateGrams(idx, parseInt(e.target.value) || 0)}
              style={{ width: 60, padding: '4px 6px', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 12, textAlign: 'center' }} />
            <span style={{ fontSize: 11, color: '#aaa' }}>g</span>
            <button onClick={() => removeIngredient(idx)} style={{ background: 'none', border: 'none', color: '#cc4444', cursor: 'pointer', fontSize: 16, padding: 2 }}>✕</button>
          </div>
        ))}

        {/* Total calories */}
        {ingredients.length > 0 && (
          <div style={{ background: '#EAF3DE', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1A6B3C' }}>{Math.round(totalKcal)} kcal</div>
              <div style={{ fontSize: 11, color: '#5a8a5a' }}>pour {Math.round(totalG)}g au total</div>
            </div>
            <div style={{ fontSize: 30 }}>🍽️</div>
          </div>
        )}

        <button onClick={handleSave} disabled={saving || !name.trim() || !ingredients.length}
          style={{ width: '100%', padding: 13, background: (!name.trim() || !ingredients.length) ? '#ccc' : '#1A6B3C', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Enregistrement...' : t('dishes.create')}
        </button>
      </div>
    </div>
  );
}
