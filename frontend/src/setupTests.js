import '@testing-library/jest-dom';

// matchMedia mock — required by ThemeContext (reads prefers-color-scheme)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// ResizeObserver mock — used by Recharts
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// serviceWorker mock — verified in REG-10
Object.defineProperty(navigator, 'serviceWorker', {
  writable: true,
  value: {
    register: jest.fn().mockResolvedValue({ scope: '/' }),
    ready: Promise.resolve({ unregister: jest.fn() }),
  },
});
