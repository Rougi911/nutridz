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

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg-primary)', borderRadius: '12px', padding: '2rem',
        maxWidth: '500px', width: '100%', maxHeight: '80vh', overflowY: 'auto',
      }}>
        {/* Progress */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: '4px', borderRadius: '2px',
                background: i <= step ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
              }} />
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Étape {step + 1} / {STEPS.length}
          </div>
        </div>

        <h2 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)', fontSize: '1.3rem' }}>
          {currentStep.title}
        </h2>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          {currentStep.description}
        </p>

        {/* Fields */}
        {currentStep.fields && currentStep.fields.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {currentStep.fields.includes('age') && (
              <input type="number" placeholder={t('onboarding.age')} value={data.age}
                onChange={e => setData({ ...data, age: e.target.value })} style={inputStyle} />
            )}
            {currentStep.fields.includes('sexe') && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[['h', t('onboarding.male')], ['f', t('onboarding.female')]].map(([v, label]) => (
                  <button key={v} onClick={() => setData({ ...data, sexe: v })} style={{
                    flex: 1, padding: '0.75rem', borderRadius: '8px', cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                    background: data.sexe === v ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                    color: data.sexe === v ? 'white' : 'var(--text-primary)', fontWeight: 600,
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {currentStep.fields.includes('height') && (
              <input type="number" placeholder={t('onboarding.height')} value={data.height}
                onChange={e => setData({ ...data, height: e.target.value })} style={inputStyle} />
            )}
            {currentStep.fields.includes('weight') && (
              <input type="number" step="0.1" placeholder={t('onboarding.weight')} value={data.weight}
                onChange={e => setData({ ...data, weight: e.target.value })} style={inputStyle} />
            )}
            {currentStep.fields.includes('activity_level') && (
              <select value={data.activity_level}
                onChange={e => setData({ ...data, activity_level: e.target.value })} style={inputStyle}>
                <option value="sed">{t('onboarding.sedentary')}</option>
                <option value="light">{t('onboarding.light')}</option>
                <option value="mod">{t('onboarding.moderate')}</option>
                <option value="actif">{t('onboarding.active')}</option>
              </select>
            )}
            {currentStep.fields.includes('goal') && (
              <select value={data.goal}
                onChange={e => setData({ ...data, goal: e.target.value })} style={inputStyle}>
                <option value="perte">{t('onboarding.lose')}</option>
                <option value="maintien">{t('onboarding.maintain')}</option>
                <option value="prise">{t('onboarding.gain')}</option>
                <option value="sante">{t('onboarding.health')}</option>
              </select>
            )}
          </div>
        )}

        {/* Features list */}
        {currentStep.features && (
          <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
            {currentStep.features.map((feature, i) => (
              <li key={i} style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                {feature}
              </li>
            ))}
          </ul>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          {step > 0 && (
            <button onClick={handleBack} style={{
              flex: 1, padding: '0.75rem', borderRadius: '8px',
              border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer',
            }}>
              {t('onboarding.back')}
            </button>
          )}
          <button onClick={handleNext} disabled={!canProceed} style={{
            flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none',
            background: canProceed ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
            color: canProceed ? 'white' : 'var(--text-secondary)',
            fontWeight: '600', cursor: canProceed ? 'pointer' : 'not-allowed',
          }}>
            {step === STEPS.length - 1 ? t('onboarding.finish') : t('onboarding.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
