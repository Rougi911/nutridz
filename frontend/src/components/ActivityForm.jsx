import React, { useState, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { useProfileStore } from '../store';

const MET = {
  marche:   { legere: 2.5, moderee: 3.5, intense: 5.0 },
  course:   { legere: 7.0, moderee: 9.0, intense: 12.0 },
  velo:     { legere: 4.0, moderee: 7.0, intense: 10.0 },
  natation: { legere: 4.0, moderee: 6.0, intense: 9.0  },
  muscu:    { legere: 3.0, moderee: 5.0, intense: 7.0  },
};

const SPORT_ICONS = { marche: '🚶', course: '🏃', velo: '🚴', natation: '🏊', muscu: '💪' };

export default function ActivityForm({ onSave, saving }) {
  const { t } = useTranslation();
  const profile = useProfileStore(s => s.profile);
  const weight = profile?.weight || 70;

  const [sport, setSport] = useState('marche');
  const [duration, setDuration] = useState(30);
  const [intensite, setIntensity] = useState('moderee');

  const kcal = useMemo(() => {
    const met = MET[sport]?.[intensite] ?? 3.5;
    return Math.round(met * weight * (duration / 60));
  }, [sport, duration, intensite, weight]);

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ type: sport, duration_min: duration, intensite });
  }

  const sports = Object.keys(MET);
  const intensities = ['legere', 'moderee', 'intense'];

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sport selector */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#444', display: 'block', marginBottom: 8 }}>
          {t('bilan.sport.marche') ? 'Sport' : 'Sport'}
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sports.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              style={{
                flex: 1, minWidth: 70, padding: '10px 6px',
                borderRadius: 12, border: `2px solid ${sport === s ? '#1A6B3C' : '#e0e0e0'}`,
                background: sport === s ? '#EAF3DE' : '#fff',
                color: sport === s ? '#1A6B3C' : '#666',
                fontWeight: 600, fontSize: 12, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ fontSize: 22 }}>{SPORT_ICONS[s]}</span>
              {t(`bilan.sport.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Duration slider */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>{t('bilan.duration')}</label>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1A6B3C' }}>{duration} {t('bilan.minutes')}</span>
        </div>
        <input
          type="range" min={5} max={180} step={5} value={duration}
          onChange={e => setDuration(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#1A6B3C' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa', marginTop: 2 }}>
          <span>5 min</span><span>1h</span><span>3h</span>
        </div>
      </div>

      {/* Intensity */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#444', display: 'block', marginBottom: 8 }}>
          Intensité
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {intensities.map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setIntensity(i)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10,
                border: `2px solid ${intensite === i ? '#1A6B3C' : '#e0e0e0'}`,
                background: intensite === i ? '#1A6B3C' : '#fff',
                color: intensite === i ? '#fff' : '#666',
                fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}
            >
              {t(`bilan.intensity.${i}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Calorie preview */}
      <div style={{
        background: 'linear-gradient(135deg, #EAF3DE, #d4edda)',
        borderRadius: 14, padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>{t('bilan.caloriesBurned')}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1A6B3C' }}>{kcal} kcal</div>
        </div>
        <div style={{ fontSize: 36 }}>🔥</div>
      </div>

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '14px', borderRadius: 14, border: 'none',
          background: saving ? '#ccc' : '#1A6B3C',
          color: '#fff', fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? t('bilan.saving') : t('bilan.addActivity')}
      </button>
    </form>
  );
}
