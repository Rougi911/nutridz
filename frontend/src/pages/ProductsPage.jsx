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
      <div style={{ background: 'var(--accent-green)', color: 'white', padding: '1rem 1.25rem 1.5rem', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 500 }}>{t('products.title')}</h1>
        {mealTarget && <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8, marginTop: '2px' }}>{t('products.chooseProduct')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--radius-md)', padding: 'var(--space-xs) var(--space-tight)', marginTop: 'var(--space-tight)' }}>
          <i className="ti ti-search" style={{ fontSize: 'var(--space-card)', opacity: 0.7 }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('products.searchPlaceholder')}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 'var(--font-size-sm)', flex: 1 }} />
          {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>}
        </div>
      </div>

      {/* Catégories */}
      <div style={{ display: 'flex', gap: 'var(--space-xs)', overflowX: 'auto', padding: 'var(--space-tight) 1.25rem var(--space-2xs)', scrollbarWidth: 'none' }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)} style={{
            padding: '5px 12px', borderRadius: 'var(--radius-xl)', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap',
            border: '0.5px solid', cursor: 'pointer', transition: 'all 0.15s',
            background: category === c.id ? 'var(--accent-green)' : 'var(--bg-primary)',
            borderColor: category === c.id ? 'var(--accent-green)' : 'rgba(0,0,0,0.12)',
            color: category === c.id ? '#fff' : 'var(--text-secondary)'
          }}>{c.label}</button>
        ))}
      </div>

      {/* Grille produits */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '0.8rem 1.25rem' }}>
        {loading && [1,2,3,4].map(i => (
          <div key={i} style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', height: '120px', animation: 'pulse 1.5s infinite' }} />
        ))}
        {!loading && products.map(p => {
          const scoreStyle = SCORE_STYLES[p.score] || SCORE_STYLES.B;
          return (
            <div key={p.id} onClick={() => navigate(`/products/${p.id}${mealTarget ? `?meal=${mealTarget}` : ''}`)}
              style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--space-tight)', cursor: 'pointer', transition: 'transform 0.1s' }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-xs)' }}>{p.emoji}</div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>{p.brand}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '3px' }}>{p.kcal_per100} {t('common.kcal')}/100g</div>
              <span style={{ display: 'inline-block', marginTop: 'var(--space-xs)', fontSize: 'var(--font-size-xs)', fontWeight: 500, padding: '2px 7px', borderRadius: 'var(--radius-xl)', background: scoreStyle.bg, color: scoreStyle.color }}>
                {p.score}
              </span>
            </div>
          );
        })}
        {!loading && products.length === 0 && (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
            {t('products.notFound')}
          </div>
        )}
      </div>
    </div>
  );
}
