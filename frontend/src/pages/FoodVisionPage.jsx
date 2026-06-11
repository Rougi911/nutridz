import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useProfileStore } from '../store';
import api from '../utils/api';
import { useTranslation } from '../i18n';

const SCORE_COLORS = { A: '#1A6B3C', B: '#0F6E56', C: '#BA7517', D: '#993C1D', E: '#993C1D' };
const SPORT_EMOJIS = { marche: '🚶', velo: '🚴', course: '🏃', natation: '🏊' };
const MEAL_EMOJIS = { pdej: '☕', dej: '🍽️', coll: '🍎', diner: '🌙' };
const STATES = { IDLE: 'idle', ANALYZING: 'analyzing', RESULT: 'result', REFINING: 'refining' };

export default function FoodVisionPage() {
  const navigate = useNavigate();
  const { profile } = useProfileStore();
  const { t, lang } = useTranslation();
  const [state, setState] = useState(STATES.IDLE);
  const [imagePreview, setImagePreview] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisId, setAnalysisId] = useState(null);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [correction, setCorrection] = useState('');
  const [mealType, setMealType] = useState(() => {
    const h = new Date().getHours();
    return h < 10 ? 'pdej' : h < 14 ? 'dej' : h < 17 ? 'coll' : 'diner';
  });
  const [step, setStep] = useState(0);
  const fileInputRef = useRef(null);

  const analyzeSteps = t('vision.analyzeSteps');

  React.useEffect(() => {
    if (state !== STATES.ANALYZING) return;
    const iv = setInterval(() => setStep(s => (s + 1) % analyzeSteps.length), 2500);
    return () => clearInterval(iv);
  }, [state]);

  const handleFile = useCallback(async (file) => {
    if (!file?.type.startsWith('image/')) { toast.error(t('vision.errors.invalidFile')); return; }
    if (file.size > 12 * 1024 * 1024) { toast.error(t('vision.errors.tooLarge')); return; }

    setImagePreview(URL.createObjectURL(file));
    setState(STATES.ANALYZING);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('meal_type', mealType);

      const { data } = await api.post('/vision/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 35000
      });

      setAnalysis(data);
      setAnalysisId(data.id);
      setSelectedItems(new Set(data.aliments?.map((_, i) => i) || []));
      setState(STATES.RESULT);
    } catch (err) {
      const msg = err.response?.data?.error || t('vision.errors.analyzeError');
      toast.error(msg);
      setState(STATES.IDLE);
    }
  }, [mealType, t]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const sendCorrection = async () => {
    if (!correction.trim()) return;
    setState(STATES.REFINING);
    try {
      const { data } = await api.post('/vision/refine', { analysis_id: analysisId, correction });
      setAnalysis(data);
      setSelectedItems(new Set(data.aliments?.map((_, i) => i) || []));
      setCorrection('');
      setState(STATES.RESULT);
    } catch { toast.error(t('vision.errors.refineError')); setState(STATES.RESULT); }
  };

  const addToJournal = async () => {
    try {
      const { data } = await api.post('/vision/add-to-journal', {
        analysis_id: analysisId,
        meal_type: mealType,
        selected_items: Array.from(selectedItems)
      });
      toast.success(t('vision.successAdded')(data.added_count, data.total_kcal));
      navigate('/journal');
    } catch { toast.error(t('vision.errors.addError')); }
  };

  const reset = () => {
    setImagePreview(null); setAnalysis(null); setAnalysisId(null);
    setCorrection(''); setSelectedItems(new Set()); setState(STATES.IDLE);
  };

  const card = (children, style = {}) => (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: 'var(--radius-md)', ...style }}>
      {children}
    </div>
  );

  const MEALS = ['pdej', 'dej', 'coll', 'diner'].map(id => ({ id, label: t(`vision.meals.${id}`), emoji: MEAL_EMOJIS[id] }));
  const SPORTS = ['marche', 'velo', 'course', 'natation'].map(key => ({ key, label: t(`profile.activity.sports.${key}`), emoji: SPORT_EMOJIS[key] }));

  // ─── IDLE ─────────────────────────────────────────────────────────────────────
  if (state === STATES.IDLE) return (
    <div>
      <div style={{ background: 'var(--accent-green)', color: 'white', padding: '1rem 1.25rem 1.5rem', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 500 }}>{t('vision.title')}</h1>
        <p style={{ fontSize: 'var(--font-size-sm)', opacity: 0.8, marginTop: '2px' }}>{t('vision.subtitle')}</p>
      </div>

      <div style={{ padding: '1rem 1.25rem' }}>
        {/* Sélection repas */}
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '8px' }}>{t('vision.mealLabel')}</div>
        <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 16 }}>
          {MEALS.map(m => (
            <button key={m.id} onClick={() => setMealType(m.id)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 'var(--radius-md)', border: mealType === m.id ? '1.5px solid var(--accent-green)' : '0.5px solid var(--border-color)',
              background: mealType === m.id ? 'var(--color-success-bg)' : 'var(--bg-primary)', cursor: 'pointer', textAlign: 'center'
            }}>
              <div style={{ fontSize: 'var(--font-size-lg)' }}>{m.emoji}</div>
              <div style={{ fontSize: 'var(--font-size-2xs)', color: mealType === m.id ? '#27500A' : 'var(--text-secondary)', marginTop: '2px', fontWeight: mealType === m.id ? 600 : 400 }}>{m.label}</div>
            </button>
          ))}
        </div>

        {/* Zone de dépôt */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          style={{ border: '2px dashed rgba(26,107,60,0.35)', borderRadius: 'var(--radius-lg)', padding: '2rem 1rem', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-secondary)', marginBottom: 16 }}>
          <div style={{ fontSize: '44px', marginBottom: '10px' }}>📷</div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--accent-green)', marginBottom: '4px' }}>{t('vision.dropzone.title')}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{t('vision.dropzone.subtitle')}</div>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
        </div>

        {/* Conseils */}
        {card(
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: '8px' }}>{t('vision.tips.title')}</div>
            {t('vision.tips.list').map((tip, i) => (
              <div key={i} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '4px' }}>· {tip}</div>
            ))}
          </div>
        )}

        {/* Cuisines reconnues */}
        {card(
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: '8px' }}>Cuisines reconnues</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
              {[
                ['🇫🇷', 'Française'],
                ['🇮🇹', 'Italienne'],
                ['🇩🇿', 'Maghrébine'],
                ['🇹🇷', 'Turque'],
                ['🇮🇳', 'Indienne'],
                ['🇯🇵', 'Japonaise'],
                ['🇨🇳', 'Asiatique'],
                ['🇲🇽', 'Mexicaine'],
                ['🇺🇸', 'Américaine'],
                ['🇸🇦', 'Moyen-Orient'],
              ].map(([flag, label]) => (
                <span key={label} style={{ fontSize: 'var(--font-size-xs)', padding: '3px 8px', borderRadius: 'var(--radius-xl)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  {flag} {label}
                </span>
              ))}
            </div>
          </div>,
          { marginTop: '10px' }
        )}
      </div>
    </div>
  );

  // ─── ANALYZING ────────────────────────────────────────────────────────────────
  if (state === STATES.ANALYZING) return (
    <div>
      <div style={{ background: 'var(--accent-green)', color: 'white', padding: '1rem 1.25rem 1.5rem', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 500 }}>{t('vision.title')}</h1>
      </div>
      <div style={{ padding: '1rem 1.25rem' }}>
        {imagePreview && <img src={imagePreview} alt="" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: '16px' }} />}
        {card(
          <div style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ width: '44px', height: '44px', border: '3px solid var(--accent-green)', borderTopColor: 'transparent', borderRadius: 'var(--radius-full)', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '16px' }}>{analyzeSteps[step]}</div>
            <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-2xs)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--accent-green)', borderRadius: 'var(--radius-2xs)', animation: 'grow 15s ease-out forwards', transformOrigin: 'left' }} />
              <style>{`@keyframes grow{from{width:0%}to{width:85%}}`}</style>
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '10px' }}>{t('vision.analyzeDuration')}</div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── RESULT ───────────────────────────────────────────────────────────────────
  if ((state === STATES.RESULT || state === STATES.REFINING) && analysis) {
    const totaux = analysis.totaux || {};
    const aliments = analysis.aliments || [];
    const selKcal = aliments.filter((_, i) => selectedItems.has(i)).reduce((s, a) => s + (a.kcal || 0), 0);
    const confColor = analysis.confiance === 'haute' ? 'var(--accent-green)' : analysis.confiance === 'moyenne' ? '#BA7517' : '#993C1D';
    const mp = analysis.macros_pct || {};
    const rv = t('vision.result');

    return (
      <div>
        {imagePreview && (
          <div style={{ position: 'relative' }}>
            <img src={imagePreview} alt="" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 14px', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
              <div style={{ color: 'white', fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
                {lang === 'ar' && analysis.plat_identifie_ar ? analysis.plat_identifie_ar : analysis.plat_identifie}
              </div>
              <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 'var(--radius-xl)', background: confColor + '44', color: confColor, fontWeight: 600 }}>
                {analysis.confiance === 'haute' ? '✅' : analysis.confiance === 'moyenne' ? '⚠️' : '❓'} {rv.confidence} {analysis.confiance} {analysis.incertitude_pct ? `(±${analysis.incertitude_pct}%)` : ''}
              </span>
            </div>
          </div>
        )}

        <div style={{ padding: '1rem 1.25rem' }}>
          {/* Calories */}
          <div style={{ background: 'var(--color-success-bg)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--accent-green)' }}>{totaux.kcal} {t('common.kcal')}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: '#3B6D11', marginTop: '2px' }}>{rv.range} {totaux.kcal_min}–{totaux.kcal_max} {t('common.kcal')}</div>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-full)', background: SCORE_COLORS[analysis.score_nutritionnel] || '#BA7517', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
              {analysis.score_nutritionnel}
            </div>
          </div>

          {/* Macros */}
          {card(
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '0.5px solid var(--border-color)' }}>
                {[['glucides','#BA7517'],['proteines','#185FA5'],['lipides','#993C1D'],['fibres','var(--accent-green)']].map(([k, c]) => (
                  <div key={k} style={{ padding: '10px 8px', textAlign: 'center', borderRight: '0.5px solid var(--border-color)' }}>
                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: c }}>{totaux[k]}g</div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', marginTop: '1px' }}>{t(`common.${k}`)}</div>
                  </div>
                ))}
              </div>
              {mp.glucides !== undefined && (
                <div style={{ display: 'flex', height: '6px', margin: '8px 12px' }}>
                  <div style={{ width: `${mp.glucides}%`, background: '#BA7517', borderRadius: 'var(--radius-2xs) 0 0 var(--radius-2xs)' }} />
                  <div style={{ width: `${mp.proteines}%`, background: '#185FA5' }} />
                  <div style={{ width: `${mp.lipides}%`, background: '#993C1D', borderRadius: '0 var(--radius-2xs) var(--radius-2xs) 0' }} />
                </div>
              )}
            </>,
            { marginBottom: '10px' }
          )}

          {/* Effort physique */}
          {analysis.effort_physique && card(
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '8px' }}>{rv.effort}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2xs)' }}>
                {SPORTS.map(({ key, label, emoji }) => (
                  <div key={key} style={{ textAlign: 'center', padding: '6px 4px', background: key === (profile.sport || 'marche') ? 'var(--color-success-bg)' : 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 'var(--font-size-lg)' }}>{emoji}</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{analysis.effort_physique[key]} min</div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>,
            { marginBottom: '10px' }
          )}

          {/* Satiété */}
          {analysis.satiete && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '10px 14px', border: '0.5px solid var(--border-color)', marginBottom: 10 }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{rv.satiety}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-xl)', background: analysis.satiete.includes('Très') ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: analysis.satiete.includes('Très') ? '#27500A' : '#633806' }}>{analysis.satiete}</span>
            </div>
          )}

          {/* Aliments — titre + résumé qualité de détection */}
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: '4px' }}>{rv.detected}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '8px' }}>{rv.selectPrompt}</div>

          {/* Bandeau résumé vert / orange */}
          {aliments.length > 0 && (() => {
            const high = aliments.filter(a => (a.confiance_detection || 0) >= 80);
            const low  = aliments.filter(a => (a.confiance_detection || 0) <  80);
            return (
              <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 10 }}>
                {high.length > 0 && (
                  <span style={{ fontSize: 'var(--font-size-xs)', padding: '3px 10px', borderRadius: 'var(--radius-xl)', background: 'var(--color-success-bg)', color: '#27500A', fontWeight: 500 }}>
                    ✅ {high.length} détecté{high.length > 1 ? 's' : ''} avec certitude
                  </span>
                )}
                {low.length > 0 && (
                  <span style={{ fontSize: 'var(--font-size-xs)', padding: '3px 10px', borderRadius: 'var(--radius-xl)', background: 'var(--color-warning-bg)', color: '#633806', fontWeight: 500 }}>
                    ⚠️ {low.length} à vérifier
                  </span>
                )}
              </div>
            );
          })()}

          {/* Liste des aliments avec badge confiance */}
          {aliments.map((a, i) => {
            const conf     = a.confiance_detection || 0;
            const confHigh = conf >= 80;
            const confMid  = conf >= 60 && conf < 80;
            const confBg    = confHigh ? 'var(--color-success-bg)' : confMid ? 'var(--color-warning-bg)' : 'var(--color-danger-bg)';
            const confColor = confHigh ? '#27500A'  : confMid ? '#633806'  : '#7A1818';
            const confIcon  = confHigh ? '✅' : confMid ? '⚠️' : '❓';
            const borderCol = selectedItems.has(i) ? 'var(--accent-green)'
                            : !confHigh ? (confMid ? '#BA751733' : '#993C1D33') : 'var(--border-color)';
            const bgCol = selectedItems.has(i) ? 'var(--color-success-bg)'
                        : !confHigh ? (confMid ? '#fffdf7' : '#fff9f8') : 'var(--bg-primary)';
            return (
              <div key={i}
                onClick={() => setSelectedItems(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                style={{ borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer',
                  border: `${selectedItems.has(i) ? '1.5px' : '1px'} solid ${borderCol}`,
                  background: bgCol }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: 'var(--radius-full)', flexShrink: 0,
                      border: selectedItems.has(i) ? 'none' : '1.5px solid var(--border-color)',
                      background: selectedItems.has(i) ? 'var(--accent-green)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 'var(--font-size-xs)', color: 'white', fontWeight: 700 }}>
                      {selectedItems.has(i) ? '✓' : ''}
                    </div>
                    <span style={{ fontSize: 'var(--font-size-xl)' }}>{a.emoji}</span>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                        {a.nom}{a.nom_ar && <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}> · {a.nom_ar}</span>}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{a.quantite_g}g · {rv.range} {a.fourchette?.min}–{a.fourchette?.max}g</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-2xs)' }}>
                    <div>
                      <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>{a.kcal}</span>
                      <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-tertiary)', marginLeft: '2px' }}>{t('common.kcal')}</span>
                    </div>
                    <span style={{ fontSize: 'var(--font-size-2xs)', padding: '2px 7px', borderRadius: 'var(--radius-xl)', fontWeight: 600,
                      background: confBg, color: confColor }}>
                      {confIcon} {conf}%
                    </span>
                  </div>
                </div>
                {/* Alerte si confiance faible */}
                {conf < 60 && (
                  <div style={{ marginTop: '6px', fontSize: 'var(--font-size-xs)', color: '#993C1D', background: 'var(--color-danger-bg)', borderRadius: 'var(--radius-xs)', padding: '4px 8px' }}>
                    Détection incertaine — corrigez via le champ ci-dessous si besoin
                  </div>
                )}
              </div>
            );
          })}

          {/* Tags */}
          {analysis.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', marginBottom: '12px', marginTop: 'var(--space-2xs)' }}>
              {analysis.tags.map((tg, i) => <span key={i} style={{ fontSize: 'var(--font-size-xs)', padding: '3px 8px', borderRadius: 'var(--radius-xl)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{tg}</span>)}
            </div>
          )}

          {/* Conseil */}
          {analysis.conseil && (
            <div style={{ background: 'var(--color-success-bg)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '12px' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#27500A', marginBottom: '4px' }}>{rv.conseil}</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: '#3B6D11', lineHeight: 1.6 }}>{analysis.conseil}</div>
            </div>
          )}

          {/* Correction */}
          {card(
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: '4px' }}>{rv.correction.title}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '8px' }}>{rv.correction.hint}</div>
              <textarea value={correction} onChange={e => setCorrection(e.target.value)} placeholder={rv.correction.placeholder} rows={2}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border-color)', fontSize: 'var(--font-size-sm)', resize: 'vertical', fontFamily: 'inherit', marginBottom: '8px' }} />
              <button onClick={sendCorrection} disabled={!correction.trim() || state === STATES.REFINING}
                style={{ width: '100%', padding: '9px', background: correction.trim() ? 'var(--accent-green)' : '#ccc', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', cursor: correction.trim() ? 'pointer' : 'not-allowed' }}>
                {state === STATES.REFINING ? rv.correction.refining : rv.correction.refine}
              </button>
            </div>,
            { marginBottom: '12px' }
          )}

          {/* CTA */}
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '10px 14px', textAlign: 'center', marginBottom: 10, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {rv.selectedSummary(selectedItems.size, selKcal)}
          </div>
          <button onClick={addToJournal} disabled={!selectedItems.size} style={{ width: '100%', padding: '13px', background: selectedItems.size ? 'var(--accent-green)' : '#ccc', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 600, cursor: selectedItems.size ? 'pointer' : 'not-allowed', marginBottom: '10px' }}>
            {rv.addToJournal}
          </button>
          <button onClick={reset} style={{ width: '100%', padding: '12px', background: 'transparent', border: '0.5px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
            {rv.analyzeAnother}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
