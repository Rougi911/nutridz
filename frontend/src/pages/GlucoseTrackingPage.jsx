import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useTranslation } from '../i18n';
import VoiceInput from '../components/VoiceInput';
import { SkeletonCard, SkeletonLine } from '../components/Skeleton';
import useSettingsStore from '../store/useSettingsStore';
import { displayGlucose, inputGlucoseToMgdl, glucosePlaceholder, glucoseThresholds, mgdlToMmol } from '../utils/units';
import {
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export default function GlucoseTrackingPage() {
  const { t, lang } = useTranslation();
  const { glucoseUnit } = useSettingsStore();
  const thresholds = glucoseThresholds(glucoseUnit);
  const [readings, setReadings]   = useState([]);
  const [metrics, setMetrics]     = useState(null);
  const [period, setPeriod]       = useState(14);
  const [loading, setLoading]     = useState(false);
  const [glucoseValue, setGlucoseValue] = useState('');
  const [readingType, setReadingType]   = useState('random');
  const [importing, setImporting] = useState(false);

  useEffect(() => { fetchData(); }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - period);
      const [readingsRes, metricsRes] = await Promise.all([
        api.get(`/glucose?from=${from.toISOString()}`),
        api.get(`/glucose/metrics?days=${period}`),
      ]);
      setReadings(readingsRes.data);
      setMetrics(metricsRes.data);
    } catch {
      toast.error(t('glucose.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const mgdl = inputGlucoseToMgdl(glucoseValue, glucoseUnit);
    if (!mgdl || mgdl < 20 || mgdl > 600) {
      toast.error(t('glucose.invalidValue'));
      return;
    }
    try {
      await api.post('/glucose', { glucose_mg_dl: mgdl, reading_type: readingType });
      toast.success(t('glucose.saved'));
      setGlucoseValue('');
      fetchData();
    } catch {
      toast.error(t('glucose.errorSaving'));
    }
  };

  const handleVoiceGlucose = async (transcript) => {
    try {
      const res = await api.post('/voice/parse', { text: transcript, context: 'glucose', lang });
      if (res.data.glucose_mg_dl) {
        const displayVal = glucoseUnit === 'mmol/L' ? mgdlToMmol(res.data.glucose_mg_dl) : res.data.glucose_mg_dl;
        setGlucoseValue(String(displayVal));
        setReadingType(res.data.reading_type || 'random');
        toast.success(t('voice.glucoseDetected'));
      } else {
        toast.error(t('voice.glucoseNotDetected'));
      }
    } catch {
      toast.error(t('voice.parseError'));
    }
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const res = await api.post('/glucose/import-csv', { csv_text: text });
      toast.success(`${res.data.imported_count} lectures importées`);
      fetchData();
    } catch {
      toast.error(t('glucose.errorImport'));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // Prepare chart data: convert timestamp to epoch for numeric XAxis
  const chartData = readings.map(r => ({
    ...r,
    x: new Date(r.timestamp).getTime(),
    y: r.glucose_mg_dl,
  }));

  return (
    <div style={{ paddingBottom: '5rem' }}>
      {/* Header */}
      <div className="gradient-glucose" style={{ padding: '1.25rem 1.25rem 1.5rem', color: 'white', borderRadius: '0 0 28px 28px' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
          🩸 {t('glucose.title')}
        </h1>
        <p style={{ margin: '0.4rem 0 0', opacity: 0.85, fontSize: '0.88rem' }}>
          {t('glucose.subtitle')}
        </p>
      </div>

      {/* Saisie manuelle */}
      <div style={{ margin: '1rem 1.25rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: '#333' }}>
          ➕ {t('glucose.manualEntry')}
        </h3>
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="number"
            step="1"
            placeholder={glucosePlaceholder(glucoseUnit)}
            value={glucoseValue}
            onChange={(e) => setGlucoseValue(e.target.value)}
            style={{ flex: '1 1 140px', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '1rem' }}
          />
          <select
            value={readingType}
            onChange={(e) => setReadingType(e.target.value)}
            style={{ flex: '1 1 140px', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.9rem' }}
          >
            <option value="fasting">{t('glucose.fasting')}</option>
            <option value="pre_meal">{t('glucose.preMeal')}</option>
            <option value="post_meal">{t('glucose.postMeal')}</option>
            <option value="bedtime">{t('glucose.bedtime')}</option>
            <option value="random">{t('glucose.random')}</option>
          </select>
          <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 100%' }}>
            <button type="submit" style={{
              flex: 1, padding: '0.6rem 1.5rem', background: 'var(--accent-blue)', color: 'white',
              border: 'none', borderRadius: 9999, fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem',
            }}>
              {t('glucose.add')}
            </button>
            <VoiceInput
              context="glucose"
              onResult={handleVoiceGlucose}
              showTranscript={false}
              buttonStyle={{ padding: '0.6rem 1rem' }}
            />
          </div>
        </form>
      </div>

      {/* Import CSV */}
      <div style={{ margin: '0 1.25rem 1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
        <h3 style={{ margin: '0 0 0.4rem', fontSize: '0.95rem', fontWeight: 700, color: '#333' }}>
          📂 {t('glucose.importCSV')}
        </h3>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.4 }}>
          {t('glucose.importHelp')}
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={handleCSVImport}
          disabled={importing}
          style={{ padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', width: '100%', fontSize: '0.85rem', boxSizing: 'border-box' }}
        />
        {importing && <p style={{ marginTop: '0.5rem', color: '#3b82f6', fontSize: '0.85rem' }}>Import en cours...</p>}
      </div>

      {/* Sélecteur période */}
      <div style={{ margin: '1rem 1.25rem', display: 'flex', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 9999, padding: 4, gap: 4 }}>
        {[7, 14, 30].map(days => (
          <button key={days} onClick={() => setPeriod(days)} style={{
            flex: 1, padding: '0.5rem 0', borderRadius: 9999, cursor: 'pointer', fontSize: 13,
            border: 'none',
            background: period === days ? 'var(--accent-blue)' : 'transparent',
            fontWeight: period === days ? '700' : '400',
            color: period === days ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.2s',
          }}>
            {days}j
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '1rem' }}>
          <SkeletonCard style={{ marginBottom: '1rem' }}>
            <SkeletonLine width="40%" height="1.2rem" style={{ marginBottom: '0.8rem' }} />
            <SkeletonLine height="250px" />
          </SkeletonCard>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.7rem' }}>
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i}><SkeletonLine height="3rem" /></SkeletonCard>)}
          </div>
        </div>
      ) : (
        <>
          {/* Métriques cards */}
          {metrics && metrics.total_readings > 0 && (
            <div style={{ margin: '0 1.25rem 1rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.7rem' }}>
              <MetricCard label={t('glucose.gmi')} value={`${metrics.gmi}%`}
                color={metrics.gmi < 7 ? '#10b981' : metrics.gmi < 8 ? '#f59e0b' : '#ef4444'}
                subtitle={t('glucose.gmiSubtitle')} />
              <MetricCard label={t('glucose.tir')} value={`${metrics.tir}%`}
                color={metrics.tir > 70 ? '#10b981' : metrics.tir > 50 ? '#f59e0b' : '#ef4444'}
                subtitle={t('glucose.tirSubtitle')} />
              <MetricCard label={t('glucose.cv')} value={`${metrics.cv}%`}
                color={metrics.cv < 36 ? '#10b981' : '#f59e0b'}
                subtitle={t('glucose.cvSubtitle')} />
              <MetricCard label={t('glucose.avg')} value={glucoseUnit === 'mmol/L' ? `${mgdlToMmol(metrics.avg_glucose)}` : `${metrics.avg_glucose}`}
                color="#3b82f6" subtitle={glucoseUnit} />
            </div>
          )}

          {/* Distribution */}
          {metrics && metrics.distribution && (
            <div style={{ margin: '0 1.25rem 1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: '#333' }}>
                {t('glucose.distribution')}
              </h3>
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                <DistributionBar label={t('glucose.veryLow')} pct={metrics.distribution.very_low_pct} count={metrics.distribution.very_low_count} color="#dc2626" />
                <DistributionBar label={t('glucose.low')}     pct={metrics.distribution.low_pct}      count={metrics.distribution.low_count}      color="#f59e0b" />
                <DistributionBar label={t('glucose.inRange')} pct={metrics.distribution.in_range_pct} count={metrics.distribution.in_range_count} color="#10b981" />
                <DistributionBar label={t('glucose.high')}    pct={metrics.distribution.high_pct}     count={metrics.distribution.high_count}     color="#f59e0b" />
                <DistributionBar label={t('glucose.veryHigh')} pct={metrics.distribution.very_high_pct} count={metrics.distribution.very_high_count} color="#dc2626" />
              </div>
            </div>
          )}

          {/* Graphique scatter */}
          {chartData.length > 0 && (
            <div style={{ margin: '0 1.25rem 1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: '#333' }}>
                {t('glucose.chart')}
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={['auto', 'auto']}
                    scale="time"
                    tick={{ fontSize: 9, fill: '#aaa' }}
                    tickFormatter={(ms) => format(new Date(ms), 'dd/MM')}
                  />
                  <YAxis dataKey="y" domain={glucoseUnit === 'mmol/L' ? [2, 20] : [40, 320]} tick={{ fontSize: 10 }} unit={glucoseUnit === 'mmol/L' ? ' mmol' : ' mg'} width={65} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                          <div style={{ fontWeight: 700 }}>{displayGlucose(d.glucose_mg_dl, glucoseUnit)}</div>
                          <div style={{ color: '#888' }}>{format(new Date(d.timestamp), 'dd/MM/yyyy HH:mm')}</div>
                          <div style={{ color: '#666' }}>{d.reading_type}</div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={thresholds.targetLow}  stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} />
                  <ReferenceLine y={thresholds.targetHigh} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} />
                  <Scatter
                    data={chartData.map(r => ({ ...r, y: glucoseUnit === 'mmol/L' ? mgdlToMmol(r.glucose_mg_dl) : r.glucose_mg_dl }))}
                    shape={(props) => {
                      const { cx, cy, payload } = props;
                      const g = payload.glucose_mg_dl;
                      const color = g < thresholds.low ? '#ef4444' : g > thresholds.targetHigh ? '#f59e0b' : '#10b981';
                      return <circle cx={cx} cy={cy} r={5} fill={color} fillOpacity={0.85} />;
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.4rem', fontStyle: 'italic' }}>
                {t('glucose.chartHelp')}
              </p>
            </div>
          )}

          {/* Liste lectures récentes */}
          {readings.length > 0 && (
            <div style={{ margin: '0 1.25rem 1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: '#333' }}>
                {t('glucose.recentReadings')}
              </h3>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {readings.slice(0, 20).map((r) => {
                  const g = r.glucose_mg_dl;
                  const outBg    = g < thresholds.low ? '#fee2e2' : g > thresholds.targetHigh ? '#fef3c7' : '#dcfce7';
                  const outColor = g < thresholds.low ? '#dc2626' : g > thresholds.targetHigh ? '#d97706' : '#10b981';
                  return (
                    <div key={r.id} style={{ padding: '0.55rem 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: outColor }}>{displayGlucose(g, glucoseUnit)}</div>
                        <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                          {format(new Date(r.timestamp), 'dd/MM/yyyy HH:mm')}
                          {r.source === 'libreview_csv' && <span style={{ marginLeft: 6, fontSize: 10, background: '#ede9fe', color: '#7c3aed', padding: '1px 5px', borderRadius: 4 }}>LibreView</span>}
                        </div>
                      </div>
                      <div style={{ padding: '0.25rem 0.6rem', borderRadius: 6, background: outBg, color: outColor, fontSize: '0.75rem', fontWeight: 600 }}>
                        {t(`glucose.${r.reading_type}`) || r.reading_type}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {readings.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🩸</div>
              <p style={{ fontSize: 14, margin: 0 }}>{t('glucose.noData')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, color, subtitle }) {
  return (
    <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)', textAlign: 'center' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{value}</div>
      {subtitle && (
        <div style={{ marginTop: '0.4rem', display: 'inline-block', padding: '2px 8px', borderRadius: 9999, background: color + '18', fontSize: '0.7rem', color, fontWeight: 600 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function DistributionBar({ label, pct, count, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.82rem', color: '#555' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700 }}>{pct}% <span style={{ fontWeight: 400, color: '#aaa' }}>({count})</span></span>
      </div>
      <div style={{ background: '#f3f4f6', borderRadius: '4px', height: 8, overflow: 'hidden' }}>
        <div style={{ background: color, height: '100%', width: `${pct}%`, transition: 'width 0.4s', minWidth: pct > 0 ? 4 : 0 }} />
      </div>
    </div>
  );
}
