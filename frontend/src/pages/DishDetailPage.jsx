import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useTranslation } from '../i18n';

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

  useEffect(() => {
    api.get(`/dishes/${id}`)
      .then(res => {
        setDish(res.data);
        setPortion(res.data.default_portion_g || 300);
      })
      .catch(() => { toast.error('Plat non trouvé'); navigate('/dishes'); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#888', fontSize: 14 }}>
      {t('common.loading')}
    </div>
  );
  if (!dish) return null;

  const defaultPortion = dish.default_portion_g || 300;
  const ratio = portion / defaultPortion;
  const kcal      = Math.round(dish.kcal_per_portion * ratio);
  const glucides  = Math.round(dish.glucides  * ratio * 10) / 10;
  const proteines = Math.round(dish.proteines * ratio * 10) / 10;
  const lipides   = Math.round(dish.lipides   * ratio * 10) / 10;
  const fibres    = Math.round(dish.fibres    * ratio * 10) / 10;

  const dishName = lang === 'ar' && dish.name_ar ? dish.name_ar
    : lang === 'en' && dish.name_en ? dish.name_en
    : dish.name;

  const diff = DIFF_STYLE[dish.difficulty] || DIFF_STYLE.moyen;

  const handleLog = async () => {
    setLogging(true);
    try {
      await api.post(`/dishes/${id}/log`, { meal_type: mealType, portion_g: portion });
      toast.success(`${dishName} ajouté — ${kcal} kcal`);
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
        <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 14, marginBottom: 12 }}>
          ‹ Retour
        </button>
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

        {/* Calories card */}
        <div style={{ background: '#1A6B3C', color: 'white', borderRadius: 12, padding: '16px 20px', marginBottom: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{kcal} <span style={{ fontSize: 16, opacity: 0.8 }}>kcal</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 12 }}>
            {[['Glucides', glucides], ['Protéines', proteines], ['Lipides', lipides]].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{val}g</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          {fibres > 0 && (
            <div style={{ fontSize: 11, opacity: 0.65, marginTop: 8 }}>Fibres : {fibres}g</div>
          )}
        </div>

        {/* Ingredients */}
        {dish.ingredients?.length > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px', color: '#333' }}>{t('dishes.ingredients')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {dish.ingredients.map((ing, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: '#444' }}>{ing.name || `Ingrédient ${i + 1}`}</span>
                  <span style={{ color: '#888', fontWeight: 500 }}>{Math.round(ing.grams * ratio)}g</span>
                </div>
              ))}
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
          {logging ? 'Ajout en cours...' : `📓 ${t('dishes.addToJournal')} — ${kcal} kcal`}
        </button>
      </div>
    </div>
  );
}
