import React, { useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useJournalStore, useProfileStore } from '../store';

export default function HistoryPage() {
  const { history, fetchHistory } = useJournalStore();
  const { profile } = useProfileStore();
  const target = profile.target_kcal || 2310;

  useEffect(() => { fetchHistory(7); }, []);

  const data = history.map(row => ({
    date: format(parseISO(row.date), 'EEE', { locale: fr }),
    kcal: Math.round(row.kcal),
    glucides: Math.round(row.glucides),
    proteines: Math.round(row.proteines),
    lipides: Math.round(row.lipides)
  }));

  const avgKcal = data.length ? Math.round(data.reduce((s, d) => s + d.kcal, 0) / data.length) : 0;
  const daysOnTarget = data.filter(d => Math.abs(d.kcal - target) < target * 0.1).length;

  return (
    <div>
      <div style={{ background: '#1A6B3C', color: 'white', padding: '1rem 1.25rem 1.5rem', borderRadius: '0 0 24px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>📈 Historique</h1>
        <p style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>7 derniers jours</p>
      </div>

      {/* Stats résumé */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, padding: '1rem 1.25rem 0' }}>
        {[
          { label: 'Moy. calories/j', val: avgKcal + ' kcal', color: '#1A6B3C' },
          { label: 'Jours dans la cible', val: `${daysOnTarget} / ${data.length}`, color: '#185FA5' }
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 500, color, marginTop: 4 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Graphique calories */}
      <div style={{ margin: '1rem 1.25rem 0', background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Calories par jour</div>
        {data.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#bbb', padding: '2rem', fontSize: 13 }}>Pas encore de données. Commencez à logger vos repas !</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v} kcal`, 'Calories']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.1)' }} />
              <ReferenceLine y={target} stroke="#BA7517" strokeDasharray="3 3" label={{ value: 'Cible', position: 'right', fontSize: 10, fill: '#BA7517' }} />
              <Bar dataKey="kcal" fill="#1A6B3C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Graphique macros */}
      {data.length > 0 && (
        <div style={{ margin: '1rem 1.25rem 0', background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Macronutriments (g/jour)</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.1)' }} />
              <Bar dataKey="glucides" name="Glucides" fill="#BA7517" radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="proteines" name="Protéines" fill="#185FA5" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="lipides" name="Lipides" fill="#993C1D" radius={[0, 0, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
            {[['#BA7517','Glucides'],['#185FA5','Protéines'],['#993C1D','Lipides']].map(([c,l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666' }}>
                <div style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />{l}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
