// src/tests/ProfilePage.test.jsx
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import ProfilePage from '../pages/ProfilePage';
import api from '../utils/api';

jest.mock('../utils/api', () => ({
  __esModule: true,
  default: {
    get:    jest.fn(),
    post:   jest.fn().mockResolvedValue({ data: {} }),
    put:    jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({}),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    defaults: { headers: { common: {} } },
  },
  calcBMR: function(age, weight, height, sexe) {
    if (sexe === 'h') return Math.round(88.362 + 13.397*weight + 4.799*height - 5.677*age);
    return Math.round(447.593 + 9.247*weight + 3.098*height - 4.330*age);
  },
  calcTDEE: function(bmr, level) {
    var f = { sed:1.2, light:1.375, mod:1.55, actif:1.725 };
    return Math.round(bmr * (f[level] || 1.375));
  },
  calcTarget: function(tdee, goal, pace) {
    var d = { doux:250, modere:500, rapide:750 };
    if (goal==='perte') return tdee-(d[pace]||500);
    if (goal==='prise') return tdee+(d[pace]||350);
    return tdee;
  },
  calcIMC: function(weight, height) {
    return parseFloat((weight/((height/100)*(height/100))).toFixed(1));
  },
  imcStatus: function(imc) {
    if (imc<18.5) return { label:'Insuffisant', color:'#185FA5' };
    if (imc<25)   return { label:'Normal',      color:'#1A6B3C' };
    if (imc<30)   return { label:'Surpoids',    color:'#BA7517' };
    return              { label:'Obésité', color:'#993C1D' };
  },
}));

jest.mock('../store', () => ({
  useProfileStore: function() {
    return {
      profile: {
        age: 30, weight: 70, height: 175, sexe: 'h',
        activity_level: 'mod', sport: 'marche',
        goal: 'maintien', pace: 'modere',
        bmr: 1680, tdee: 2310, target_kcal: 2310, imc: 24.2,
      },
      updateProfile: jest.fn(function() { return Promise.resolve({}); }),
      setProfileLocal: jest.fn(),
    };
  },
  useAuthStore: function() {
    return {
      user: { name: 'Test User', email: 'test@test.com' },
      logout: jest.fn(),
      isAuthenticated: true,
    };
  },
}));

jest.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: function() {
    return {
      permission: 'default',
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
  },
}));

beforeEach(function() {
  api.get.mockResolvedValue({ data: {} });
});

afterEach(function() {
  jest.clearAllMocks();
});

// REG-08: Language selector in ProfilePage
describe('REG-08 — Language selector in ProfilePage', () => {
  test('ProfilePage renders a language selector with FR or EN buttons', function() {
    renderWithProviders(<ProfilePage />);
    // LanguageSelector renders buttons: "عربي", "FR", "EN"
    var frBtn = screen.queryByText(/^FR$/);
    var enBtn = screen.queryByText(/^EN$/);
    expect(frBtn || enBtn).toBeTruthy();
  });

  test('ProfilePage renders a Langue section label', function() {
    renderWithProviders(<ProfilePage />);
    var langLabel = screen.queryByText(/langue/i);
    expect(langLabel).toBeInTheDocument();
  });
});

// REG-09: Dark mode toggle
describe('REG-09 — Dark mode toggle', () => {
  beforeEach(function() {
    document.documentElement.removeAttribute('data-theme');
  });

  test('dark mode toggle exists in ProfilePage', function() {
    renderWithProviders(<ProfilePage />);
    // Look for a toggle: checkbox, data-testid, or button related to dark mode
    var darkToggle =
      document.querySelector('[data-testid="dark-mode-toggle"]') ||
      screen.queryByRole('checkbox', { name: /dark|sombre|nuit|th[e\xe8]me/i }) ||
      screen.queryByLabelText(/dark|sombre|nuit|th[e\xe8]me/i) ||
      screen.queryByRole('button', { name: /dark|sombre|nuit|th[e\xe8]me/i }) ||
      document.querySelector('input[type="checkbox"]');
    expect(darkToggle).toBeTruthy();
  });

  test('dark mode: ThemeProvider sets data-theme on html element on mount', async function() {
    renderWithProviders(<ProfilePage />);
    // ThemeProvider sets data-theme on mount via useEffect
    await waitFor(function() {
      var theme = document.documentElement.getAttribute('data-theme');
      expect(theme).toBeTruthy();
    });
  });
});
