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
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-card)' }}>
      {/* Sport selector */}
      <div>
        <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 'var(--space-xs)' }}>
          {t('bilan.sport.marche') ? 'Sport' : 'Sport'}
        </label>
        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
          {sports.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              style={{
                flex: 1, minWidth: '70px', padding: '10px 6px',
                borderRadius: 'var(--radius-md)', border: `2px solid ${sport === s ? 'var(--accent-green)' : 'var(--border-color)'}`,
                background: sport === s ? 'var(--color-success-bg)' : 'var(--bg-primary)',
                color: sport === s ? 'var(--accent-green)' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: 'var(--font-size-xs)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2xs)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-xl)' }}>{SPORT_ICONS[s]}</span>
              {t(`bilan.sport.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Duration slider */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
          <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{t('bilan.duration')}</label>
          <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--accent-green)' }}>{duration} {t('bilan.minutes')}</span>
        </div>
        <input
          type="range" min={5} max={180} step={5} value={duration}
          onChange={e => setDuration(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent-green)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>
          <span>5 min</span><span>1h</span><span>3h</span>
        </div>
      </div>

      {/* Intensity */}
      <div>
        <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 'var(--space-xs)' }}>
          Intensité
        </label>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          {intensities.map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setIntensity(i)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)',
                border: `2px solid ${intensite === i ? 'var(--accent-green)' : 'var(--border-color)'}`,
                background: intensite === i ? 'var(--accent-green)' : 'var(--bg-primary)',
                color: intensite === i ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: 'var(--font-size-xs)', cursor: 'pointer',
              }}
            >
              {t(`bilan.intensity.${i}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Calorie preview */}
      <div style={{
        background: 'var(--color-success-bg)',
        borderRadius: 'var(--radius-lg)', padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('bilan.caloriesBurned')}</div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--accent-green)' }}>{kcal} kcal</div>
        </div>
        <div style={{ fontSize: 'var(--font-size-4xl)' }}>🔥</div>
      </div>

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '14px', borderRadius: 'var(--radius-lg)', border: 'none',
          background: saving ? 'var(--bg-tertiary)' : 'var(--accent-green)',
          color: saving ? 'var(--text-secondary)' : '#fff', fontWeight: 700, fontSize: 'var(--font-size-base)', cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? t('bilan.saving') : t('bilan.addActivity')}
      </button>
    </form>
  );
}
