import React, { useState, lazy, Suspense } from 'react';
import GradientHeader from '../components/GradientHeader';
import { exportBilanPDF } from '../utils/exportPDF';

const BilanPage   = lazy(() => import('./BilanPage'));
const HistoryPage = lazy(() => import('./HistoryPage'));

const TABS = ['Jour', 'Semaine', 'Mois', 'Évolution'];

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState('Jour');
  const isEvolution = activeTab === 'Évolution';

  const handleExport = () => exportBilanPDF('stats-content', 'bilan.pdf');

  return (
    <div style={{ background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: 80 }}>
      <GradientHeader title="Statistiques" icon="📊" variant="emerald">
        <button
          aria-label="Exporter PDF"
          onClick={handleExport}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 9999, width: 36, height: 36, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <i className="ti ti-download" style={{ fontSize: 18 }} />
        </button>
      </GradientHeader>

      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            className={`pill${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <Suspense fallback={<div style={{ padding: 16 }}>Chargement…</div>}>
        {isEvolution
          ? <HistoryPage embedded />
          : <BilanPage embedded activeTabOverride={activeTab} />
        }
      </Suspense>
    </div>
  );
}
