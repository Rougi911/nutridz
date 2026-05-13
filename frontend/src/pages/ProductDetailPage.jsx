import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useProductsStore, useJournalStore, useProfileStore } from '../store';
import { calcWalkTime } from '../utils/api';

const SCORE_COLORS = { A: '#1A6B3C', B: '#0F6E56', C: '#BA7517', D: '#993C1D' };
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

  if (!product) return <div style={{ padding: '2rem', textAlign: 'center', color: '#aaa' }}>Chargement...</div>;

  const ratio = grams / 100;
  const kcal = Math.round(product.kcal_per100 * ratio);
  const target = profile.target_kcal || 2310;
  const pct = Math.round(kcal / target * 100);

  const NUT_KEYS = [
    { key: 'glucides', label: 'Glucides', color: '#BA7517', max: 100 },
    { key: 'proteines', label: 'Protéines', color: '#185FA5', max: 50 },
    { key: 'lipides', label: 'Lipides', color: '#993C1D', max: 40 },
    { key: 'fibres', label: 'Fibres', color: '#1A6B3C', max: 15 }
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
      <div style={{ padding: '12px 1.25rem 0' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A6B3C', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
          <i className="ti ti-arrow-left" /> Retour
        </button>
      </div>

      {/* Header produit */}
      <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 56 }}>{product.emoji}</div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 500 }}>{product.name}</h2>
          <p style={{ fontSize: 14, color: '#888', marginTop: 2 }}>{product.brand}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: SCORE_COLORS[product.score], display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 500 }}>
              {product.score}
            </div>
            <span style={{ fontSize: 13, color: '#555' }}>{product.comment}</span>
          </div>
        </div>
      </div>

      {/* Portion slider */}
      <div style={{ margin: '0 1.25rem', background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 13, color: '#888', flex: 1 }}>
            <i className="ti ti-scale" style={{ marginRight: 4 }} />Portion
          </label>
          <input type="range" min="10" max="500" step="5" value={grams} onChange={e => setGrams(parseInt(e.target.value))} style={{ flex: 2 }} />
          <span style={{ fontSize: 13, fontWeight: 500, minWidth: 40, textAlign: 'right' }}>{grams}g</span>
        </div>
      </div>

      {/* Calories banner */}
      <div style={{ margin: '10px 1.25rem 0', background: '#f5f9f5', border: '0.5px solid rgba(0,0,0,0.06)', borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 500, color: '#1A6B3C' }}>{kcal} kcal</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>pour {grams}g · cible {target} kcal/j</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: pct < 10 ? '#EAF3DE' : pct < 25 ? '#FAEEDA' : '#FAECE7', color: pct < 10 ? '#3B6D11' : pct < 25 ? '#854F0B' : '#993C1D' }}>
            {pct}% de l'objectif
          </span>
        </div>
      </div>

      {/* Effort physique */}
      <div style={{ margin: '10px 1.25rem 0', background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '8px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', fontSize: 12, color: '#888' }}>Temps pour brûler ces calories</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
          {Object.entries(SPORTS).map(([key, sport], i) => {
            const mins = calcWalkTime(kcal, key, profile.weight || 70);
            const isActive = key === (profile.sport || 'marche');
            return (
              <div key={key} style={{ padding: '10px', textAlign: 'center', background: isActive ? '#EAF3DE' : 'transparent', borderRight: i % 2 === 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', borderTop: i > 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none' }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>{sport.emoji}</div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{mins} min</div>
                <div style={{ fontSize: 11, color: '#888' }}>{sport.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Valeurs nutritionnelles */}
      <div style={{ margin: '10px 1.25rem 0', background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Valeurs nutritionnelles pour {grams}g</div>
        {NUT_KEYS.map(({ key, label, color, max }) => {
          const val = (product.per100[key] * ratio).toFixed(1);
          const barPct = Math.min(100, Math.round(product.per100[key] * ratio / max * 100));
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#888', width: 80, flexShrink: 0 }}>{label}</span>
              <div style={{ flex: 1, height: 6, background: '#f0f0ec', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barPct}%`, background: color, borderRadius: 3, transition: 'width 0.35s' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, minWidth: 40, textAlign: 'right' }}>{val}g</span>
            </div>
          );
        })}
      </div>

      {/* Additifs */}
      <div style={{ margin: '10px 1.25rem 0', background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Additifs</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {(product.additifs || []).map((a, i) => (
            <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: a.type === 'ok' ? '#EAF3DE' : a.type === 'warn' ? '#FAEEDA' : '#FAECE7', color: a.type === 'ok' ? '#3B6D11' : a.type === 'warn' ? '#854F0B' : '#993C1D' }}>
              {a.name}
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '1rem 1.25rem' }}>
        <button onClick={handleAdd} disabled={adding} style={{ width: '100%', padding: '12px', background: '#1A6B3C', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: adding ? 0.7 : 1 }}>
          <i className="ti ti-notebook" />
          {adding ? 'Ajout...' : `Ajouter au journal (${grams}g · ${kcal} kcal)`}
        </button>
      </div>
    </div>
  );
}
