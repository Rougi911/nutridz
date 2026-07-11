import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';
import { calcBMR, calcTDEE, calcTarget } from '../utils/api';
import api from '../utils/api';

const STEPS = [
  { title: 'Bienvenue sur NutraLance ! 🎉', description: 'Votre compagnon nutrition intelligent. Commençons par quelques informations de base.' },
  { title: 'Vos informations 📝', description: 'Ces données permettent de calculer vos besoins caloriques.' },
  { title: 'Votre objectif 🎯', description: 'Que souhaitez-vous accomplir ?' },
  { title: "C'est parti ! 🚀", description: '' },
];

const inputStyle = {
  padding: '0.75rem',
  borderRadius: 'var(--radius-md)',
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
    prenom: '',
    age: '',
    sexe: 'h',
    height: '',
    weight: '',
    activity_level: 'mod',
    goal: 'maintien',
  });

  // Computed kcal for summary step
  const bmr = (data.age && data.weight && data.height)
    ? calcBMR(parseInt(data.age), parseFloat(data.weight), parseFloat(data.height), data.sexe)
    : null;
  const tdee = bmr ? calcTDEE(bmr, data.activity_level || 'mod') : null;
  const targetKcal = tdee ? Math.round(calcTarget(tdee, data.goal || 'maintien', null)) : null;

  const handleNext = async () => {
    if (step === STEPS.length - 1) {
      const payload = {
        prenom:         data.prenom   || undefined,
        age:            data.age      ? parseInt(data.age)        : undefined,
        sexe:           data.sexe     || undefined,
        height:         data.height   ? parseFloat(data.height)   : undefined,
        weight:         data.weight   ? parseFloat(data.weight)   : undefined,
        activity_level: data.activity_level || undefined,
        goal:           data.goal     || undefined,
      };

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

  const canProceed =
    step === 0 ? true :
    step === 1 ? (data.age !== '' && data.height !== '' && data.weight !== '') :
    true;

  const isWelcome = step === 0;
  const isFinish  = step === STEPS.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
      zIndex: 300,
    }}>
      <div className="modal-content" style={{ borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        {/* Progress bar — 4 segments, current gets flex:2 */}
        <div style={{ display: 'flex', gap: 'var(--space-2xs)', marginBottom: isWelcome ? '2rem' : '1.5rem' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              flex: i === step ? 2 : 1, height: 'var(--space-2xs)', borderRadius: 'var(--radius-2xs)',
              background: i < step ? 'rgba(99,102,241,0.4)' : i === step ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Skip button */}
        {!isFinish && (
          <button onClick={handleNext} style={{
            position: 'absolute', top: '1.2rem', right: '1.2rem',
            background: 'none', border: 'none', fontSize: '0.82rem',
            color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500,
          }}>
            Passer
          </button>
        )}

        {/* ── Step 0: Welcome ── */}
        {isWelcome && (
          <div style={{ textAlign: 'center' }}>
            <div className="gradient-header gradient-hero" style={{ padding: '24px 20px', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', color: '#fff', textAlign: 'center', margin: '-20px -20px 1.5rem' }}>
              <div className="animate-float" style={{ fontSize: 'var(--icon-2xl)', marginBottom: '0.5rem', display: 'block' }}>🥗</div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 500, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                {STEPS[0].title}
              </h2>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, opacity: 0.9 }}>
                Your Daily Wellness Companion
              </p>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
              {STEPS[0].description}
            </p>
          </div>
        )}

        {/* ── Step 1+: title/desc ── */}
        {!isWelcome && !isFinish && (
          <>
            <h2 style={{ marginBottom: '0.4rem', color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 700 }}>
              {STEPS[step].title}
            </h2>
            <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {STEPS[step].description}
            </p>
          </>
        )}

        {/* ── Step 1: Body info ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
            <input type="text" placeholder="Prénom (optionnel)" value={data.prenom}
              onChange={e => setData({ ...data, prenom: e.target.value })}
              style={inputStyle} />
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', padding: 'var(--space-2xs)', gap: 'var(--space-2xs)' }}>
              {[['h', t('onboarding.male')], ['f', t('onboarding.female')]].map(([v, label]) => (
                <button key={v} onClick={() => setData({ ...data, sexe: v })} style={{
                  flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-full)', cursor: 'pointer', border: 'none',
                  background: data.sexe === v ? 'var(--accent-blue)' : 'transparent',
                  color: data.sexe === v ? 'white' : 'var(--text-secondary)',
                  fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.15s',
                }}>
                  {label}
                </button>
              ))}
            </div>
            {/* Âge + Taille on same line */}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <input type="number" placeholder={t('onboarding.age')} value={data.age}
                onChange={e => setData({ ...data, age: e.target.value })}
                style={{ ...inputStyle, flex: 1 }} />
              <input type="number" placeholder={t('onboarding.height')} value={data.height}
                onChange={e => setData({ ...data, height: e.target.value })}
                style={{ ...inputStyle, flex: 1 }} />
            </div>
            <input type="number" step="0.1" placeholder={t('onboarding.weight')} value={data.weight}
              onChange={e => setData({ ...data, weight: e.target.value })}
              style={inputStyle} />
          </div>
        )}

        {/* ── Step 2: Objectif ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
            <select value={data.activity_level}
              onChange={e => setData({ ...data, activity_level: e.target.value })}
              style={inputStyle}>
              <option value="sed">{t('onboarding.sedentary')}</option>
              <option value="light">{t('onboarding.light')}</option>
              <option value="mod">{t('onboarding.moderate')}</option>
              <option value="actif">{t('onboarding.active')}</option>
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { v: 'perte',    label: t('onboarding.lose'),     icon: 'ti-trending-down' },
                { v: 'maintien', label: t('onboarding.maintain'), icon: 'ti-trending-right' },
                { v: 'prise',    label: t('onboarding.gain'),     icon: 'ti-barbell' },
                { v: 'sante',    label: t('onboarding.health'),   icon: 'ti-droplet-half-2' },
              ].map(({ v, label, icon }) => (
                <button key={v} onClick={() => setData({ ...data, goal: v })} style={{
                  padding: '1rem 0.75rem', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                  border: data.goal === v ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                  background: data.goal === v ? 'var(--color-info-bg)' : 'var(--bg-secondary)',
                  color: data.goal === v ? 'var(--accent-blue)' : 'var(--text-primary)',
                  fontWeight: data.goal === v ? 700 : 500, fontSize: '0.9rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xs)', transition: 'all 0.15s',
                }}>
                  <i className={`ti ${icon}`} style={{ fontSize: 'var(--font-size-2xl)', color: data.goal === v ? 'var(--accent-blue)' : 'var(--text-secondary)' }} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Summary ── */}
        {isFinish && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: '60px', height: '60px', borderRadius: 'var(--radius-full)', background: 'var(--color-info-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--font-size-2xl)', margin: '0 auto 0.75rem',
              }}>✅</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.3rem' }}>
                Tout est prêt !
              </h2>
              {targetKcal ? (
                <p style={{ color: 'var(--accent-blue)', fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>
                  Objectif : {targetKcal} kcal/jour
                </p>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                  Complétez votre profil pour voir votre objectif
                </p>
              )}
            </div>

            {/* Macro breakdown */}
            {targetKcal && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '0.85rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-xs)' }}>
                {[
                  { label: 'Glucides',  kcal: Math.round(targetKcal * 0.50), color: 'var(--accent-blue)' },
                  { label: 'Protéines', kcal: Math.round(targetKcal * 0.25), color: 'var(--accent-green)' },
                  { label: 'Lipides',   kcal: Math.round(targetKcal * 0.25), color: 'var(--accent-yellow)' },
                ].map(({ label, kcal, color }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '0.6rem 0.3rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color }}>{kcal}</div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>{label}</div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color, fontWeight: 600, marginTop: '1px' }}>kcal</div>
                  </div>
                ))}
              </div>
            )}

            {/* 3 features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                ['📓', 'Journal alimentaire quotidien'],
                ['⚖️', 'Suivi du poids et composition'],
                ['📊', "Graphiques d'évolution"],
              ].map(([icon, text], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-tight)' }}>
                  <div style={{
                    width: 'var(--size-icon-btn)', height: 'var(--size-icon-btn)', borderRadius: 'var(--radius-full)', background: 'var(--color-info-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--font-size-lg)', flexShrink: 0,
                  }}>
                    {icon}
                  </div>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {step > 0 && !isFinish && (
            <button onClick={handleBack} style={{
              flex: 1, padding: '0.85rem', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem',
            }}>
              {t('onboarding.back')}
            </button>
          )}
          <button onClick={handleNext} disabled={!canProceed} style={{
            flex: 1,
            padding: isWelcome ? '1rem' : '0.85rem',
            borderRadius: isWelcome ? 'var(--radius-lg)' : 'var(--radius-md)',
            border: 'none',
            background: canProceed ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
            color: canProceed ? 'white' : 'var(--text-secondary)',
            fontWeight: 700, cursor: canProceed ? 'pointer' : 'not-allowed',
            fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            {isWelcome ? 'Commencer →' : isFinish ? 'Commencer mon parcours →' : `${t('onboarding.next')} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
