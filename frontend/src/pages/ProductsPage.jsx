import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProductsStore } from '../store';
import { useTranslation } from '../i18n';

const SCORE_STYLES = {
  A: { bg: '#EAF3DE', color: '#3B6D11' }, B: { bg: '#E1F5EE', color: '#0F6E56' },
  C: { bg: '#FAEEDA', color: '#854F0B' }, D: { bg: '#FAECE7', color: '#993C1D' }
};

const CATEGORY_IDS = ['', 'cereales', 'laitiers', 'proteines', 'legumineuses', 'biscuits', 'boissons', 'snacks', 'sucres', 'matieres_grasses'];

export default function ProductsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mealTarget = searchParams.get('meal');
  const { products, loading, fetchProducts } = useProductsStore();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const { t } = useTranslation();

  useEffect(() => { fetchProducts(q, category); }, [q, category]);

  const CATEGORIES = CATEGORY_IDS.map(id => ({ id, label: t(`products.categories.${id || 'all'}`) }));

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#1A6B3C', color: 'white', padding: '1rem 1.25rem 1.5rem', borderRadius: '0 0 24px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>{t('products.title')}</h1>
        {mealTarget && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{t('products.chooseProduct')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '8px 12px', marginTop: 12 }}>
          <i className="ti ti-search" style={{ fontSize: 16, opacity: 0.7 }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('products.searchPlaceholder')}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 14, flex: 1 }} />
          {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>}
        </div>
      </div>

      {/* Catégories */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 1.25rem 4px', scrollbarWidth: 'none' }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, whiteSpace: 'nowrap',
            border: '0.5px solid', cursor: 'pointer', transition: 'all 0.15s',
            background: category === c.id ? '#1A6B3C' : '#fff',
            borderColor: category === c.id ? '#1A6B3C' : 'rgba(0,0,0,0.12)',
            color: category === c.id ? '#fff' : '#555'
          }}>{c.label}</button>
        ))}
      </div>

      {/* Grille produits */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, padding: '0.8rem 1.25rem' }}>
        {loading && [1,2,3,4].map(i => (
          <div key={i} style={{ background: '#f0f0ec', borderRadius: 12, height: 120, animation: 'pulse 1.5s infinite' }} />
        ))}
        {!loading && products.map(p => {
          const scoreStyle = SCORE_STYLES[p.score] || SCORE_STYLES.B;
          return (
            <div key={p.id} onClick={() => navigate(`/products/${p.id}${mealTarget ? `?meal=${mealTarget}` : ''}`)}
              style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 12, cursor: 'pointer', transition: 'transform 0.1s' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{p.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{p.brand}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{p.kcal_per100} {t('common.kcal')}/100g</div>
              <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: scoreStyle.bg, color: scoreStyle.color }}>
                {p.score}
              </span>
            </div>
          );
        })}
        {!loading && products.length === 0 && (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: 14 }}>
            {t('products.notFound')}
          </div>
        )}
      </div>
    </div>
  );
}
