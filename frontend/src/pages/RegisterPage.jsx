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
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error(t('auth.register.shortPassword')); return; }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
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
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', background: '#f7f7f5' }}>
      <div style={{ position: 'absolute', top: 12, right: 16 }}>
        <LanguageSelector />
      </div>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🌿</div>
      <h1 style={{ fontSize: 26, fontWeight: 500, color: '#1A6B3C', marginBottom: 4 }}>{t('auth.register.title')}</h1>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>{t('auth.register.subtitle')}</p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fields.map(({ key, label, type, placeholder }) => (
          <div key={key}>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>{label}</label>
            <input type={type} placeholder={placeholder} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.15)', fontSize: 14, background: '#fff', outline: 'none' }} />
          </div>
        ))}
        {/* RGPD consent checkboxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={consentTerms} onChange={e => setConsentTerms(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#1A6B3C', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
              J'accepte les{' '}
              <Link to="/confidentialite" style={{ color: '#1A6B3C' }}>conditions d'utilisation et la politique de confidentialité</Link>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={consentHealth} onChange={e => setConsentHealth(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#1A6B3C', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
              J'accepte que NutriVita traite mes données de santé (poids, calories, activités) pour me fournir le service
            </span>
          </label>
        </div>

        <button type="submit" disabled={loading || !consentTerms || !consentHealth}
          style={{ marginTop: 8, padding: '12px', background: '#1A6B3C', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: (!consentTerms || !consentHealth) ? 'not-allowed' : 'pointer', opacity: (loading || !consentTerms || !consentHealth) ? 0.5 : 1 }}>
          {loading ? t('auth.register.loading') : t('auth.register.submit')}
        </button>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#888' }}>
          {t('auth.register.hasAccount')} <Link to="/login" style={{ color: '#1A6B3C', fontWeight: 500 }}>{t('auth.register.login')}</Link>
        </p>
      </form>
    </div>
  );
}
