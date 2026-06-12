import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useTranslation } from '../i18n';
import VoiceInput from '../components/VoiceInput';
import { SkeletonCard, SkeletonLine } from '../components/Skeleton';
import useSettingsStore from '../store/useSettingsStore';
import { displayGlucose, inputGlucoseToMgdl, glucosePlaceholder, glucoseThresholds, mgdlToMmol } from '../utils/units';
import GradientHeader from '../components/GradientHeader';
import MetricCard from '../components/MetricCard';
import {
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from 'recharts';

function DistributionBar({ label, pct, count, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700 }}>{pct}% <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({count})</span></span>
      </div>
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-2xs)', height: '8px', overflow: 'hidden' }}>
        <div style={{ background: color, height: '100%', width: `${pct}%`, transition: 'width 0.4s', minWidth: pct > 0 ? 4 : 0 }} />
      </div>
    </div>
  );
}

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
  const [showManual, setShowManual] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => { fetchData(); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setShowManual(false);
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

  const chartData = readings.map(r => ({
    ...r,
    x: new Date(r.timestamp).getTime(),
    y: r.glucose_mg_dl,
  }));

  const targetLow  = glucoseUnit === 'mmol/L' ? 3.9  : 70;
  const targetHigh = glucoseUnit === 'mmol/L' ? 10.0 : 180;

  return (
    <div style={{ paddingBottom: '6rem', background: 'var(--bg-secondary)', minHeight: '100vh' }}>
      {/* Header with period selector */}
      <GradientHeader title="Glycémie" icon="💉" variant="glucose">
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--radius-full)', padding: '3px', gap: '2px' }}>
          {[7, 14, 30].map(days => (
            <button key={days} onClick={() => setPeriod(days)} style={{
              flex: 1, padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
              border: 'none',
              background: period === days ? 'rgba(255,255,255,0.2)' : 'transparent',
              fontWeight: period === days ? 700 : 400,
              color: period === days ? 'white' : 'rgba(255,255,255,0.7)',
              transition: 'all 0.2s',
            }}>
              {days}j
            </button>
          ))}
        </div>
      </GradientHeader>

      {loading ? (
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.7rem', marginBottom: '1rem' }}>
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i}><SkeletonLine height="3rem" /></SkeletonCard>)}
          </div>
          <SkeletonCard>
            <SkeletonLine width="40%" height="1.2rem" style={{ marginBottom: '0.8rem' }} />
            <SkeletonLine height="250px" />
          </SkeletonCard>
        </div>
      ) : (
        <>
          {/* REG-04/05 — Disclaimer non masquable */}
          <div style={{ margin: '0 1rem 1rem', padding: '0.75rem 1rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', borderLeft: '3px solid var(--accent-teal)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {t('glucose.disclaimer')}
            </p>
          </div>

          {/* DEF-06: données insuffisantes < 12 mesures */}
          {metrics && metrics.insufficient_data && (
            <div style={{ margin: '0 1rem 1rem', padding: '0.75rem 1rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                {metrics.message}
              </p>
            </div>
          )}

          {/* MetricCards 2×2 */}
          {metrics && !metrics.insufficient_data && metrics.total_readings > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '0 16px', marginBottom: '8px' }}>
              <MetricCard label={t('glucose.gmiLabel')} value={metrics.gmi} unit="%"
                status={metrics.gmi < 7 ? 'good' : metrics.gmi < 8 ? 'warning' : 'danger'}
                statusText={t('glucose.gmiSubtitle')} />
              <MetricCard label={t('glucose.tir')} value={metrics.tir} unit="%"
                status={metrics.tir > 70 ? 'good' : metrics.tir > 50 ? 'warning' : 'danger'}
                statusText={`${metrics.target_min || 70}-${metrics.target_max || 180} mg/dL`} />
              <MetricCard label={t('glucose.cv')} value={metrics.cv} unit="%"
                status={metrics.cv < 36 ? 'good' : 'warning'}
                statusText="Stabilité" />
              <MetricCard
                label={t('glucose.avg')}
                value={glucoseUnit === 'mmol/L' ? mgdlToMmol(metrics.avg_glucose) : metrics.avg_glucose}
                unit={glucoseUnit}
                status="neutral" />
            </div>
          )}

          {/* REG-05 — Note GMI non diagnostique */}
          {metrics && !metrics.insufficient_data && metrics.total_readings > 0 && (
            <p style={{ margin: '0 1rem 1rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {t('glucose.gmiDisclaimer')}
            </p>
          )}

          {/* Distribution 5 zones */}
          {metrics && !metrics.insufficient_data && metrics.distribution && (
            <div style={{ margin: '0 1.25rem 1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('glucose.distribution')}
              </h3>
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                <DistributionBar label={t('glucose.veryLow')} pct={metrics.distribution.very_low_pct}  count={metrics.distribution.very_low_count}  color="#dc2626" />
                <DistributionBar label={t('glucose.low')}     pct={metrics.distribution.low_pct}       count={metrics.distribution.low_count}       color="#f59e0b" />
                <DistributionBar label={t('glucose.inRange')} pct={metrics.distribution.in_range_pct}  count={metrics.distribution.in_range_count}  color="#10b981" />
                <DistributionBar label={t('glucose.high')}    pct={metrics.distribution.high_pct}      count={metrics.distribution.high_count}      color="#f59e0b" />
                <DistributionBar label={t('glucose.veryHigh')} pct={metrics.distribution.very_high_pct} count={metrics.distribution.very_high_count} color="#dc2626" />
              </div>
            </div>
          )}

          {/* Scatter chart with ReferenceArea */}
          {chartData.length > 0 && (
            <div style={{ margin: '0 1.25rem 1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('glucose.chart')}
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-tertiary)" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={['auto', 'auto']}
                    scale="time"
                    tick={{ fontSize: 'var(--font-size-2xs)', fill: '#aaa' }}
                    tickFormatter={(ms) => format(new Date(ms), 'dd/MM')}
                  />
                  <YAxis dataKey="y" domain={glucoseUnit === 'mmol/L' ? [2, 20] : [40, 320]} tick={{ fontSize: 'var(--font-size-2xs)' }} unit={glucoseUnit === 'mmol/L' ? ' mmol' : ' mg'} width={65} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)' }}>
                          <div style={{ fontWeight: 700 }}>{displayGlucose(d.glucose_mg_dl, glucoseUnit)}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>{format(new Date(d.timestamp), 'dd/MM/yyyy HH:mm')}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>{d.reading_type}</div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceArea y1={targetLow} y2={targetHigh} fill="#10B981" fillOpacity={0.1} />
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

          {/* Recent readings */}
          {readings.length > 0 && (
            <div style={{ margin: '0 1.25rem 1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('glucose.recentReadings')}
              </h3>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {readings.slice(0, 20).map((r) => {
                  const g = r.glucose_mg_dl;
                  const outBg    = g < thresholds.low ? '#fee2e2' : g > thresholds.targetHigh ? '#fef3c7' : '#dcfce7';
                  const outColor = g < thresholds.low ? '#dc2626' : g > thresholds.targetHigh ? '#d97706' : '#10b981';
                  return (
                    <div key={r.id} style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: outColor }}>{displayGlucose(g, glucoseUnit)}</div>
                        <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                          {format(new Date(r.timestamp), 'dd/MM/yyyy HH:mm')}
                          {r.source === 'libreview_csv' && <span style={{ marginLeft: 6, fontSize: 'var(--font-size-2xs)', background: '#ede9fe', color: '#7c3aed', padding: '1px 5px', borderRadius: 'var(--radius-2xs)' }}>LibreView</span>}
                        </div>
                      </div>
                      <div style={{ padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-xs)', background: outBg, color: outColor, fontSize: '0.75rem', fontWeight: 600 }}>
                        {t(`glucose.${r.reading_type}`) || r.reading_type}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {readings.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 'var(--icon-xl)', marginBottom: 12 }}>🩸</div>
              <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>{t('glucose.noData')}</p>
            </div>
          )}
        </>
      )}

      {/* Bottom action buttons */}
      <div style={{ padding: '0 1.25rem 0.75rem', display: 'flex', gap: '12px' }}>
        <button onClick={() => { setShowManual(!showManual); setShowImport(false); }} style={{
          flex: 1, padding: '0.85rem', borderRadius: 'var(--radius-md)', border: 'none',
          background: 'rgba(99,102,241,0.1)', color: 'var(--accent-blue)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
        }}>+ Saisie manuelle</button>
        <button onClick={() => { setShowImport(!showImport); setShowManual(false); }} style={{
          flex: 1, padding: '0.85rem', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
          color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
        }}>Import LibreView CSV</button>
      </div>

      {/* Manual entry form */}
      {showManual && (
        <div className="card" style={{ margin: '16px' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            ➕ {t('glucose.manualEntry')}
          </h3>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="number" step="1"
              placeholder={glucosePlaceholder(glucoseUnit)}
              value={glucoseValue}
              onChange={(e) => setGlucoseValue(e.target.value)}
              style={{ flex: '1 1 140px', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '1rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            />
            <select
              value={readingType}
              onChange={(e) => setReadingType(e.target.value)}
              style={{ flex: '1 1 140px', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              <option value="fasting">{t('glucose.fasting')}</option>
              <option value="pre_meal">{t('glucose.preMeal')}</option>
              <option value="post_meal">{t('glucose.postMeal')}</option>
              <option value="bedtime">{t('glucose.bedtime')}</option>
              <option value="random">{t('glucose.random')}</option>
            </select>
            <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 100%' }}>
              <button type="submit" style={{
                flex: 1, padding: '0.7rem 1.5rem',
                background: 'rgba(99,102,241,0.1)', color: 'var(--accent-blue)',
                border: 'none', borderRadius: 'var(--radius-full)', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem',
              }}>
                {t('glucose.add')}
              </button>
              <VoiceInput context="glucose" onResult={handleVoiceGlucose} showTranscript={false} buttonStyle={{ padding: '0.6rem 1rem' }} />
            </div>
          </form>
        </div>
      )}

      {/* CSV import */}
      {showImport && (
        <div style={{ margin: '0 1.25rem 1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px var(--shadow)' }}>
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            📂 {t('glucose.importCSV')}
          </h3>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {t('glucose.importHelp')}
          </p>
          <input
            type="file" accept=".csv"
            onChange={handleCSVImport}
            disabled={importing}
            style={{ padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', width: '100%', fontSize: '0.85rem', boxSizing: 'border-box', background: 'var(--bg-secondary)' }}
          />
          {importing && <p style={{ marginTop: '0.5rem', color: 'var(--accent-blue)', fontSize: '0.85rem' }}>Import en cours...</p>}
        </div>
      )}
    </div>
  );
}
