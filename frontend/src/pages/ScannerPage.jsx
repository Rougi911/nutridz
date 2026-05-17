import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import BarcodeScanner from '../components/BarcodeScanner';
import { useTranslation } from '../i18n';

const SCORE_STYLES = {
  A: { bg: '#EAF3DE', color: '#3B6D11' }, B: { bg: '#E1F5EE', color: '#0F6E56' },
  C: { bg: '#FAEEDA', color: '#854F0B' }, D: { bg: '#FAECE7', color: '#993C1D' },
};

const PHASES = {
  SCAN: 'scan', LOADING: 'loading', FOUND: 'found',
  NOTFOUND: 'notfound', ERROR: 'error',
  OCR_PROCESSING: 'ocr_processing', OCR_RESULT: 'ocr_result',
};

const EMPTY_FORM = { name: '', brand: '', kcal_per100: 0, glucides: 0, proteines: 0, lipides: 0, fibres: 0, sel: 0 };

export default function ScannerPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(PHASES.SCAN);
  const [result, setResult] = useState(null);
  const [lastCode, setLastCode] = useState(null);
  const [camError, setCamError] = useState(null);
  const [ocrForm, setOcrForm] = useState(EMPTY_FORM);
  const [ocrSaving, setOcrSaving] = useState(false);
  const ocrInputRef = useRef(null);
  const { t } = useTranslation();

  const handleDetected = useCallback(async (code) => {
    setLastCode(code);
    setPhase(PHASES.LOADING);
    try {
      const { data } = await api.get(`/scanner/barcode/${code}`);
      setResult(data);
      setPhase(data.found ? PHASES.FOUND : PHASES.NOTFOUND);
    } catch {
      toast.error(t('scanner.error.network'));
      setPhase(PHASES.ERROR);
    }
  }, [t]);

  const handleCamError = useCallback((msg) => {
    setCamError(msg);
    setPhase(PHASES.ERROR);
  }, []);

  const handleOcrFile = async (file) => {
    if (!file?.type.startsWith('image/')) { toast.error(t('common.error')); return; }
    setPhase(PHASES.OCR_PROCESSING);
    try {
      const fd = new FormData();
      fd.append('image', file);
      if (lastCode) fd.append('barcode', lastCode);
      const { data } = await api.post('/scanner/ocr', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      if (data.found && data.product) {
        // OCR a extrait assez pour sauvegarder automatiquement
        setResult({ ...result, product: data.product, source: 'ocr_tesseract' });
        setPhase(PHASES.FOUND);
      } else {
        // Données partielles → formulaire pré-rempli
        const p = data.partial_data || data.raw_ocr || {};
        setOcrForm({
          name:        p.name        || '',
          brand:       p.brand       || '',
          kcal_per100: p.kcal_per100 || 0,
          glucides:    p.glucides    || 0,
          proteines:   p.proteines   || 0,
          lipides:     p.lipides     || 0,
          fibres:      p.fibres      || 0,
          sel:         p.sel         || 0,
        });
        setPhase(PHASES.OCR_RESULT);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
      setPhase(PHASES.NOTFOUND);
    }
  };

  const saveOcrProduct = async () => {
    if (!ocrForm.name?.trim() || !ocrForm.kcal_per100) {
      toast.error('Nom et calories obligatoires');
      return;
    }
    setOcrSaving(true);
    try {
      const { data } = await api.post('/scanner/save', { ...ocrForm, barcode: lastCode || null });
      setResult({ product: data.product, source: 'ocr_tesseract' });
      setPhase(PHASES.FOUND);
      toast.success('Produit sauvegardé !');
    } catch {
      toast.error(t('common.error'));
    } finally {
      setOcrSaving(false);
    }
  };

  const reset = () => {
    setResult(null); setLastCode(null); setCamError(null);
    setOcrForm(EMPTY_FORM); setOcrSaving(false);
    setPhase(PHASES.SCAN);
  };

  const subtitleMap = {
    [PHASES.SCAN]:           t('scanner.subtitles.scan'),
    [PHASES.LOADING]:        t('scanner.subtitles.loading') + lastCode,
    [PHASES.FOUND]:          t('scanner.subtitles.found'),
    [PHASES.NOTFOUND]:       t('scanner.subtitles.notfound'),
    [PHASES.OCR_PROCESSING]: 'Lecture de l\'étiquette nutritionnelle...',
    [PHASES.OCR_RESULT]:     'Vérifiez et complétez les valeurs extraites',
    [PHASES.ERROR]:          '',
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#f7f7f5' }}>
      <div style={{ background: '#1A6B3C', color: 'white', padding: '1rem 1.25rem 1.5rem', borderRadius: '0 0 24px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>{t('scanner.title')}</h1>
        <p style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{subtitleMap[phase]}</p>
      </div>

      <div style={{ padding: '1rem 1.25rem' }}>

        {/* ── Caméra ── */}
        {phase === PHASES.SCAN && (
          <BarcodeScanner onDetected={handleDetected} onError={handleCamError} />
        )}

        {/* ── Recherche produit ── */}
        {phase === PHASES.LOADING && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: 48 }}>🔍</div>
            <p style={{ marginTop: 12, color: '#555', fontWeight: 500 }}>{t('scanner.searching')}</p>
            <p style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{lastCode}</p>
          </div>
        )}

        {/* ── Produit trouvé ── */}
        {phase === PHASES.FOUND && result?.product && (
          <ProductCard product={result.product} source={result.source} t={t}
            onDetails={() => navigate(`/products/${result.product.id}`)} onReset={reset} />
        )}

        {/* ── Produit inconnu ── */}
        {phase === PHASES.NOTFOUND && (
          <NotFoundCard
            lastCode={lastCode} result={result}
            ocrInputRef={ocrInputRef} onOcrFile={handleOcrFile}
            onReset={reset} t={t}
          />
        )}

        {/* ── OCR en cours ── */}
        {phase === PHASES.OCR_PROCESSING && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ width: 52, height: 52, border: '3px solid #1A6B3C', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <p style={{ marginTop: 18, color: '#555', fontWeight: 500, fontSize: 14 }}>Lecture OCR en cours...</p>
            <p style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>Tesseract analyse l'étiquette — jusqu'à 20 secondes</p>
            <div style={{ height: 4, background: '#f0f0ec', borderRadius: 2, marginTop: 18, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#1A6B3C', borderRadius: 2, animation: 'grow 20s ease-out forwards', transformOrigin: 'left' }} />
              <style>{`@keyframes grow{from{width:0%}to{width:90%}}`}</style>
            </div>
          </div>
        )}

        {/* ── Résultat OCR + formulaire ── */}
        {phase === PHASES.OCR_RESULT && (
          <OcrResultForm
            form={ocrForm} onChange={setOcrForm}
            onSave={saveOcrProduct}
            onRetakePhoto={() => ocrInputRef.current?.click()}
            onCancel={() => setPhase(PHASES.NOTFOUND)}
            saving={ocrSaving} t={t}
          />
        )}
        {/* Input caméra accessible depuis OCR_RESULT aussi */}
        <input ref={ocrInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) { e.target.value = ''; handleOcrFile(e.target.files[0]); } }} />

        {/* ── Erreur ── */}
        {phase === PHASES.ERROR && (
          <div style={{ background: '#fff3f0', borderRadius: 16, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>📵</div>
            <p style={{ color: '#993C1D', fontWeight: 500, marginTop: 10, fontSize: 14 }}>
              {camError || t('scanner.error.network')}
            </p>
            <button onClick={reset} style={{ ...btnStyle('#1A6B3C', '#fff'), marginTop: 16, display: 'inline-block' }}>
              {t('scanner.error.retry')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Carte "produit inconnu" ──────────────────────────────────────────────────

function NotFoundCard({ lastCode, result, ocrInputRef, onOcrFile, onReset, t }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🔎</div>
        <p style={{ fontWeight: 600, marginTop: 10, fontSize: 16 }}>{t('scanner.notfound.title')}</p>
        <p style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
          {t('scanner.notfound.codeLabel')}{result?.barcode || lastCode}
        </p>
      </div>

      {/* Explication OCR */}
      <div style={{ background: '#f7f9f8', borderRadius: 12, padding: '12px 14px', marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A6B3C', marginBottom: 6 }}>
          📷 Comment identifier ce produit ?
        </div>
        <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
          Photographiez le <strong>tableau des valeurs nutritionnelles</strong> de l'emballage. L'OCR local lira automatiquement kcal, glucides, protéines et lipides — sans connexion externe.
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {['Énergie kcal', 'Glucides g', 'Protéines g', 'Lipides g', 'Fibres g', 'Sel g'].map(l => (
            <span key={l} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EAF3DE', color: '#27500A' }}>{l}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={() => ocrInputRef.current?.click()} style={btnStyle('#1A6B3C', '#fff')}>
          {t('scanner.notfound.scanLabel')}
        </button>
        <button onClick={onReset} style={btnStyle('#f0f0ec', '#555')}>
          {t('scanner.notfound.retry')}
        </button>
      </div>
    </div>
  );
}

// ─── Formulaire OCR avec indicateurs vert / rouge ────────────────────────────

function OcrResultForm({ form, onChange, onSave, onRetakePhoto, onCancel, saving, t }) {
  const FIELDS = [
    { key: 'kcal_per100', label: 'Énergie',            unit: 'kcal' },
    { key: 'glucides',    label: t('common.glucides'),  unit: 'g'    },
    { key: 'proteines',   label: t('common.proteines'), unit: 'g'    },
    { key: 'lipides',     label: t('common.lipides'),   unit: 'g'    },
    { key: 'fibres',      label: t('common.fibres'),    unit: 'g'    },
    { key: 'sel',         label: 'Sel',                 unit: 'g'    },
  ];

  const detected = FIELDS.filter(f => form[f.key] > 0);
  const missing  = FIELDS.filter(f => !(form[f.key] > 0));
  const set = (key, val) => onChange(prev => ({ ...prev, [key]: val }));
  const pct = Math.round((detected.length / FIELDS.length) * 100);

  return (
    <div>

      {/* ── Résumé de détection ── */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '1.25rem', marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>📊 Résultat OCR Tesseract</div>

        {/* Barre de progression */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
            <span>{detected.length} / {FIELDS.length} valeurs lues</span>
            <span style={{ color: pct === 100 ? '#1A6B3C' : pct >= 50 ? '#BA7517' : '#993C1D', fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{ height: 6, background: '#f0f0ec', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#1A6B3C' : pct >= 50 ? '#BA7517' : '#993C1D', borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
        </div>

        {/* Détectés */}
        {detected.length > 0 && (
          <div style={{ marginBottom: missing.length ? 10 : 0 }}>
            <div style={{ fontSize: 11, color: '#1A6B3C', fontWeight: 600, marginBottom: 6 }}>
              ✅ Détecté automatiquement ({detected.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {detected.map(f => (
                <span key={f.key} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: '#EAF3DE', color: '#27500A', fontWeight: 500 }}>
                  {f.label} · <strong>{form[f.key]}</strong> {f.unit}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Manquants */}
        {missing.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#993C1D', fontWeight: 600, marginBottom: 6 }}>
              ❌ Non détecté — à compléter ({missing.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {missing.map(f => (
                <span key={f.key} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: '#FAECE7', color: '#993C1D', fontWeight: 500 }}>
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {pct === 100 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#EAF3DE', borderRadius: 10, padding: '8px 12px', marginTop: 10 }}>
            <span>🎉</span>
            <span style={{ fontSize: 12, color: '#27500A', fontWeight: 500 }}>Toutes les valeurs ont été lues automatiquement !</span>
          </div>
        )}

        <button onClick={onRetakePhoto} style={{ marginTop: 10, width: '100%', padding: '8px', background: 'transparent', border: '0.5px solid #1A6B3C', color: '#1A6B3C', borderRadius: 10, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
          📷 Reprendre une photo de l'étiquette
        </button>
      </div>

      {/* ── Formulaire pré-rempli ── */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>✏️ Vérifier et compléter</div>

        {/* Nom */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4,
            color: form.name?.trim() ? '#1A6B3C' : '#993C1D' }}>
            {form.name?.trim() ? '✅' : '❌'} Nom du produit *
          </label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="Ex: Couscous El Mazraa"
            style={{ width: '100%', padding: '9px 11px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box',
              border: `1px solid ${form.name?.trim() ? '#1A6B3C55' : '#993C1D66'}`,
              background: form.name?.trim() ? '#f5fbf7' : '#fff9f8' }} />
        </div>

        {/* Marque */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Marque (optionnel)</label>
          <input value={form.brand} onChange={e => set('brand', e.target.value)}
            placeholder="Ex: El Mazraa"
            style={{ width: '100%', padding: '9px 11px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', border: '0.5px solid rgba(0,0,0,0.15)' }} />
        </div>

        {/* Valeurs nutritionnelles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {FIELDS.map(({ key, label, unit }) => {
            const ok = form[key] > 0;
            return (
              <div key={key}>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4,
                  color: ok ? '#1A6B3C' : '#993C1D' }}>
                  {ok ? '✅' : '❌'} {label} ({unit})
                </label>
                <input type="number" value={form[key] || ''} min="0" step="0.1"
                  onChange={e => set(key, parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box',
                    border: `1px solid ${ok ? '#1A6B3C44' : '#993C1D44'}`,
                    background: ok ? '#f5fbf7' : '#fff9f8' }} />
              </div>
            );
          })}
        </div>

        <button onClick={onSave}
          disabled={!form.name?.trim() || !form.kcal_per100 || saving}
          style={{ width: '100%', padding: 13, marginTop: 16, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            background: form.name?.trim() && form.kcal_per100 ? '#1A6B3C' : '#ccc', color: 'white' }}>
          {saving ? '⏳ Enregistrement...' : '💾 Sauvegarder le produit'}
        </button>
        <button onClick={onCancel}
          style={{ width: '100%', padding: 10, marginTop: 8, background: 'transparent', border: '0.5px solid #ccc', color: '#555', borderRadius: 12, fontSize: 13, cursor: 'pointer' }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Carte produit trouvé ─────────────────────────────────────────────────────

function ProductCard({ product: p, source, t, onDetails, onReset }) {
  const s = SCORE_STYLES[p.score] || SCORE_STYLES.B;
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      {source === 'ocr_tesseract' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#EAF3DE', borderRadius: 10, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#27500A', fontWeight: 500 }}>
          🔍 Identifié via OCR — valeurs lues sur l'étiquette
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 48 }}>{p.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
          <div style={{ fontSize: 12, color: '#aaa' }}>{p.brand}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
            {source === 'local'        ? t('scanner.found.sourceLocal')
           : source === 'ocr_tesseract' ? '📄 OCR Tesseract'
           :                             t('scanner.found.sourceRemote')}
          </div>
        </div>
        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 14, fontWeight: 700, background: s.bg, color: s.color }}>
          {p.score}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 16 }}>
        {[
          { label: t('common.kcal'),      val: p.kcal_per100 },
          { label: t('common.glucides'),  val: p.per100?.glucides },
          { label: t('common.proteines'), val: p.per100?.proteines },
          { label: t('common.lipides'),   val: p.per100?.lipides },
        ].map(({ label, val }) => (
          <div key={label} style={{ background: '#f7f7f5', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: val > 0 ? '#1A6B3C' : '#bbb' }}>{val ?? '—'}</div>
            <div style={{ fontSize: 9, color: '#aaa', marginTop: 1 }}>{t('common.per100g')}</div>
            <div style={{ fontSize: 9, color: '#888' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onDetails} style={btnStyle('#1A6B3C', '#fff')}>{t('scanner.found.viewDetails')}</button>
        <button onClick={onReset}   style={btnStyle('#f0f0ec', '#555')}>{t('scanner.found.scanAnother')}</button>
      </div>
    </div>
  );
}

function btnStyle(bg, color) {
  return { flex: 1, padding: 10, borderRadius: 12, background: bg, color, border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 14 };
}
