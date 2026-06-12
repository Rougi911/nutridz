import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';
import LanguageSelector from '../components/LanguageSelector';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentHealth, setConsentHealth] = useState(false);
  const [consentGlucose, setConsentGlucose] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error(t('auth.register.shortPassword')); return; }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, consentGlucose);
      toast.success(t('auth.register.success'));
      navigate('/profile');
    } catch (err) {
      toast.error(err.response?.data?.error || t('auth.register.error'));
    } finally { setLoading(false); }
  };

  const fields = [
    { key: 'name', label: t('auth.register.name'), type: 'text', placeholder: t('auth.register.namePlaceholder') },
    { key: 'email', label: t('auth.register.email'), type: 'email', placeholder: t('auth.register.emailPlaceholder') },
    { key: 'password', label: t('auth.register.password'), type: 'password', placeholder: t('auth.register.passwordPlaceholder') },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: 'var(--space-card)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '12px', right: 'var(--space-card)' }}>
        <LanguageSelector />
      </div>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-section)' }}>
          <div style={{ fontSize: 'var(--icon-xl)', marginBottom: 'var(--space-xs)' }}>🌿</div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 500, color: 'var(--accent-green)', marginBottom: 'var(--space-2xs)' }}>{t('auth.register.title')}</h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0 }}>{t('auth.register.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-tight)' }}>
        {fields.map(({ key, label, type, placeholder }) => (
          <div key={key}>
            <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-2xs)' }}>{label}</label>
            <input type={type} placeholder={placeholder} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
          </div>
        ))}
        {/* RGPD consent checkboxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'var(--space-2xs)' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={consentTerms} onChange={e => setConsentTerms(e.target.checked)}
              style={{ marginTop: '2px', accentColor: 'var(--accent-green)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              J'accepte les{' '}
              <Link to="/confidentialite" style={{ color: 'var(--accent-green)' }}>conditions d'utilisation et la politique de confidentialité</Link>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={consentHealth} onChange={e => setConsentHealth(e.target.checked)}
              style={{ marginTop: '2px', accentColor: 'var(--accent-green)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              J'accepte que NutriVita traite mes données de santé (poids, calories, activités) pour me fournir le service
            </span>
          </label>
          {/* REG-01 Art.9 RGPD — consentement glycémie séparé, opt-in, décoché par défaut */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            <input type="checkbox" checked={consentGlucose} onChange={e => setConsentGlucose(e.target.checked)}
              style={{ marginTop: '2px', accentColor: 'var(--accent-teal)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {t('auth.register.consentGlucose')}
            </span>
          </label>
        </div>

        <button type="submit" disabled={loading || !consentTerms || !consentHealth}
          style={{ marginTop: 'var(--space-xs)', padding: '12px', background: 'var(--accent-green)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 500, cursor: (!consentTerms || !consentHealth) ? 'not-allowed' : 'pointer', opacity: (loading || !consentTerms || !consentHealth) ? 0.5 : 1 }}>
          {loading ? t('auth.register.loading') : t('auth.register.submit')}
        </button>
          <p style={{ textAlign: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            {t('auth.register.hasAccount')} <Link to="/login" style={{ color: 'var(--accent-green)', fontWeight: 500 }}>{t('auth.register.login')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
