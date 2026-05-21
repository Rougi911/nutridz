import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';
import api from '../utils/api';

const STEPS = [
  {
    title: 'Bienvenue sur NutriVita ! 🎉',
    description: 'Votre compagnon nutrition intelligent. Commençons par quelques informations de base.',
    fields: [],
  },
  {
    title: 'Vos informations 📝',
    description: 'Ces données permettent de calculer vos besoins caloriques.',
    fields: ['age', 'sexe', 'height', 'weight'],
  },
  {
    title: 'Votre objectif 🎯',
    description: 'Que souhaitez-vous accomplir ?',
    fields: ['activity_level', 'goal'],
  },
  {
    title: 'C\'est parti ! 🚀',
    description: 'Tout est prêt. Explorez les fonctionnalités :',
    features: [
      '🍽️ Journal alimentaire quotidien',
      '⚖️ Suivi du poids avec estimation composition',
      '🩸 Mode diabète avec métriques GMI/TIR',
      '🎤 Saisie vocale multilingue',
      '📊 Graphiques d\'évolution',
    ],
  },
];

const inputStyle = {
  padding: '0.75rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  width: '100%',
  boxSizing: 'border-box',
  fontSize: '1rem',
};

export default function OnboardingModal({ onComplete }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    age: '',
    sexe: 'h',
    height: '',
    weight: '',
    activity_level: 'mod',
    goal: 'maintien',
  });

  const handleNext = async () => {
    if (step === STEPS.length - 1) {
      const payload = {
        age:            data.age      ? parseInt(data.age)        : undefined,
        sexe:           data.sexe     || undefined,
        height:         data.height   ? parseFloat(data.height)   : undefined,
        weight:         data.weight   ? parseFloat(data.weight)   : undefined,
        activity_level: data.activity_level || undefined,
        goal:           data.goal     || undefined,
      };

      // Retry une fois en cas de 502/503 (cold start Render)
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await api.put('/profile', payload);
          localStorage.setItem('nutridz-onboarding-done', 'true');
          toast.success(t('onboarding.complete'));
          onComplete();
          return;
        } catch (err) {
          const status = err.response?.status;
          if (attempt === 1 && (status === 502 || status === 503 || !status)) {
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
          // Après 2 tentatives ou autre erreur : ne pas bloquer l'utilisateur
          console.error('Onboarding save error:', err);
          toast.error("Profil non enregistré — complétez-le dans Profil");
          localStorage.setItem('nutridz-onboarding-done', 'true');
          onComplete();
          return;
        }
      }
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => { if (step > 0) setStep(step - 1); };

  const currentStep = STEPS[step];
  const canProceed = step === 0 || step === STEPS.length - 1 ||
    currentStep.fields.every(field => data[field] !== '');

  const isWelcome = step === 0;
  const isFinish = step === STEPS.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg-primary)', borderRadius: 24, padding: isWelcome ? '2.5rem 2rem' : '2rem',
        maxWidth: '480px', width: '100%', maxHeight: '88vh', overflowY: 'auto',
        position: 'relative',
      }}>
        {/* Progress segments */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: isWelcome ? '2rem' : '1.5rem' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 5, borderRadius: 9999,
              background: i < step ? 'rgba(99,102,241,0.4)' : i === step ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Skip button */}
        {step < STEPS.length - 1 && (
          <button onClick={handleNext} style={{ position: 'absolute', top: '1.2rem', right: '1.2rem', background: 'none', border: 'none', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}>
            Passer
          </button>
        )}

        {/* Step 0: Welcome */}
        {isWelcome && (
          <div style={{ textAlign: 'center' }}>
            <div className="animate-float" style={{ fontSize: 64, marginBottom: '1rem', display: 'block' }}>🥗</div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
              {currentStep.title}
            </h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--accent-blue)', fontWeight: 600, marginBottom: '0.75rem' }}>
              Your Daily Wellness Companion
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
              {currentStep.description}
            </p>
          </div>
        )}

        {/* Step 1+: Title */}
        {!isWelcome && (
          <>
            <h2 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: 700 }}>
              {currentStep.title}
            </h2>
            <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {currentStep.description}
            </p>
          </>
        )}

        {/* Fields */}
        {currentStep.fields && currentStep.fields.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.5rem' }}>
            {currentStep.fields.includes('age') && (
              <input type="number" placeholder={t('onboarding.age')} value={data.age}
                onChange={e => setData({ ...data, age: e.target.value })}
                style={{ ...inputStyle, borderRadius: 12 }} />
            )}
            {currentStep.fields.includes('sexe') && (
              <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 9999, padding: 4, gap: 4 }}>
                {[['h', t('onboarding.male')], ['f', t('onboarding.female')]].map(([v, label]) => (
                  <button key={v} onClick={() => setData({ ...data, sexe: v })} style={{
                    flex: 1, padding: '0.6rem', borderRadius: 9999, cursor: 'pointer', border: 'none',
                    background: data.sexe === v ? 'var(--accent-blue)' : 'transparent',
                    color: data.sexe === v ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.15s',
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {currentStep.fields.includes('height') && (
              <input type="number" placeholder={t('onboarding.height')} value={data.height}
                onChange={e => setData({ ...data, height: e.target.value })}
                style={{ ...inputStyle, borderRadius: 12 }} />
            )}
            {currentStep.fields.includes('weight') && (
              <input type="number" step="0.1" placeholder={t('onboarding.weight')} value={data.weight}
                onChange={e => setData({ ...data, weight: e.target.value })}
                style={{ ...inputStyle, borderRadius: 12 }} />
            )}
            {currentStep.fields.includes('activity_level') && (
              <select value={data.activity_level}
                onChange={e => setData({ ...data, activity_level: e.target.value })}
                style={{ ...inputStyle, borderRadius: 12 }}>
                <option value="sed">{t('onboarding.sedentary')}</option>
                <option value="light">{t('onboarding.light')}</option>
                <option value="mod">{t('onboarding.moderate')}</option>
                <option value="actif">{t('onboarding.active')}</option>
              </select>
            )}
            {currentStep.fields.includes('goal') && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { v: 'perte',    label: t('onboarding.lose'),     icon: '📉' },
                  { v: 'maintien', label: t('onboarding.maintain'), icon: '⚖️' },
                  { v: 'prise',    label: t('onboarding.gain'),     icon: '💪' },
                  { v: 'sante',    label: t('onboarding.health'),   icon: '🥗' },
                ].map(({ v, label, icon }) => (
                  <button key={v} onClick={() => setData({ ...data, goal: v })} style={{
                    padding: '1rem 0.75rem', borderRadius: 14, cursor: 'pointer',
                    border: data.goal === v ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                    background: data.goal === v ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)',
                    color: data.goal === v ? 'var(--accent-blue)' : 'var(--text-primary)',
                    fontWeight: data.goal === v ? 700 : 500, fontSize: '0.9rem',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: 26 }}>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Features list (last step) */}
        {isFinish && currentStep.features && (
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {currentStep.features.map((feature, i) => {
              const icon = feature.split(' ')[0];
              const text = feature.slice(icon.length + 1);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem', borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9999, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {icon}
                  </div>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {step > 0 && !isFinish && (
            <button onClick={handleBack} style={{
              flex: 1, padding: '0.85rem', borderRadius: 12,
              border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem',
            }}>
              {t('onboarding.back')}
            </button>
          )}
          <button onClick={handleNext} disabled={!canProceed} style={{
            flex: 1, padding: '0.85rem', borderRadius: 12, border: 'none',
            background: canProceed ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
            color: canProceed ? 'white' : 'var(--text-secondary)',
            fontWeight: 700, cursor: canProceed ? 'pointer' : 'not-allowed',
            fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {isWelcome ? 'Commencer →' : isFinish ? `🚀 ${t('onboarding.finish')}` : `${t('onboarding.next')} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
