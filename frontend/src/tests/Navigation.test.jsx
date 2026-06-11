// src/tests/Navigation.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../i18n';
import Layout from '../components/Layout';

// Mock CookieBanner (renders nothing so no context issues)
jest.mock('../components/CookieBanner', () => () => null);

function renderNav(initialRoute = '/journal') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <ThemeProvider>
        <LanguageProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="journal" element={<div>Journal content</div>} />
              <Route path="dishes"  element={<div>Base de données</div>} />
              <Route path="stats"   element={<div>Stats content</div>} />
              <Route path="glucose" element={<div>Glucose content</div>} />
              <Route path="profile" element={<div>Profile content</div>} />
            </Route>
          </Routes>
        </LanguageProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('Navigation (REG-02)', () => {
  test('renders exactly 5 nav links', () => {
    renderNav();
    const links = screen.getAllByRole('link');
    const navLinks = links.filter(l =>
      ['/journal', '/dishes', '/stats', '/glucose', '/profile'].includes(l.getAttribute('href'))
    );
    expect(navLinks).toHaveLength(5);
  });

  test('/stats nav link exists and points to stats route', () => {
    renderNav();
    const statsLinks = screen.getAllByRole('link').filter(l => l.getAttribute('href') === '/stats');
    expect(statsLinks.length).toBeGreaterThanOrEqual(1);
  });

  test('no link points to removed routes', () => {
    renderNav();
    const hrefs = screen.getAllByRole('link').map(l => l.getAttribute('href'));
    expect(hrefs).not.toContain('/bilan');
    expect(hrefs).not.toContain('/history');
    expect(hrefs).not.toContain('/scanner');
    expect(hrefs).not.toContain('/products');
    expect(hrefs).not.toContain('/vision');
  });
});
