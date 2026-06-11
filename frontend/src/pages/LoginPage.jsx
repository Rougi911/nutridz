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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: 16, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 12, right: 16 }}>
        <LanguageSelector />
      </div>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🌿</div>
          <h1 style={{ fontSize: 26, fontWeight: 500, color: '#1A6B3C', marginBottom: 4 }}>{t('auth.login.title')}</h1>
          <p style={{ fontSize: 14, color: '#888', margin: 0 }}>{t('auth.login.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>{t('auth.login.email')}</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>{t('auth.login.password')}</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
          </div>
          <button type="submit" disabled={loading} style={{ marginTop: 8, padding: '12px', background: '#1A6B3C', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? t('auth.login.loading') : t('auth.login.submit')}
          </button>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#888', margin: 0 }}>
            {t('auth.login.noAccount')} <Link to="/register" style={{ color: '#1A6B3C', fontWeight: 500 }}>{t('auth.login.register')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
