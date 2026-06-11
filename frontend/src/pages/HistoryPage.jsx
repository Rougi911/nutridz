import React, { useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { useJournalStore, useProfileStore } from '../store';
import { useTranslation } from '../i18n';

export default function HistoryPage({ embedded = false }) {
  const { history, fetchHistory } = useJournalStore();
  const { profile } = useProfileStore();
  const { t, dateFnsLocale } = useTranslation();
  const target = profile.target_kcal || 2310;

  useEffect(() => { fetchHistory(7); }, []);

  const data = history.map(row => ({
    date: format(parseISO(row.date), 'EEE', { locale: dateFnsLocale }),
    kcal: Math.round(row.kcal),
    glucides: Math.round(row.glucides),
    proteines: Math.round(row.proteines),
    lipides: Math.round(row.lipides)
  }));

  const avgKcal = data.length ? Math.round(data.reduce((s, d) => s + d.kcal, 0) / data.length) : 0;
  const daysOnTarget = data.filter(d => Math.abs(d.kcal - target) < target * 0.1).length;

  return (
    <div>
      {!embedded && (
        <div style={{ background: 'var(--accent-green)', color: 'white', padding: '1rem 1.25rem 1.5rem', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)' }}>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 500 }}>{t('history.title')}</h1>
          <p style={{ fontSize: 'var(--font-size-sm)', opacity: 0.75, marginTop: '2px' }}>{t('history.subtitle')}</p>
        </div>
      )}

      {/* Stats résumé */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '1rem 1.25rem 0' }}>
        {[
          { key: 'avgKcal', val: avgKcal + ' ' + t('common.kcal'), color: 'var(--accent-green)' },
          { key: 'daysOnTarget', val: `${daysOnTarget} / ${data.length}`, color: '#185FA5' }
        ].map(({ key, val, color }) => (
          <div key={key} style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--space-tight) 14px' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{t(`history.${key}`)}</div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 500, color, marginTop: 'var(--space-2xs)' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Graphique calories */}
      <div style={{ margin: '1rem 1.25rem 0', background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px var(--space-card)' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-tight)' }}>{t('history.caloriesPerDay')}</div>
        {data.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '2rem', fontSize: 'var(--font-size-sm)' }}>{t('history.noData')}</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 'var(--font-size-xs)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 'var(--font-size-xs)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v} ${t('common.kcal')}`, t('history.calories')]} contentStyle={{ fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-sm)', border: '0.5px solid rgba(0,0,0,0.1)' }} />
              <ReferenceLine y={target} stroke="#BA7517" strokeDasharray="3 3" label={{ value: t('history.target'), position: 'right', fontSize: 'var(--font-size-2xs)', fill: '#BA7517' }} />
              <Bar dataKey="kcal" fill="#1A6B3C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Graphique macros */}
      {data.length > 0 && (
        <div style={{ margin: '1rem 1.25rem 0', background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px var(--space-card)' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--space-tight)' }}>{t('history.macros')}</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 'var(--font-size-xs)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 'var(--font-size-xs)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-sm)', border: '0.5px solid rgba(0,0,0,0.1)' }} />
              <Bar dataKey="glucides" name={t('common.glucides')} fill="#BA7517" radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="proteines" name={t('common.proteines')} fill="#185FA5" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="lipides" name={t('common.lipides')} fill="#993C1D" radius={[0, 0, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 'var(--space-tight)', justifyContent: 'center', marginTop: 'var(--space-xs)' }}>
            {[['#BA7517', 'glucides'], ['#185FA5', 'proteines'], ['#993C1D', 'lipides']].map(([c, k]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2xs)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                <div style={{ width: '10px', height: '10px', background: c, borderRadius: 'var(--radius-2xs)' }} />{t(`common.${k}`)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
