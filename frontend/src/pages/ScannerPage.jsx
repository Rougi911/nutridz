import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import BarcodeScanner from '../components/BarcodeScanner';
import { useTranslation } from '../i18n';

const SCORE_STYLES = {
  A: { bg: '#EAF3DE', color: '#3B6D11' }, B: { bg: '#E1F5EE', color: '#0F6E56' },
  C: { bg: '#FAEEDA', color: '#854F0B' }, D: { bg: '#FAECE7', color: '#993C1D' },
};

const PHASES = { SCAN: 'scan', LOADING: 'loading', FOUND: 'found', NOTFOUND: 'notfound', ERROR: 'error' };

export default function ScannerPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(PHASES.SCAN);
  const [result, setResult] = useState(null);
  const [lastCode, setLastCode] = useState(null);
  const [camError, setCamError] = useState(null);
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

  const reset = () => {
    setResult(null); setLastCode(null); setCamError(null); setPhase(PHASES.SCAN);
  };

  const subtitles = {
    [PHASES.SCAN]:     t('scanner.subtitles.scan'),
    [PHASES.LOADING]:  t('scanner.subtitles.loading') + lastCode,
    [PHASES.FOUND]:    t('scanner.subtitles.found'),
    [PHASES.NOTFOUND]: t('scanner.subtitles.notfound'),
    [PHASES.ERROR]:    '',
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#f7f7f5' }}>
      {/* Header */}
      <div style={{ background: '#1A6B3C', color: 'white', padding: '1rem 1.25rem 1.5rem', borderRadius: '0 0 24px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>{t('scanner.title')}</h1>
        <p style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{subtitles[phase]}</p>
      </div>

      <div style={{ padding: '1rem 1.25rem' }}>

        {/* Caméra Quagga2 */}
        {phase === PHASES.SCAN && (
          <BarcodeScanner onDetected={handleDetected} onError={handleCamError} />
        )}

        {/* Recherche en cours */}
        {phase === PHASES.LOADING && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: 48 }}>🔍</div>
            <p style={{ marginTop: 12, color: '#555', fontWeight: 500 }}>{t('scanner.searching')}</p>
            <p style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{lastCode}</p>
          </div>
        )}

        {/* Produit trouvé */}
        {phase === PHASES.FOUND && result?.product && (
          <ProductCard product={result.product} source={result.source} t={t}
            onDetails={() => navigate(`/products/${result.product.id}`)} onReset={reset} />
        )}

        {/* Produit introuvable */}
        {phase === PHASES.NOTFOUND && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 48 }}>🔎</div>
            <p style={{ fontWeight: 600, marginTop: 10, fontSize: 16 }}>{t('scanner.notfound.title')}</p>
            <p style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{t('scanner.notfound.codeLabel')}{result?.barcode || lastCode}</p>
            <p style={{ fontSize: 13, color: '#555', marginTop: 10, lineHeight: 1.5 }}>{t('scanner.notfound.message')}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => navigate('/vision')} style={btnStyle('#1A6B3C', '#fff')}>
                {t('scanner.notfound.scanLabel')}
              </button>
              <button onClick={reset} style={btnStyle('#f0f0ec', '#555')}>
                {t('scanner.notfound.retry')}
              </button>
            </div>
          </div>
        )}

        {/* Erreur */}
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

function ProductCard({ product: p, source, t, onDetails, onReset }) {
  const s = SCORE_STYLES[p.score] || SCORE_STYLES.B;
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 48 }}>{p.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
          <div style={{ fontSize: 12, color: '#aaa' }}>{p.brand}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
            {source === 'local' ? t('scanner.found.sourceLocal') : t('scanner.found.sourceRemote')}
          </div>
        </div>
        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 14, fontWeight: 700, background: s.bg, color: s.color }}>
          {p.score}
        </span>
      </div>

      {/* Macros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 16 }}>
        {[
          { label: t('common.kcal'), val: p.kcal_per100 },
          { label: t('common.glucides'), val: p.per100?.glucides },
          { label: t('common.proteines'), val: p.per100?.proteines },
          { label: t('common.lipides'), val: p.per100?.lipides },
        ].map(({ label, val }) => (
          <div key={label} style={{ background: '#f7f7f5', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1A6B3C' }}>{val ?? '—'}</div>
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
