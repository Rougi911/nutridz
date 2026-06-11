// src/tests/BaselineReg.test.jsx
// Baseline regression tests that must survive restyling.
// REG-01: LoginPage renders email + password fields and a submit button
// REG-10: navigator.serviceWorker.register is mocked and available (setupTests.js)

import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import LoginPage from '../pages/LoginPage';

// ── Mock api ──────────────────────────────────────────────────────────────────
// LoginPage's useAuthStore calls api.post via login()
jest.mock('../utils/api', () => ({
  __esModule: true,
  default: {
    get:    jest.fn().mockResolvedValue({ data: {} }),
    post:   jest.fn().mockResolvedValue({ data: { token: 'test-jwt', user: { id: 1 } } }),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    defaults: { headers: { common: {} } },
  },
}));

// ── Mock store ────────────────────────────────────────────────────────────────
// LoginPage imports useAuthStore from '../store'
jest.mock('../store', () => ({
  useAuthStore: () => ({
    login: jest.fn(),
    isAuthenticated: false,
    initAuth: jest.fn(),
    user: null,
  }),
}));

// ── Mock LanguageSelector ──────────────────────────────────────────────────────
// Avoids any internal complexity of LanguageSelector during these tests
jest.mock('../components/LanguageSelector', () => () => (
  <div data-testid="language-selector" />
));

// ─────────────────────────────────────────────────────────────────────────────
// REG-01 — Auth
// ─────────────────────────────────────────────────────────────────────────────
describe('REG-01 — Auth', () => {
  test('LoginPage renders email field', () => {
    const { container } = renderWithProviders(<LoginPage />);

    // The email input has type="email" — query by DOM attribute
    // (Labels have no htmlFor so getByLabelText won't resolve them)
    const emailField =
      container.querySelector('input[type="email"]') ||
      screen.queryByPlaceholderText(/email/i) ||
      screen.queryByLabelText(/email/i);

    expect(emailField).toBeInTheDocument();
  });

  test('LoginPage renders password field', () => {
    const { container } = renderWithProviders(<LoginPage />);

    // The password input has type="password"
    const passwordField =
      container.querySelector('input[type="password"]') ||
      screen.queryByPlaceholderText(/mot de passe|password/i) ||
      screen.queryByLabelText(/mot de passe|password/i);

    expect(passwordField).toBeInTheDocument();
  });

  test('LoginPage has a submit button', () => {
    renderWithProviders(<LoginPage />);

    // Button text from i18n fr: auth.login.submit = 'Se connecter'
    expect(
      screen.getByRole('button', { name: /se connecter|connexion|login|soumettre/i })
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REG-10 — PWA Service Worker
// ─────────────────────────────────────────────────────────────────────────────
describe('REG-10 — PWA', () => {
  test('navigator.serviceWorker.register is mocked and available', () => {
    expect(typeof navigator.serviceWorker.register).toBe('function');
  });
});
