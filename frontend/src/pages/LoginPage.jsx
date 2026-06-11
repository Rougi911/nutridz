import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';
import LanguageSelector from '../components/LanguageSelector';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/journal');
    } catch (err) {
      toast.error(err.response?.data?.error || t('auth.login.error'));
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: 'var(--space-card)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '12px', right: 'var(--space-card)' }}>
        <LanguageSelector />
      </div>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-section)' }}>
          <div style={{ fontSize: 'var(--icon-xl)', marginBottom: 'var(--space-xs)' }}>🌿</div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 500, color: 'var(--accent-green)', marginBottom: 'var(--space-2xs)' }}>{t('auth.login.title')}</h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0 }}>{t('auth.login.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-tight)' }}>
          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-2xs)' }}>{t('auth.login.email')}</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-2xs)' }}>{t('auth.login.password')}</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
          </div>
          <button type="submit" disabled={loading} style={{ marginTop: 'var(--space-xs)', padding: '12px', background: 'var(--accent-green)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 500, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? t('auth.login.loading') : t('auth.login.submit')}
          </button>
          <p style={{ textAlign: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            {t('auth.login.noAccount')} <Link to="/register" style={{ color: 'var(--accent-green)', fontWeight: 500 }}>{t('auth.login.register')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
