import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useProductsStore, useJournalStore, useProfileStore } from '../store';
import { calcWalkTime } from '../utils/api';

const SCORE_COLORS = { A: 'var(--accent-green)', B: '#0F6E56', C: '#BA7517', D: 'var(--accent-red)' };
const SPORTS = { marche: { label: 'Marche', met: 3.5, emoji: '🚶' }, velo: { label: 'Vélo', met: 6.0, emoji: '🚴' }, course: { label: 'Course', met: 9.0, emoji: '🏃' }, natation: { label: 'Natation', met: 7.0, emoji: '🏊' } };

export default function ProductDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const mealTarget = searchParams.get('meal');
  const navigate = useNavigate();
  const { fetchProduct, selectedProduct: product, loading } = useProductsStore();
  const { addEntry } = useJournalStore();
  const { profile } = useProfileStore();
  const [grams, setGrams] = useState(100);
  const [adding, setAdding] = useState(false);

  useEffect(() => { fetchProduct(id); }, [id]);

  if (!product) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>Chargement...</div>;

  const ratio = grams / 100;
  const kcal = Math.round(product.kcal_per100 * ratio);
  const target = profile.target_kcal || 2310;
  const pct = Math.round(kcal / target * 100);

  const NUT_KEYS = [
    { key: 'glucides', label: 'Glucides', color: '#BA7517', max: 100 },
    { key: 'proteines', label: 'Protéines', color: '#185FA5', max: 50 },
    { key: 'lipides', label: 'Lipides', color: '#993C1D', max: 40 },
    { key: 'fibres', label: 'Fibres', color: 'var(--accent-green)', max: 15 }
  ];

  const handleAdd = async () => {
    const meal = mealTarget || (new Date().getHours() < 10 ? 'pdej' : new Date().getHours() < 14 ? 'dej' : new Date().getHours() < 17 ? 'coll' : 'diner');
    setAdding(true);
    try {
      await addEntry(product.id, grams, meal);
      toast.success(`Ajouté au journal !`);
      navigate('/journal');
    } catch {
      toast.error('Erreur lors de l\'ajout');
    } finally { setAdding(false); }
  };

  return (
    <div>
      {/* Back */}
      <div style={{ padding: 'var(--space-tight) 1.25rem 0' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-green)', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2xs)' }}>
          <i className="ti ti-arrow-left" /> Retour
        </button>
      </div>

      {/* Header produit */}
      <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 'var(--space-card)' }}>
        <div style={{ fontSize: '56px' }}>{product.emoji}</div>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 500 }}>{product.name}</h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>{product.brand}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginTop: 'var(--space-xs)' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: SCORE_COLORS[product.score], display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
              {product.score}
            </div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{product.comment}</span>
          </div>
        </div>
      </div>

      {/* Portion slider */}
      <div style={{ margin: '0 1.25rem', background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--space-tight) var(--space-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', flex: 1 }}>
            <i className="ti ti-scale" style={{ marginRight: 'var(--space-2xs)' }} />Portion
          </label>
          <input type="range" min="10" max="500" step="5" value={grams} onChange={e => setGrams(parseInt(e.target.value))} style={{ flex: 2 }} />
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, minWidth: '40px', textAlign: 'right' }}>{grams}g</span>
        </div>
      </div>

      {/* Calories banner */}
      <div style={{ margin: '10px 1.25rem 0', background: 'var(--color-success-bg)', border: '0.5px solid rgba(0,0,0,0.06)', borderRadius: 'var(--radius-md)', padding: 'var(--space-tight) var(--space-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 500, color: 'var(--accent-green)' }}>{kcal} kcal</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>pour {grams}g · cible {target} kcal/j</div>
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, padding: '3px 9px', borderRadius: 'var(--radius-xl)', background: pct < 10 ? 'var(--color-success-bg)' : pct < 25 ? 'var(--color-warning-bg)' : 'var(--color-danger-bg)', color: pct < 10 ? 'var(--accent-green)' : pct < 25 ? '#854F0B' : 'var(--accent-red)' }}>
            {pct}% de l'objectif
          </span>
        </div>
      </div>

      {/* Effort physique */}
      <div style={{ margin: '10px 1.25rem 0', background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-xs) var(--space-card)', borderBottom: '0.5px solid var(--border-color)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Temps pour brûler ces calories</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
          {Object.entries(SPORTS).map(([key, sport], i) => {
            const mins = calcWalkTime(kcal, key, profile.weight || 70);
            const isActive = key === (profile.sport || 'marche');
            return (
              <div key={key} style={{ padding: '10px', textAlign: 'center', background: isActive ? 'var(--color-success-bg)' : 'transparent', borderRight: i % 2 === 0 ? '0.5px solid var(--border-color)' : 'none', borderTop: i > 1 ? '0.5px solid var(--border-color)' : 'none' }}>
                <div style={{ fontSize: 'var(--icon-sm)', marginBottom: '2px' }}>{sport.emoji}</div>
                <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 500 }}>{mins} min</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{sport.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Valeurs nutritionnelles */}
      <div style={{ margin: '10px 1.25rem 0', background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--space-tight) var(--space-card)' }}>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '10px' }}>Valeurs nutritionnelles pour {grams}g</div>
        {NUT_KEYS.map(({ key, label, color, max }) => {
          const val = (product.per100[key] * ratio).toFixed(1);
          const barPct = Math.min(100, Math.round(product.per100[key] * ratio / max * 100));
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', width: '80px', flexShrink: 0 }}>{label}</span>
              <div style={{ flex: 1, height: '6px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-2xs)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barPct}%`, background: color, borderRadius: 'var(--radius-2xs)', transition: 'width 0.35s' }} />
              </div>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, minWidth: '40px', textAlign: 'right' }}>{val}g</span>
            </div>
          );
        })}
      </div>

      {/* Additifs */}
      <div style={{ margin: '10px 1.25rem 0', background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--space-tight) var(--space-card)' }}>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}>Additifs</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2xs)' }}>
          {(product.additifs || []).map((a, i) => (
            <span key={i} style={{ fontSize: 'var(--font-size-xs)', padding: '3px 8px', borderRadius: 'var(--radius-xl)', background: a.type === 'ok' ? 'var(--color-success-bg)' : a.type === 'warn' ? 'var(--color-warning-bg)' : 'var(--color-danger-bg)', color: a.type === 'ok' ? '#3B6D11' : a.type === 'warn' ? '#854F0B' : '#993C1D' }}>
              {a.name}
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '1rem 1.25rem' }}>
        <button onClick={handleAdd} disabled={adding} style={{ width: '100%', padding: 'var(--space-tight)', background: 'var(--accent-green)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-xs)', opacity: adding ? 0.7 : 1 }}>
          <i className="ti ti-notebook" />
          {adding ? 'Ajout...' : `Ajouter au journal (${grams}g · ${kcal} kcal)`}
        </button>
      </div>
    </div>
  );
}
