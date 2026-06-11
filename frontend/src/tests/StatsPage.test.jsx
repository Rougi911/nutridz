// src/tests/StatsPage.test.jsx
import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import StatsPage from '../pages/StatsPage';
import { exportBilanPDF } from '../utils/exportPDF';

// ── API mock ──────────────────────────────────────────────────────────────────
// BilanPage imports calcBMR/calcTDEE/calcTarget as named exports + default axios instance
jest.mock('../utils/api', () => {
  const instance = {
    get:    jest.fn().mockResolvedValue({ data: [] }),
    post:   jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    defaults: { headers: { common: {} } },
  };
  return {
    __esModule: true,
    default: instance,
    calcBMR:      jest.fn().mockReturnValue(1700),
    calcTDEE:     jest.fn().mockReturnValue(2200),
    calcTarget:   jest.fn().mockReturnValue(2000),
    calcWalkTime: jest.fn().mockReturnValue(0),
  };
});

// ── exportPDF mock ────────────────────────────────────────────────────────────
jest.mock('../utils/exportPDF', () => ({
  exportBilanPDF: jest.fn().mockResolvedValue(undefined),
}));

// ── Store mocks ───────────────────────────────────────────────────────────────
const MOCK_PROFILE = {
  target_kcal: 2000,
  goal: 'maintien',
  age: 30,
  weight: 70,
  height: 170,
  sexe: 'h',
  activity_level: 'light',
  pace: 'modere',
};

jest.mock('../store', () => ({
  useJournalStore: () => ({
    history: [],
    fetchHistory: jest.fn(),
    date: '2026-06-10',
    meals: {},
    totals: {},
    loading: false,
    fetchJournal: jest.fn(),
  }),
  // Supports both selector and no-arg call patterns (BilanPage uses selector, HistoryPage uses destructure)
  useProfileStore: (selector) => {
    const store = { profile: MOCK_PROFILE };
    return typeof selector === 'function' ? selector(store) : store;
  },
  useActivityStore: () => ({
    bilan: null,
    weeklyStats: null,
    monthlyStats: null,
    loading: false,
    fetchBilan: jest.fn(),
    fetchWeeklyStats: jest.fn(),
    fetchMonthlyStats: jest.fn(),
    addActivity: jest.fn(),
    fetchStravaToday: jest.fn(),
    getStravaAuthUrl: jest.fn(),
  }),
  useAuthStore: () => ({
    user: { name: 'Test' },
    isAuthenticated: true,
    initAuth: jest.fn(),
  }),
}));

jest.mock('../store/useSettingsStore', () => () => ({ weightUnit: 'kg' }));

// ── Component mocks ───────────────────────────────────────────────────────────
jest.mock('../components/ActivityForm', () => () => (
  <div data-testid="activity-form">ActivityForm</div>
));

// ─────────────────────────────────────────────────────────────────────────────

describe('StatsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders Stats screen with 4 tab buttons', async () => {
    renderWithProviders(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByText('Statistiques')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Jour' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semaine' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mois' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Évolution' })).toBeInTheDocument();
  });

  test('default Jour tab renders BilanPage content', async () => {
    renderWithProviders(<StatsPage />);

    // BilanPage always renders the Strava connection card in the Jour view.
    // With bilan=null, stravaConnected=false so "Strava non connecté" is always shown.
    await waitFor(() => {
      expect(screen.getByText('Strava non connecté')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('switching to Évolution tab renders HistoryPage content', async () => {
    renderWithProviders(<StatsPage />);

    // Wait for initial render with BilanPage content
    await waitFor(() => {
      expect(screen.getByText('Strava non connecté')).toBeInTheDocument();
    }, { timeout: 3000 });

    // BilanPage also renders an inner 'Évolution' tab — take the first (outer StatsPage pill)
    const evolutionBtn = screen.getAllByRole('button', { name: 'Évolution' })[0];
    userEvent.click(evolutionBtn);

    // HistoryPage always renders its stats summary cards regardless of data.
    // The label 'Moy. calories/j' (t('history.avgKcal')) is always present.
    await waitFor(() => {
      expect(screen.getByText('Moy. calories/j')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('PDF export button triggers exportBilanPDF', async () => {
    renderWithProviders(<StatsPage />);

    // StatsPage now renders its own PDF export button in the GradientHeader.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /exporter pdf/i })).toBeInTheDocument();
    }, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: /exporter pdf/i }));
    expect(exportBilanPDF).toHaveBeenCalled();
  });
});
