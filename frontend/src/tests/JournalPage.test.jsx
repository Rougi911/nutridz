// src/tests/JournalPage.test.jsx
import React from 'react';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import JournalPage from '../pages/JournalPage';
import api from '../utils/api';

// API mock
jest.mock('../utils/api', () => ({
  __esModule: true,
  default: {
    get:    jest.fn().mockResolvedValue({ data: {} }),
    post:   jest.fn().mockResolvedValue({ data: { id: 1 } }),
    delete: jest.fn().mockResolvedValue({}),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    defaults: { headers: { common: {} } },
  },
}));

// Store mocks — adapted to actual store shape
jest.mock('../store', () => ({
  useJournalStore: () => ({
    date: '2026-06-10',
    meals: { pdej: [], dej: [], coll: [], diner: [] },
    totals: { kcal: 0, proteines: 0, glucides: 0, lipides: 0, fibres: 0 },
    loading: false,
    fetchJournal: jest.fn(),
    removeEntry: jest.fn(),
    setDate: jest.fn(),
  }),
  useProfileStore: () => ({ profile: { target_kcal: 2000 } }),
  useAuthStore:    () => ({ user: { name: 'Test' }, isAuthenticated: true }),
}));

jest.mock('../store/useSettingsStore', () => () => ({ weightUnit: 'kg' }));

// Capture callbacks so we can simulate scanner/vision results
let capturedOnDetected = null;
jest.mock('../components/BarcodeScanner', () => ({ onDetected, onClose }) => {
  capturedOnDetected = onDetected;
  return <div data-testid="barcode-scanner">Scanner actif</div>;
});

let capturedVisionOnResult = null;
jest.mock('../pages/FoodVisionPage', () => ({ onResult, onClose }) => {
  capturedVisionOnResult = onResult;
  return <div data-testid="food-vision">Vision active</div>;
});

jest.mock('../components/VoiceInput', () => ({ onResult }) => (
  <div data-testid="voice-input">Voice actif</div>
));

jest.mock('../components/VoiceFoodModal', () => () => (
  <div data-testid="voice-food-modal">VoiceFoodModal</div>
));

jest.mock('../components/Skeleton', () => ({
  SkeletonLine: () => <div data-testid="skeleton-line" />,
  SkeletonCard: ({ children }) => <div data-testid="skeleton-card">{children}</div>,
}));

beforeEach(() => {
  capturedOnDetected = null;
  capturedVisionOnResult = null;
  // Mock weight API to return empty arrays
  api.get.mockResolvedValue({ data: [] });
  api.post.mockResolvedValue({ data: { id: 1 } });
});

describe('JournalPage — REG-03 Scanner', () => {
  test('scanner button opens BarcodeScanner overlay', async () => {
    renderWithProviders(<JournalPage />);
    // The GradientHeader scanner button has aria-label="Scanner" and is the first in DOM
    const scanBtns = screen.getAllByRole('button', { name: /^scanner$/i });
    // Click the first one (GradientHeader button, not the nav quick-action)
    userEvent.click(scanBtns[0]);
    await waitFor(() => {
      expect(screen.getByTestId('barcode-scanner')).toBeInTheDocument();
    });
  });

  test('scan result triggers api.post to /journal', async () => {
    // Mock barcode lookup returning a product
    api.get.mockImplementation((url) => {
      if (url.includes('barcode')) return Promise.resolve({ data: { id: 99, name: 'Produit test', calories: 100 } });
      return Promise.resolve({ data: [] });
    });
    renderWithProviders(<JournalPage />);
    const scanBtns = screen.getAllByRole('button', { name: /^scanner$/i });
    userEvent.click(scanBtns[0]);
    await waitFor(() => screen.getByTestId('barcode-scanner'));
    await act(async () => {
      // BarcodeScanner passes a string code directly (not an object with codeResult)
      capturedOnDetected?.('3017620422003');
    });
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        expect.stringContaining('journal'),
        expect.any(Object)
      );
    });
  });
});

describe('JournalPage — REG-04 Vision', () => {
  test('vision button opens FoodVisionPage overlay', async () => {
    renderWithProviders(<JournalPage />);
    const visionBtn = screen.getByRole('button', { name: /photo/i });
    userEvent.click(visionBtn);
    await waitFor(() => {
      expect(screen.getByTestId('food-vision')).toBeInTheDocument();
    });
  });

  test('vision result triggers api.post to /journal', async () => {
    renderWithProviders(<JournalPage />);
    userEvent.click(screen.getByRole('button', { name: /photo/i }));
    await waitFor(() => screen.getByTestId('food-vision'));
    await act(async () => {
      capturedVisionOnResult?.({ name: 'Salade', calories: 50, product_id: 42 });
    });
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        expect.stringContaining('journal'),
        expect.any(Object)
      );
    });
  });
});

describe('JournalPage — REG-05 Voice', () => {
  test('voice button opens VoiceInput overlay', async () => {
    renderWithProviders(<JournalPage />);
    // Use exact aria-label "Voix" for the header button
    const voiceBtn = screen.getByRole('button', { name: 'Voix' });
    userEvent.click(voiceBtn);
    await waitFor(() => {
      // After click, at least one voice-input testid should exist in the modal
      const voiceInputs = screen.getAllByTestId('voice-input');
      expect(voiceInputs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
