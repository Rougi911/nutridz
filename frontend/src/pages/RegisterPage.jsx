import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error('Mot de passe trop court (6 caractères min)'); return; }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success('Compte créé ! Bienvenue 🎉');
      navigate('/profile');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'inscription');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', background: '#f7f7f5' }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🌿</div>
      <h1 style={{ fontSize: 26, fontWeight: 500, color: '#1A6B3C', marginBottom: 4 }}>NutriDZ</h1>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>Créer un compte</p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { key: 'name', label: 'Prénom & Nom', type: 'text', placeholder: 'Ex: Ahmed Benali' },
          { key: 'email', label: 'Email', type: 'email', placeholder: 'exemple@gmail.com' },
          { key: 'password', label: 'Mot de passe', type: 'password', placeholder: '6 caractères minimum' }
        ].map(({ key, label, type, placeholder }) => (
          <div key={key}>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>{label}</label>
            <input type={type} placeholder={placeholder} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.15)', fontSize: 14, background: '#fff', outline: 'none' }} />
          </div>
        ))}
        <button type="submit" disabled={loading} style={{ marginTop: 8, padding: '12px', background: '#1A6B3C', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Création...' : 'Créer mon compte'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#888' }}>
          Déjà un compte ? <Link to="/login" style={{ color: '#1A6B3C', fontWeight: 500 }}>Se connecter</Link>
        </p>
      </form>
    </div>
  );
}
