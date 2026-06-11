import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';

function AllProviders({ children }) {
  return (
    <ThemeProvider>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </ThemeProvider>
  );
}

export function renderWithProviders(ui, options = {}) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from @testing-library/react for convenience
export * from '@testing-library/react';
