import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/journal');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Identifiants incorrects');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', background: '#f7f7f5' }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🌿</div>
      <h1 style={{ fontSize: 26, fontWeight: 500, color: '#1A6B3C', marginBottom: 4 }}>NutriDZ</h1>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 32, textAlign: 'center' }}>Nutrition personnalisée pour le marché algérien</p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.15)', fontSize: 14, background: '#fff', outline: 'none' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Mot de passe</label>
          <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.15)', fontSize: 14, background: '#fff', outline: 'none' }} />
        </div>
        <button type="submit" disabled={loading} style={{ marginTop: 8, padding: '12px', background: '#1A6B3C', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#888' }}>
          Pas encore de compte ? <Link to="/register" style={{ color: '#1A6B3C', fontWeight: 500 }}>S'inscrire</Link>
        </p>
      </form>
    </div>
  );
}
