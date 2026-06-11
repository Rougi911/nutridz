// These tests capture current behavior of pages that will be moved or removed.
// Run → expect GREEN. After Tasks 7b-7f restructure routes, Task 7g verifies all green again.

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../i18n';
import BilanPage from '../pages/BilanPage';
import HistoryPage from '../pages/HistoryPage';
import ProductsPage from '../pages/ProductsPage';

// ── API mock ─────────────────────────────────────────────────────────────────
// BilanPage imports calcBMR/calcTDEE/calcTarget as named exports from '../utils/api'
// in addition to using the default axios instance for HTTP calls.
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

// ── Store mocks ───────────────────────────────────────────────────────────────
// useProfileStore supports two calling styles used across the pages:
//   1) const profile = useProfileStore(s => s.profile)   (BilanPage, ActivityForm)
//   2) const { profile } = useProfileStore()              (HistoryPage)
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
  // Supports both selector and no-arg call patterns
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
  // Returns one product so the ProductsPage test can find it
  useProductsStore: () => ({
    products: [
      { id: 1, name: 'Lait entier', kcal_per100: 61, brand: 'Candia', score: 'B', emoji: '🥛' },
    ],
    total: 1,
    loading: false,
    fetchProducts: jest.fn(),
  }),
}));

jest.mock('../store/useSettingsStore', () => () => ({ weightUnit: 'kg' }));

// ── Component / util mocks ────────────────────────────────────────────────────
jest.mock('../components/ActivityForm', () => () => (
  <div data-testid="activity-form">ActivityForm</div>
));

jest.mock('../components/BarcodeScanner', () => () => (
  <div data-testid="barcode-scanner">Scanner actif</div>
));

jest.mock('../utils/exportPDF', () => ({
  exportBilanPDF: jest.fn().mockResolvedValue(undefined),
}));

// ── Render helper ─────────────────────────────────────────────────────────────
function renderPage(Component) {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <LanguageProvider>
          <Component />
        </LanguageProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Pre-restructure baseline (current structure, GREEN before migration)', () => {
  // BilanPage — currently standalone at /bilan, will move inside StatsPage
  test('BilanPage mounts and renders content (current /bilan)', async () => {
    renderPage(BilanPage);
    await waitFor(() => {
      expect(document.body.textContent.length).toBeGreaterThan(10);
    });
  });

  // HistoryPage — currently standalone at /history, will move inside StatsPage
  test('HistoryPage mounts and renders content (current /history)', async () => {
    renderPage(HistoryPage);
    await waitFor(() => {
      expect(document.body.textContent.length).toBeGreaterThan(10);
    });
  });

  // ProductsPage — currently at /products, will be absorbed into DishesPage
  test('ProductsPage mounts and shows product list (current /products)', async () => {
    renderPage(ProductsPage);
    await waitFor(() => {
      expect(screen.getByText('Lait entier')).toBeInTheDocument();
    });
  });
});
