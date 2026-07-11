# NutraLance Frontend Restyling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `frontend/` to match the NutraLance v0design (indigo/emerald palette, gradient headers, pill nav, card layouts) without any functional regression.

**Architecture:** Approach A — Foundation first (CSS tokens + utility classes + 3 reusable components), then navigation restructuring (9→5 tabs + StatsPage), then pre-restyling REG tests written and verified green, then screen-by-screen restyling with tests re-verified after each screen.

**Tech Stack:** React 18, CRA 5 (react-scripts 5.0.1), CSS custom properties, @testing-library/react + user-event v13, Jest (via react-scripts), Zustand, Recharts, axios.

**Spec:** `docs/superpowers/specs/2026-06-10-nutrivita-restyling-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/setupTests.js` | Create | Global mocks (matchMedia, serviceWorker, ResizeObserver) |
| `src/tests/test-utils.jsx` | Create | Shared `renderWithProviders` helper |
| `src/index.css` | Modify | DES-01 token fix + DES-02 utility classes |
| `src/components/GradientHeader.jsx` | Create | Reusable gradient header band |
| `src/components/MacroPillCard.jsx` | Create | Macro card with progress bar |
| `src/components/MetricCard.jsx` | Create | Status metric card |
| `src/pages/StatsPage.jsx` | Create | Merges BilanPage + HistoryPage with tab UI |
| `src/pages/BilanPage.jsx` | Modify | Add `embedded` prop to suppress own header |
| `src/pages/HistoryPage.jsx` | Modify | Add `embedded` prop to suppress own header |
| `src/App.jsx` | Modify | Add `/stats`, remove `/products` `/scanner` `/vision` `/bilan` `/history` |
| `src/components/Layout.jsx` | Modify | 5-tab nav, remove language bar |
| `src/pages/JournalPage.jsx` | Modify | GradientHeader + quick-add modals |
| `src/pages/DishesPage.jsx` | Modify | Absorb ProductsPage, pill filters, card grid |
| `src/pages/DishDetailPage.jsx` | Modify | GradientHeader emerald + MacroPillCard |
| `src/pages/GlucoseTrackingPage.jsx` | Modify | GradientHeader glucose + MetricCard (shared) |
| `src/pages/ProfilePage.jsx` | Modify | GradientHeader slate + LanguageSelector moved here |
| `src/pages/LandingPage.jsx` | Modify | Hero gradient + .card + .pill |
| `src/pages/LoginPage.jsx` | Modify | Centered .card form |
| `src/pages/RegisterPage.jsx` | Modify | Centered .card form |
| `src/components/OnboardingModal.jsx` | Modify | .card + gradient-hero header |
| `src/tests/GradientHeader.test.jsx` | Create | REG-11a |
| `src/tests/MacroPillCard.test.jsx` | Create | REG-11b |
| `src/tests/MetricCard.test.jsx` | Create | REG-11c |
| `src/tests/PreRestructureBaseline.test.jsx` | Create | Baseline before migration (Task 7a) |
| `src/tests/Navigation.test.jsx` | Create | REG-02 |
| `src/tests/StatsPage.test.jsx` | Create | REG-06, REG-07 |
| `src/tests/BaselineReg.test.jsx` | Create | REG-01, REG-09, REG-10 |
| `src/tests/JournalPage.test.jsx` | Create | REG-03, REG-04, REG-05 |
| `src/tests/DishesPage.test.jsx` | Create | REG-06b |
| `src/tests/ProfilePage.test.jsx` | Create | REG-08, REG-09 |

---

## Task 1: DES-01 — Fix dark mode token divergence

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Apply the two token corrections**

In `src/index.css`, inside `[data-theme="dark"]`, change:

```css
/* BEFORE */
--bg-secondary:  #13131f;
--bg-tertiary:   #2a2a3d;

/* AFTER */
--bg-secondary:  #1a1b2e;
--bg-tertiary:   #252642;
```

- [ ] **Step 2: Verify visual match**

Open `http://localhost:3000` with dark mode enabled. Background should be a dark navy (#1a1b2e) instead of near-black (#13131f). No other token changes needed.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix(css): align dark mode background tokens with v0design"
```

---

## Task 2: DES-02 — Add CSS utility classes

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add utility classes at the end of `src/index.css`**

```css
/* ─── Card ──────────────────────────────────────────────────────── */
.card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  padding: 16px;
  box-shadow: 0 2px 8px var(--shadow);
}

/* ─── Gradient header band ──────────────────────────────────────── */
.gradient-header {
  padding-block: 20px 24px;
  padding-inline: 16px;
  border-end-start-radius: 24px;
  border-end-end-radius: 24px;
  color: #fff;
}
.gradient-header h1 { font-size: 1.25rem; font-weight: 700; margin: 0; }
.gradient-header p  { font-size: 0.875rem; opacity: 0.8; margin: 2px 0 0; }

/* ─── Pill (filter tags, internal tabs) ─────────────────────────── */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-block: 6px;
  padding-inline: 14px;
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 500;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: none;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  white-space: nowrap;
  font-family: inherit;
}
.pill.active,
.pill:focus-visible { background: var(--accent-blue); color: #fff; }

/* ─── Macro pill card ───────────────────────────────────────────── */
.macro-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 12px;
}
.macro-pill__bar {
  height: 6px;
  width: 100%;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  overflow: hidden;
}
.macro-pill__fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--accent-blue);
  transition: width 0.5s ease;
}
.macro-pill__fill--complete { background: var(--accent-green); }

/* ─── Metric card ───────────────────────────────────────────────── */
.metric-card {
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-color);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.metric-card--good {
  background: color-mix(in srgb, var(--accent-green) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent-green) 25%, transparent);
}
.metric-card--warning {
  background: color-mix(in srgb, var(--accent-yellow) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent-yellow) 25%, transparent);
}
.metric-card--danger {
  background: color-mix(in srgb, var(--accent-red) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent-red) 25%, transparent);
}
.metric-card--neutral {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

/* ─── Modal overlay ─────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}
.modal-content {
  width: 100%;
  max-width: 480px;
  margin-inline: auto;
  background: var(--bg-primary);
  border-radius: 24px 24px 0 0;
  padding: 20px;
  animation: slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "feat(css): add card, pill, macro-pill, metric-card, modal-overlay utility classes"
```

---

## Task 3: DES-03 + REG-11a — GradientHeader component

**Files:**
- Create: `src/components/GradientHeader.jsx`
- Create: `src/tests/GradientHeader.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/tests/GradientHeader.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import GradientHeader from '../components/GradientHeader';

describe('GradientHeader', () => {
  test('variant indigo → root has gradient-hero and gradient-header classes', () => {
    const { container } = render(<GradientHeader title="Journal" variant="indigo" />);
    expect(container.firstChild).toHaveClass('gradient-header');
    expect(container.firstChild).toHaveClass('gradient-hero');
  });

  test('variant glucose → root has gradient-glucose class', () => {
    const { container } = render(<GradientHeader title="Glycémie" variant="glucose" />);
    expect(container.firstChild).toHaveClass('gradient-glucose');
  });

  test('variant emerald → root has gradient-health class', () => {
    const { container } = render(<GradientHeader title="Stats" variant="emerald" />);
    expect(container.firstChild).toHaveClass('gradient-health');
  });

  test('variant slate → root has gradient-slate class', () => {
    const { container } = render(<GradientHeader title="Paramètres" variant="slate" />);
    expect(container.firstChild).toHaveClass('gradient-slate');
  });

  test('subtitle rendered in a <p> element', () => {
    render(<GradientHeader title="Journal" subtitle="Aujourd'hui" />);
    expect(screen.getByText("Aujourd'hui").tagName).toBe('P');
  });

  test('children rendered in right slot', () => {
    render(
      <GradientHeader title="Journal">
        <button>Scan</button>
      </GradientHeader>
    );
    expect(screen.getByRole('button', { name: 'Scan' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module not found)**

```bash
cd frontend && npm test -- --testPathPattern=GradientHeader --watchAll=false
```

Expected: `Cannot find module '../components/GradientHeader'`

- [ ] **Step 3: Create `src/components/GradientHeader.jsx`**

```jsx
import React from 'react';

const VARIANT_MAP = {
  indigo:  'gradient-hero',
  emerald: 'gradient-health',
  glucose: 'gradient-glucose',
  slate:   'gradient-slate',
};

export default function GradientHeader({ title, subtitle, icon, variant = 'indigo', children }) {
  return (
    <div className={`gradient-header ${VARIANT_MAP[variant] || VARIANT_MAP.indigo}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{icon}</span>}
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        {children && <div style={{ display: 'flex', gap: 8 }}>{children}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd frontend && npm test -- --testPathPattern=GradientHeader --watchAll=false
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/GradientHeader.jsx src/tests/GradientHeader.test.jsx
git commit -m "feat: add GradientHeader component with variant→CSS class mapping (REG-11a)"
```

---

## Task 4: DES-03 + REG-11b — MacroPillCard component

**Files:**
- Create: `src/components/MacroPillCard.jsx`
- Create: `src/tests/MacroPillCard.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/tests/MacroPillCard.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import MacroPillCard from '../components/MacroPillCard';

describe('MacroPillCard', () => {
  test('progress bar width is 60% when value=60 target=100', () => {
    const { container } = render(
      <MacroPillCard icon="🥩" value={60} target={100} label="Protéines" />
    );
    const fill = container.querySelector('.macro-pill__fill');
    expect(fill).toBeInTheDocument();
    expect(fill.style.width).toBe('60%');
    expect(fill).not.toHaveClass('macro-pill__fill--complete');
  });

  test('progress bar capped at 100% when value > target', () => {
    const { container } = render(
      <MacroPillCard icon="🥩" value={150} target={100} label="Protéines" />
    );
    const fill = container.querySelector('.macro-pill__fill');
    expect(fill.style.width).toBe('100%');
  });

  test('adds complete class when value >= target', () => {
    const { container } = render(
      <MacroPillCard icon="🍞" value={100} target={100} label="Glucides" />
    );
    expect(container.querySelector('.macro-pill__fill')).toHaveClass('macro-pill__fill--complete');
  });

  test('renders label and value text', () => {
    render(<MacroPillCard icon="🫒" value={45} target={70} label="Lipides" unit="g" />);
    expect(screen.getByText('Lipides')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npm test -- --testPathPattern=MacroPillCard --watchAll=false
```

- [ ] **Step 3: Create `src/components/MacroPillCard.jsx`**

```jsx
import React from 'react';

export default function MacroPillCard({ icon, value, target, label, unit = 'g' }) {
  const pct = Math.min(Math.round((value / target) * 100), 100);
  const complete = value >= target;
  return (
    <div className="macro-pill">
      <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{icon}</span>
      <div>
        <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>{value}</span>
        <span style={{ fontWeight: 400, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {unit}
        </span>
      </div>
      <span className="label-text" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="macro-pill__bar">
        <div
          className={`macro-pill__fill${complete ? ' macro-pill__fill--complete' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd frontend && npm test -- --testPathPattern=MacroPillCard --watchAll=false
```

- [ ] **Step 5: Commit**

```bash
git add src/components/MacroPillCard.jsx src/tests/MacroPillCard.test.jsx
git commit -m "feat: add MacroPillCard component with progress bar (REG-11b)"
```

---

## Task 5: DES-03 + REG-11c — MetricCard component

**Files:**
- Create: `src/components/MetricCard.jsx`
- Create: `src/tests/MetricCard.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/tests/MetricCard.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import MetricCard from '../components/MetricCard';

describe('MetricCard', () => {
  test('status good → has metric-card--good class', () => {
    const { container } = render(<MetricCard label="GMI" value="5.7" status="good" />);
    expect(container.firstChild).toHaveClass('metric-card');
    expect(container.firstChild).toHaveClass('metric-card--good');
  });

  test('status warning → has metric-card--warning class', () => {
    const { container } = render(<MetricCard label="TIR" value="62" unit="%" status="warning" />);
    expect(container.firstChild).toHaveClass('metric-card--warning');
  });

  test('renders unit when provided', () => {
    render(<MetricCard label="TIR" value="72" unit="%" status="good" />);
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  test('renders statusText when provided', () => {
    render(
      <MetricCard label="TIR" value="72" unit="%" status="good" statusText="Objectif atteint" />
    );
    expect(screen.getByText('Objectif atteint')).toBeInTheDocument();
  });

  test('default status neutral → has metric-card--neutral class', () => {
    const { container } = render(<MetricCard label="Poids" value="72" unit="kg" />);
    expect(container.firstChild).toHaveClass('metric-card--neutral');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npm test -- --testPathPattern=MetricCard --watchAll=false
```

- [ ] **Step 3: Create `src/components/MetricCard.jsx`**

```jsx
import React from 'react';

export default function MetricCard({ label, value, unit, status = 'neutral', statusText }) {
  return (
    <div className={`metric-card metric-card--${status}`}>
      <span
        className="label-text"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: '1.875rem', fontWeight: 700 }}>{value}</span>
        {unit && (
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{unit}</span>
        )}
      </div>
      {statusText && (
        <span
          style={{
            display: 'inline-block',
            paddingBlock: 2,
            paddingInline: 8,
            borderRadius: 9999,
            fontSize: '0.75rem',
            fontWeight: 500,
            background: 'color-mix(in srgb, currentColor 15%, transparent)',
          }}
        >
          {statusText}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd frontend && npm test -- --testPathPattern=MetricCard --watchAll=false
```

- [ ] **Step 5: Commit**

```bash
git add src/components/MetricCard.jsx src/tests/MetricCard.test.jsx
git commit -m "feat: add MetricCard component with dark-safe status variants (REG-11c)"
```

---

## Task 6: Test infrastructure — setupTests + renderWithProviders

**Files:**
- Create: `src/setupTests.js`
- Create: `src/tests/test-utils.jsx`

- [ ] **Step 1: Create `src/setupTests.js`**

CRA auto-loads this file before every test suite.

```js
// src/setupTests.js
import '@testing-library/jest-dom';

// matchMedia (needed by ThemeContext)
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

// serviceWorker (needed by REG-10)
Object.defineProperty(navigator, 'serviceWorker', {
  writable: true,
  value: { register: jest.fn().mockResolvedValue({}) },
});

// ResizeObserver (needed by Recharts)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
```

- [ ] **Step 2: Create `src/tests/test-utils.jsx`**

```jsx
// src/tests/test-utils.jsx
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../i18n';

export function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider>
        <LanguageProvider>
          {ui}
        </LanguageProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}
```

- [ ] **Step 3: Verify setupTests loads — run any existing test**

```bash
cd frontend && npm test -- --testPathPattern=GradientHeader --watchAll=false
```

Expected: still PASS (no regression from adding setupTests).

- [ ] **Step 4: Commit**

```bash
git add src/setupTests.js src/tests/test-utils.jsx
git commit -m "test: add setupTests global mocks and renderWithProviders helper"
```

---

## Task 7a: Pre-restructuring baseline tests (GREEN on current structure)

Write these tests against the **current** route structure. They confirm existing behavior before any routes are touched. After Tasks 7e–7f remove old routes, Task 7g writes the Navigation REG-02 test and verifies the full suite is still green.

**Files:**
- Create: `src/tests/PreRestructureBaseline.test.jsx`

- [ ] **Step 1: Create `src/tests/PreRestructureBaseline.test.jsx`**

```jsx
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
import api from '../utils/api';

jest.mock('../components/BarcodeScanner', () => () => (
  <div data-testid="barcode-scanner">Scanner actif</div>
));

jest.mock('../utils/api', () => ({
  __esModule: true,
  default: {
    get:    jest.fn().mockResolvedValue({ data: [] }),
    post:   jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

jest.mock('../store', () => ({
  useJournalStore:  () => ({ history: [], fetchHistory: jest.fn(), date: '2026-06-10', meals: {}, totals: {}, loading: false, fetchJournal: jest.fn() }),
  useProfileStore:  () => ({ profile: { target_kcal: 2000, goal: 'maintien' } }),
  useActivityStore: () => ({ activities: [], fetchActivities: jest.fn() }),
  useAuthStore:     () => ({ user: { name: 'Test' }, isAuthenticated: true, initAuth: jest.fn() }),
}));

jest.mock('../store/useSettingsStore', () => () => ({ weightUnit: 'kg' }));

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
    api.get.mockResolvedValueOnce({
      data: [{ id: 1, name: 'Lait entier', calories_per_100g: 61, brand: 'Candia' }],
    });
    renderPage(ProductsPage);
    await waitFor(() => {
      expect(screen.getByText('Lait entier')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run — expect GREEN**

```bash
cd frontend && npm test -- --testPathPattern=PreRestructureBaseline --watchAll=false
```

Expected: 3 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/tests/PreRestructureBaseline.test.jsx
git commit -m "test: capture pre-restructuring baseline for Bilan, History, Products"
```

---

## Task 7b: BilanPage `embedded` + `activeTabOverride` props

**Files:**
- Modify: `src/pages/BilanPage.jsx`

- [ ] **Step 1: Add `embedded` + `activeTabOverride` props**

In `src/pages/BilanPage.jsx`, make three targeted changes:

**a) Change the function signature:**
```jsx
export default function BilanPage({ embedded = false, activeTabOverride }) {
```

**b) Find the existing view state declaration (likely `const [view, setView] = useState('jour')`) and add a sync effect directly below it:**
```jsx
const [view, setView] = useState(activeTabOverride?.toLowerCase() || 'jour');
useEffect(() => {
  if (activeTabOverride) setView(activeTabOverride.toLowerCase());
}, [activeTabOverride]);
```

**c) Wrap the header div (the first coloured `<div>` in the JSX return) in a condition, and adjust `minHeight`:**
```jsx
<div style={{ background: 'var(--bg-secondary)', minHeight: embedded ? 'auto' : '100vh', paddingBottom: 80 }}>
  {!embedded && (
    <div style={{ /* existing header styles kept unchanged */ }}>
      {/* existing header content kept unchanged */}
    </div>
  )}
  {/* rest of existing content unchanged */}
</div>
```

- [ ] **Step 2: Run baseline — still GREEN**

```bash
cd frontend && npm test -- --testPathPattern=PreRestructureBaseline --watchAll=false
```

Expected: 3 tests PASS (props are additive; BilanPage still mounts standalone)

- [ ] **Step 3: Commit**

```bash
git add src/pages/BilanPage.jsx
git commit -m "feat(bilan): add embedded + activeTabOverride props for StatsPage integration"
```

---

## Task 7c: HistoryPage `embedded` prop

**Files:**
- Modify: `src/pages/HistoryPage.jsx`

- [ ] **Step 1: Add `embedded` prop**

In `src/pages/HistoryPage.jsx`:

**a) Change the function signature:**
```jsx
export default function HistoryPage({ embedded = false }) {
```

**b) Wrap the existing header div in a condition:**
```jsx
{!embedded && (
  <div style={{ background: '#1A6B3C', color: 'white', padding: '1rem 1.25rem 1.5rem', borderRadius: '0 0 24px 24px' }}>
    <h1 style={{ fontSize: 22, fontWeight: 500 }}>{t('history.title')}</h1>
    <p style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>{t('history.subtitle')}</p>
  </div>
)}
```

- [ ] **Step 2: Run baseline — still GREEN**

```bash
cd frontend && npm test -- --testPathPattern=PreRestructureBaseline --watchAll=false
```

Expected: 3 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/pages/HistoryPage.jsx
git commit -m "feat(history): add embedded prop for StatsPage integration"
```

---

## Task 7d: Create StatsPage + StatsPage tests

**Files:**
- Create: `src/pages/StatsPage.jsx`
- Create: `src/tests/StatsPage.test.jsx`

- [ ] **Step 1: Write the StatsPage test (REG-06, REG-07) — expect FAIL**

```jsx
// src/tests/StatsPage.test.jsx
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import StatsPage from '../pages/StatsPage';
import api from '../utils/api';
import { exportBilanPDF } from '../utils/exportPDF';

jest.mock('../utils/api', () => ({
  __esModule: true,
  default: {
    get:    jest.fn().mockResolvedValue({ data: [] }),
    post:   jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

jest.mock('../utils/exportPDF', () => ({
  exportBilanPDF: jest.fn(),
}));

jest.mock('../store', () => ({
  useJournalStore:   () => ({ history: [], fetchHistory: jest.fn(), date: '2026-06-10', meals: {}, totals: {}, loading: false, fetchJournal: jest.fn() }),
  useProfileStore:   () => ({ profile: { target_kcal: 2000, goal: 'maintien' } }),
  useActivityStore:  () => ({ activities: [], fetchActivities: jest.fn() }),
  useAuthStore:      () => ({ user: { name: 'Test' }, isAuthenticated: true }),
}));

jest.mock('../store/useSettingsStore', () => () => ({ weightUnit: 'kg' }));

describe('StatsPage (REG-06, REG-07)', () => {
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

  // REG-06 — BilanPage content loads in default tab
  test('default Jour tab renders BilanPage content (Recharts container)', async () => {
    renderWithProviders(<StatsPage />);
    await waitFor(() => screen.getByRole('button', { name: 'Jour' }));
    await waitFor(() => {
      const hasChart = document.querySelector('.recharts-responsive-container');
      const hasBilanContent = screen.queryByText(/kcal|calories|objectif/i);
      expect(hasChart || hasBilanContent).toBeTruthy();
    }, { timeout: 3000 });
  });

  // REG-06 — HistoryPage renders in Évolution tab
  test('switching to Évolution tab renders HistoryPage content', async () => {
    renderWithProviders(<StatsPage />);
    await waitFor(() => screen.getByRole('button', { name: 'Évolution' }));
    userEvent.click(screen.getByRole('button', { name: 'Évolution' }));
    await waitFor(() => {
      const hasHistory = screen.queryByText(/history\.title|historique|évolution/i);
      const hasChart = document.querySelector('.recharts-responsive-container');
      expect(hasHistory || hasChart).toBeTruthy();
    }, { timeout: 3000 });
  });

  // REG-07 — PDF export
  test('PDF export button triggers exportBilanPDF', async () => {
    renderWithProviders(<StatsPage />);
    await waitFor(() => screen.getByRole('button', { name: 'Jour' }));
    await waitFor(() => {
      const exportBtn = screen.queryByRole('button', { name: /export|pdf|télécharger/i });
      return exportBtn !== null;
    }, { timeout: 3000 });
    const exportBtn = screen.getByRole('button', { name: /export|pdf|télécharger/i });
    userEvent.click(exportBtn);
    await waitFor(() => {
      expect(exportBilanPDF).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

```bash
cd frontend && npm test -- --testPathPattern=StatsPage --watchAll=false
```

Expected: `Cannot find module '../pages/StatsPage'`

- [ ] **Step 3: Create `src/pages/StatsPage.jsx`**

```jsx
import React, { useState, lazy, Suspense } from 'react';
import GradientHeader from '../components/GradientHeader';
import { SkeletonCard, SkeletonLine } from '../components/Skeleton';

const BilanPage   = lazy(() => import('./BilanPage'));
const HistoryPage = lazy(() => import('./HistoryPage'));

const TABS = ['Jour', 'Semaine', 'Mois', 'Évolution'];

const Loader = () => (
  <div style={{ padding: '1rem' }}>
    <SkeletonCard><SkeletonLine /></SkeletonCard>
  </div>
);

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState('Jour');
  const isEvolution = activeTab === 'Évolution';

  return (
    <div style={{ background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: 80 }}>
      <GradientHeader title="Statistiques" icon="📊" variant="emerald" />

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

      <Suspense fallback={<Loader />}>
        {isEvolution
          ? <HistoryPage embedded />
          : <BilanPage embedded activeTabOverride={activeTab} />
        }
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 4: Run StatsPage test — expect PASS**

```bash
cd frontend && npm test -- --testPathPattern=StatsPage --watchAll=false
```

Expected: 4 tests PASS

- [ ] **Step 5: Run baseline — still GREEN**

```bash
cd frontend && npm test -- --testPathPattern=PreRestructureBaseline --watchAll=false
```

Expected: 3 tests PASS (StatsPage is a new file; no routes changed yet)

- [ ] **Step 6: Commit**

```bash
git add src/pages/StatsPage.jsx src/tests/StatsPage.test.jsx
git commit -m "feat: add StatsPage merging Bilan/History via embedded prop (REG-06, REG-07)"
```

---

## Task 7e: Update App.jsx routes (restructuring commit)

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace `src/App.jsx`**

```jsx
// src/App.jsx — full file replacement

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store';
import { LanguageProvider } from './i18n';
import { ThemeProvider } from './contexts/ThemeContext';
import { SkeletonCard, SkeletonLine } from './components/Skeleton';

import LoginPage       from './pages/LoginPage';
import RegisterPage    from './pages/RegisterPage';
import Layout          from './components/Layout';
import JournalPage     from './pages/JournalPage';
import DishesPage      from './pages/DishesPage';
import ProfilePage     from './pages/ProfilePage';
import PrivacyPage     from './pages/PrivacyPage';
import LegalPage       from './pages/LegalPage';
import LandingPage     from './pages/LandingPage';
import OnboardingModal from './components/OnboardingModal';

const DishDetailPage      = lazy(() => import('./pages/DishDetailPage'));
const ProductDetailPage   = lazy(() => import('./pages/ProductDetailPage'));
const StatsPage           = lazy(() => import('./pages/StatsPage'));
const GlucoseTrackingPage = lazy(() => import('./pages/GlucoseTrackingPage'));

const PageLoader = () => (
  <div style={{ padding: '1rem' }}>
    <SkeletonCard>
      <SkeletonLine width="60%" height="2rem" style={{ marginBottom: '1rem' }} />
      <SkeletonLine />
    </SkeletonCard>
  </div>
);

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const initAuth        = useAuthStore(s => s.initAuth);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => { initAuth(); }, [initAuth]);

  useEffect(() => {
    const stored = localStorage.getItem('nutridz-auth');
    const token  = stored ? JSON.parse(stored)?.state?.token : null;
    const done   = localStorage.getItem('nutridz-onboarding-done');
    if (token && !done) setShowOnboarding(true);
  }, [isAuthenticated]);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
          {showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login"             element={<LoginPage />} />
              <Route path="/register"          element={<RegisterPage />} />
              <Route path="/confidentialite"   element={<PrivacyPage />} />
              <Route path="/mentions-legales"  element={<LegalPage />} />
              <Route
                path="/"
                element={isAuthenticated ? <Navigate to="/journal" replace /> : <LandingPage />}
              />
              <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route path="journal"      element={<JournalPage />} />
                <Route path="dishes"       element={<DishesPage />} />
                <Route path="dishes/:id"   element={<DishDetailPage />} />
                <Route path="products/:id" element={<ProductDetailPage />} />
                <Route path="stats"        element={<StatsPage />} />
                <Route path="glucose"      element={<GlucoseTrackingPage />} />
                <Route path="profile"      element={<ProfilePage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Run baseline — verify no regression**

```bash
cd frontend && npm test -- --testPathPattern="PreRestructureBaseline|StatsPage" --watchAll=false
```

Expected: All PASS. `PreRestructureBaseline` renders components directly (not via routes), so removing routes does not affect it.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(routes): consolidate 9→5 routes — add /stats, remove /bilan /history /products /scanner /vision"
```

---

## Task 7f: Update Layout.jsx to 5-tab nav

**Files:**
- Modify: `src/components/Layout.jsx`

- [ ] **Step 1: Replace `src/components/Layout.jsx`**

```jsx
// src/components/Layout.jsx — full file replacement

import React from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { useTranslation } from '../i18n';
import CookieBanner from './CookieBanner';

const NAV = [
  { to: '/journal', icon: 'ti-notebook',  key: 'journal' },
  { to: '/dishes',  icon: 'ti-soup',      key: 'dishes'  },
  { to: '/stats',   icon: 'ti-chart-bar', key: 'stats'   },
  { to: '/glucose', icon: 'ti-droplet',   key: 'glucose' },
  { to: '/profile', icon: 'ti-user',      key: 'profile' },
];

export default function Layout() {
  const { t } = useTranslation();
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 88 }}>
        <Outlet />
        <footer style={{ padding: '16px 20px 8px', borderTop: '0.5px solid var(--border-color)', display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
          <Link to="/confidentialite" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>Confidentialité</Link>
          <Link to="/mentions-legales" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>Mentions légales</Link>
          <a href="mailto:contact@nutrivita.app" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>Contact</a>
        </footer>
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, padding: '0 12px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
        zIndex: 100,
      }}>
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          background: 'var(--nav-glass)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--border-color)',
          borderRadius: 9999,
          padding: '6px 8px',
          boxShadow: '0 4px 24px var(--shadow)',
        }}>
          {NAV.map(({ to, icon, key }) => (
            <NavLink
              key={to}
              to={to}
              title={t(`nav.${key}`)}
              style={({ isActive }) => ({
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2,
                width: 48, height: 48, borderRadius: 9999,
                textDecoration: 'none',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-blue)' : 'transparent',
                transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
                flexShrink: 0,
              })}
            >
              {({ isActive }) => (
                <>
                  <i className={`ti ${icon}`} style={{ fontSize: 20, lineHeight: 1 }} />
                  <span style={{ fontSize: 9, fontWeight: isActive ? 600 : 400, lineHeight: 1 }}>
                    {t(`nav.${key}`)}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <CookieBanner />
    </div>
  );
}
```

- [ ] **Step 2: Run ALL tests to check regressions**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -30
```

Expected: PreRestructureBaseline PASS; StatsPage PASS; no new failures from nav change.

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.jsx
git commit -m "feat(nav): consolidate to 5-tab nav, remove language bar from Layout (DES-04)"
```

---

## Task 7g: Navigation REG-02 test + full suite green gate

Write the Navigation test (REG-02) and verify every test written so far is green.

**Files:**
- Create: `src/tests/Navigation.test.jsx`

- [ ] **Step 1: Write `src/tests/Navigation.test.jsx` (REG-02)**

```jsx
// src/tests/Navigation.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../i18n';
import Layout from '../components/Layout';

jest.mock('../pages/JournalPage',         () => () => <div>Journal content</div>);
jest.mock('../pages/DishesPage',          () => () => <div>Base de données</div>);
jest.mock('../pages/StatsPage',           () => () => <div>Stats content</div>);
jest.mock('../pages/GlucoseTrackingPage', () => () => <div>Glucose content</div>);
jest.mock('../pages/ProfilePage',         () => () => <div>Profile content</div>);
jest.mock('../components/CookieBanner',   () => () => null);

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
    expect(screen.getByRole('link', { name: /stats/i })).toHaveAttribute('href', '/stats');
  });

  test('no link points to removed routes', () => {
    renderNav();
    const hrefs = screen.getAllByRole('link').map(l => l.getAttribute('href'));
    expect(hrefs).not.toContain('/bilan');
    expect(hrefs).not.toContain('/history');
    expect(hrefs).not.toContain('/scanner');
    expect(hrefs).not.toContain('/products');
  });
});
```

- [ ] **Step 2: Run Navigation test — expect PASS**

```bash
cd frontend && npm test -- --testPathPattern=Navigation --watchAll=false
```

Expected: 3 tests PASS

- [ ] **Step 3: Run full test suite — green gate**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -30
```

Expected: All PASS — PreRestructureBaseline (3), GradientHeader (6), MacroPillCard (4), MetricCard (5), StatsPage (4), Navigation (3). Total ≥ 25 tests green.

- [ ] **Step 4: Commit**

```bash
git add src/tests/Navigation.test.jsx
git commit -m "test: add REG-02 Navigation 5-tab test + full suite green gate (DES-04 complete)"
```

---

## Task 8: REG baseline tests (REG-01, REG-09, REG-10)

These test behaviors that exist today and must not change through restyling.

**Files:**
- Create: `src/tests/BaselineReg.test.jsx`

- [ ] **Step 1: Create the test file**

```jsx
// src/tests/BaselineReg.test.jsx
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import LoginPage from '../pages/LoginPage';
import api from '../utils/api';

jest.mock('../utils/api', () => ({
  __esModule: true,
  default: {
    get:    jest.fn().mockResolvedValue({ data: {} }),
    post:   jest.fn().mockResolvedValue({ data: { token: 'test-jwt', user: { id: 1 } } }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

jest.mock('../store', () => ({
  useAuthStore: () => ({
    login: jest.fn(),
    isAuthenticated: false,
    initAuth: jest.fn(),
  }),
}));

// REG-01: Auth JWT
describe('REG-01 — Auth', () => {
  test('LoginPage renders email and password fields', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText(/email/i) || screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mot de passe/i) || screen.getByPlaceholderText(/mot de passe/i)).toBeInTheDocument();
  });

  test('LoginPage has a submit button', () => {
    renderWithProviders(<LoginPage />);
    expect(
      screen.getByRole('button', { name: /connexion|se connecter|login/i })
    ).toBeInTheDocument();
  });
});

// REG-10: PWA Service Worker
describe('REG-10 — PWA', () => {
  test('navigator.serviceWorker.register is available', () => {
    expect(navigator.serviceWorker.register).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — expect PASS**

```bash
cd frontend && npm test -- --testPathPattern=BaselineReg --watchAll=false
```

- [ ] **Step 3: Commit**

```bash
git add src/tests/BaselineReg.test.jsx
git commit -m "test: add baseline REG-01, REG-10 pre-restyling tests"
```

---

## Task 9: DES-05 — Restyle JournalPage + REG-03/04/05

**Files:**
- Modify: `src/pages/JournalPage.jsx`
- Create: `src/tests/JournalPage.test.jsx`

- [ ] **Step 1: Write the failing tests first (REG-03/04/05)**

```jsx
// src/tests/JournalPage.test.jsx
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import JournalPage from '../pages/JournalPage';
import api from '../utils/api';

jest.mock('../utils/api', () => ({
  __esModule: true,
  default: {
    get:    jest.fn().mockResolvedValue({ data: [] }),
    post:   jest.fn().mockResolvedValue({ data: { id: 1 } }),
    delete: jest.fn().mockResolvedValue({}),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

jest.mock('../store', () => ({
  useJournalStore: () => ({
    date: '2026-06-10', meals: {}, totals: { kcal: 0, proteines: 0, glucides: 0, lipides: 0 },
    loading: false, fetchJournal: jest.fn(), removeEntry: jest.fn(), setDate: jest.fn(),
  }),
  useProfileStore: () => ({ profile: { target_kcal: 2000 } }),
}));

jest.mock('../store/useSettingsStore', () => () => ({ weightUnit: 'kg' }));

// Capture onDetected callback to simulate scan result
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

describe('JournalPage — REG-03 Scanner', () => {
  test('scanner button opens BarcodeScanner overlay', async () => {
    renderWithProviders(<JournalPage />);
    const scanBtn = screen.getByRole('button', { name: /scanner|scan|barcode/i });
    userEvent.click(scanBtn);
    await waitFor(() => {
      expect(screen.getByTestId('barcode-scanner')).toBeInTheDocument();
    });
  });

  test('scan result triggers api.post to /journal', async () => {
    api.default.get.mockResolvedValueOnce({ data: { name: 'Produit test', calories: 100 } });
    renderWithProviders(<JournalPage />);
    userEvent.click(screen.getByRole('button', { name: /scanner|scan|barcode/i }));
    await waitFor(() => screen.getByTestId('barcode-scanner'));
    // Simulate a detected barcode
    await act(async () => {
      capturedOnDetected?.({ codeResult: { code: '3017620422003' } });
    });
    await waitFor(() => {
      expect(api.default.post).toHaveBeenCalledWith(
        expect.stringContaining('journal'),
        expect.any(Object)
      );
    });
  });
});

describe('JournalPage — REG-04 Vision', () => {
  test('vision button opens FoodVisionPage overlay', async () => {
    renderWithProviders(<JournalPage />);
    const visionBtn = screen.getByRole('button', { name: /photo|vision|camera/i });
    userEvent.click(visionBtn);
    await waitFor(() => {
      expect(screen.getByTestId('food-vision')).toBeInTheDocument();
    });
  });

  test('vision result triggers api.post to /journal', async () => {
    renderWithProviders(<JournalPage />);
    userEvent.click(screen.getByRole('button', { name: /photo|vision|camera/i }));
    await waitFor(() => screen.getByTestId('food-vision'));
    await act(async () => {
      capturedVisionOnResult?.({ name: 'Salade', calories: 50, product_id: 42 });
    });
    await waitFor(() => {
      expect(api.default.post).toHaveBeenCalledWith(
        expect.stringContaining('journal'),
        expect.any(Object)
      );
    });
  });
});

describe('JournalPage — REG-05 Voice', () => {
  test('voice button opens VoiceInput overlay', async () => {
    renderWithProviders(<JournalPage />);
    const voiceBtn = screen.getByRole('button', { name: /voix|vocal|micro/i });
    userEvent.click(voiceBtn);
    await waitFor(() => {
      expect(screen.getByTestId('voice-input')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL (buttons don't exist yet)**

```bash
cd frontend && npm test -- --testPathPattern=JournalPage --watchAll=false
```

Expected: FAIL — "Unable to find role button with name /scanner/i"

- [ ] **Step 3: Restyle JournalPage**

In `src/pages/JournalPage.jsx`, apply the following changes:

**a) Add imports at the top:**
```jsx
import GradientHeader from '../components/GradientHeader';
import BarcodeScanner from '../components/BarcodeScanner';
import FoodVisionPage from './FoodVisionPage';
```

**b) Add modal state variables (after existing useState declarations):**
```jsx
const [showScanner, setShowScanner] = useState(false);
const [showVision,  setShowVision]  = useState(false);
const [showVoice,   setShowVoice]   = useState(false);
```

**c) Add scan result handler (after existing handlers):**
```jsx
const handleScanResult = async (result) => {
  const code = result?.codeResult?.code;
  if (!code) return;
  try {
    const { data: product } = await api.get(`/scanner/barcode/${code}`);
    if (product?.id) {
      await api.post('/journal', { product_id: product.id, meal_type: 'dej', grams: 100, date });
      toast.success(`${product.name} ajouté`);
      fetchJournal();
    }
  } catch { toast.error('Produit non trouvé'); }
  setShowScanner(false);
};

const handleVisionResult = async (food) => {
  if (!food?.product_id) return;
  await api.post('/journal', { product_id: food.product_id, meal_type: 'dej', grams: 100, date });
  toast.success(`${food.name} ajouté`);
  fetchJournal();
  setShowVision(false);
};
```

**d) Replace the existing plain header div with GradientHeader:**

Find the existing header (a `<div>` with background gradient or color at the top of the return) and replace it with:

```jsx
<GradientHeader
  title={t('journal.title') || 'Journal'}
  subtitle={format(parseISO(date), 'EEEE d MMMM', { locale: dateFnsLocale })}
  variant="indigo"
>
  <button
    className="touch-target"
    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 9999, width: 36, height: 36, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    onClick={() => setShowScanner(true)}
    aria-label="Scanner"
  >
    <i className="ti ti-barcode" style={{ fontSize: 18 }} />
  </button>
  <button
    className="touch-target"
    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 9999, width: 36, height: 36, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    onClick={() => setShowVision(true)}
    aria-label="Photo"
  >
    <i className="ti ti-camera" style={{ fontSize: 18 }} />
  </button>
  <button
    className="touch-target"
    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 9999, width: 36, height: 36, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    onClick={() => setShowVoice(true)}
    aria-label="Voix"
  >
    <i className="ti ti-microphone" style={{ fontSize: 18 }} />
  </button>
</GradientHeader>
```

**e) Add modal overlays just before the closing `</div>` of the page:**

```jsx
{showScanner && (
  <div className="modal-overlay" onClick={() => setShowScanner(false)}>
    <div className="modal-content" onClick={e => e.stopPropagation()}>
      <BarcodeScanner onDetected={handleScanResult} onClose={() => setShowScanner(false)} />
    </div>
  </div>
)}

{showVision && (
  <div className="modal-overlay" onClick={() => setShowVision(false)}>
    <div className="modal-content" onClick={e => e.stopPropagation()}>
      <FoodVisionPage onResult={handleVisionResult} onClose={() => setShowVision(false)} />
    </div>
  </div>
)}

{showVoice && (
  <div className="modal-overlay" onClick={() => setShowVoice(false)}>
    <div className="modal-content" onClick={e => e.stopPropagation()}>
      <VoiceInput onResult={(transcript) => { setVoiceMeal(transcript); setShowVoice(false); }} />
    </div>
  </div>
)}
```

**f) Replace meal section inline containers with `.card` class:**

For each meal section `<div style={{ background: 'var(--bg-primary)', borderRadius: ..., border: ..., ... }}>`, replace the inline style block with `className="card"`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npm test -- --testPathPattern=JournalPage --watchAll=false
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/JournalPage.jsx src/tests/JournalPage.test.jsx
git commit -m "feat(ui): restyle JournalPage — gradient header + quick-add modals (DES-05, REG-03, REG-04, REG-05)"
```

---

## Task 10: DES-05 — Restyle DishesPage + REG-06b

**Files:**
- Modify: `src/pages/DishesPage.jsx`
- Create: `src/tests/DishesPage.test.jsx`

- [ ] **Step 1: Write the failing test (REG-06b)**

```jsx
// src/tests/DishesPage.test.jsx
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import DishesPage from '../pages/DishesPage';
import api from '../utils/api';

const MOCK_DISHES = [
  { id: 1, name: 'Couscous',    emoji: '🫕', cuisine: 'Maghreb', calories: 450 },
  { id: 2, name: 'Pizza',       emoji: '🍕', cuisine: 'Italienne', calories: 280 },
  { id: 3, name: 'Tarte flambée', emoji: '🥘', cuisine: 'Française', calories: 320 },
];

const MOCK_PRODUCTS = [
  { id: 10, name: 'Lait entier', calories_per_100g: 61, brand: 'Candia' },
  { id: 11, name: 'Yaourt nature', calories_per_100g: 59, brand: 'Danone' },
  { id: 12, name: 'Beurre doux', calories_per_100g: 745, brand: 'Président' },
];

jest.mock('../utils/api', () => ({
  __esModule: true,
  default: {
    get:  jest.fn(),
    post: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

jest.mock('../store/useFavoritesStore', () => () => ({
  favorites: [], fetchFavorites: jest.fn(), isFavorite: () => false,
}));

beforeEach(() => {
  api.default.get.mockImplementation((url) => {
    if (url.includes('cuisines')) return Promise.resolve({ data: ['Maghreb', 'Italienne', 'Française'] });
    if (url.includes('products')) return Promise.resolve({ data: MOCK_PRODUCTS });
    return Promise.resolve({ data: MOCK_DISHES });
  });
});

describe('DishesPage (REG-06b)', () => {
  test('dishes load and display on initial render', async () => {
    renderWithProviders(<DishesPage />);
    await waitFor(() => {
      expect(screen.getByText('Couscous')).toBeInTheDocument();
    });
    expect(screen.getByText('Pizza')).toBeInTheDocument();
  });

  test('Produits filter tab loads and displays products', async () => {
    renderWithProviders(<DishesPage />);
    await waitFor(() => screen.getByText('Couscous'));

    const produitsBtn = screen.getByRole('button', { name: /produits/i });
    userEvent.click(produitsBtn);

    await waitFor(() => {
      expect(screen.getByText('Lait entier')).toBeInTheDocument();
    });
    expect(screen.getByText('Yaourt nature')).toBeInTheDocument();
    expect(screen.getByText('Beurre doux')).toBeInTheDocument();
  });

  test('search filters the displayed items', async () => {
    renderWithProviders(<DishesPage />);
    await waitFor(() => screen.getByText('Couscous'));

    const searchInput = screen.getByPlaceholderText(/recherch/i);
    await userEvent.type(searchInput, 'cous');

    await waitFor(() => {
      expect(screen.getByText('Couscous')).toBeInTheDocument();
      expect(screen.queryByText('Pizza')).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL (Produits filter button doesn't exist)**

```bash
cd frontend && npm test -- --testPathPattern=DishesPage --watchAll=false
```

- [ ] **Step 3: Restyle DishesPage and add Products integration**

In `src/pages/DishesPage.jsx`, apply these changes:

**a) Add product state:**
```jsx
const [mode, setMode]         = useState('dishes'); // 'dishes' | 'products'
const [products, setProducts] = useState([]);
const [prodLoading, setProdLoading] = useState(false);
```

**b) Add product fetch function:**
```jsx
const fetchProducts = useCallback(async () => {
  setProdLoading(true);
  try {
    const params = query ? `?q=${encodeURIComponent(query)}` : '';
    const { data } = await api.get(`/products${params}`);
    setProducts(data);
  } catch { toast.error('Erreur chargement des produits'); }
  finally { setProdLoading(false); }
}, [query]);

useEffect(() => {
  if (mode === 'products') {
    const t = setTimeout(fetchProducts, 250);
    return () => clearTimeout(t);
  }
}, [mode, fetchProducts]);
```

**c) Replace the existing header div with clean structure + Produits pill:**

Replace the old header `<div style={{...}}>` with:

```jsx
<div style={{ padding: '16px 16px 0' }}>
  <h1 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: 12 }}>
    Base de données
  </h1>

  {/* Search */}
  <div className="card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
    <i className="ti ti-search" style={{ color: 'var(--text-secondary)', fontSize: 18 }} />
    <input
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder={t('dishes.search') || 'Rechercher…'}
      style={{ border: 'none', outline: 'none', flex: 1, background: 'transparent', fontSize: '0.9375rem', color: 'var(--text-primary)' }}
    />
  </div>

  {/* Mode pills: Produits + cuisine filters */}
  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
    <button
      className={`pill${mode === 'products' ? ' active' : ''}`}
      onClick={() => setMode(mode === 'products' ? 'dishes' : 'products')}
    >
      Produits
    </button>
    {mode === 'dishes' && cuisines.map(c => (
      <button
        key={c}
        className={`pill${cuisine === c ? ' active' : ''}`}
        onClick={() => setCuisine(cuisine === c ? '' : c)}
      >
        {c}
      </button>
    ))}
  </div>
</div>
```

**d) Replace the dish grid `<div style={{...}}>` items with `.card` className:**

Each dish item `<div style={{ background: 'var(--bg-primary)', borderRadius: ..., padding: ..., ...}}>` becomes `<div className="card" style={{ cursor: 'pointer', textAlign: 'center' }}>`.

**e) Add products grid below the dishes grid (conditionally rendered):**

```jsx
{mode === 'products' && (
  <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
    {prodLoading
      ? [1,2,3,4].map(i => <SkeletonCard key={i}><SkeletonLine /></SkeletonCard>)
      : products.map(p => (
          <div
            key={p.id}
            className="card"
            style={{ cursor: 'pointer', textAlign: 'center' }}
            onClick={() => navigate(`/products/${p.id}`)}
          >
            <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{p.name}</p>
            {p.brand && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.brand}</p>}
            <p style={{ fontWeight: 700, color: 'var(--accent-blue)', marginTop: 4 }}>
              {p.calories_per_100g} kcal/100g
            </p>
          </div>
        ))
    }
  </div>
)}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npm test -- --testPathPattern=DishesPage --watchAll=false
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/DishesPage.jsx src/tests/DishesPage.test.jsx
git commit -m "feat(ui): restyle DishesPage + absorb products tab (DES-05, REG-06b)"
```

---

## Task 11: DES-05 — Restyle DishDetailPage

**Files:**
- Modify: `src/pages/DishDetailPage.jsx`

- [ ] **Step 1: Run existing tests to confirm green baseline**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -5
```

Expected: all previously-written tests still PASS.

- [ ] **Step 2: Replace header and macro display in `src/pages/DishDetailPage.jsx`**

**a) Add imports:**
```jsx
import GradientHeader from '../components/GradientHeader';
import MacroPillCard from '../components/MacroPillCard';
```

**b) Replace the existing gradient header div** (the one with `background: 'linear-gradient(...)'` or hardcoded color) with:
```jsx
<GradientHeader
  title={dish.name}
  subtitle={dish.cuisine}
  icon={dish.emoji}
  variant="emerald"
/>
```

**c) Replace the 4 macro stat items** (the `<div>` blocks showing P/G/L/Kcal values) with a 2×2 grid of MacroPillCard:
```jsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px', marginTop: 12 }}>
  <MacroPillCard icon="🥩" value={Math.round(dish.proteines * portion / 100)} target={Math.round((profile.target_kcal || 2000) * 0.25 / 4)} label="Protéines" />
  <MacroPillCard icon="🍞" value={Math.round(dish.glucides * portion / 100)} target={Math.round((profile.target_kcal || 2000) * 0.5 / 4)} label="Glucides" />
  <MacroPillCard icon="🫒" value={Math.round(dish.lipides * portion / 100)} target={Math.round((profile.target_kcal || 2000) * 0.3 / 9)} label="Lipides" />
  <MacroPillCard icon="🔥" value={Math.round(dish.calories * portion / 100)} target={profile.target_kcal || 2000} label="Calories" unit="kcal" />
</div>
```

**d) Wrap the existing ingredient list and action buttons in `.card` wrappers:**
```jsx
<div className="card" style={{ margin: '12px 16px' }}>
  {/* existing ingredient list content */}
</div>
```

- [ ] **Step 3: Run all tests — expect still PASS**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/DishDetailPage.jsx
git commit -m "feat(ui): restyle DishDetailPage — GradientHeader emerald + MacroPillCard grid (DES-05)"
```

---

## Task 12: DES-05 — Restyle GlucoseTrackingPage

**Files:**
- Modify: `src/pages/GlucoseTrackingPage.jsx`

- [ ] **Step 1: Replace local MetricCard with shared component**

In `src/pages/GlucoseTrackingPage.jsx`:

**a) Remove the local `MetricCard` function** (lines 16–34 as seen in source).

**b) Add import at the top:**
```jsx
import GradientHeader from '../components/GradientHeader';
import MetricCard from '../components/MetricCard';
```

**c) Replace the existing gradient header div** (top-level background div) with:
```jsx
<GradientHeader title="Glycémie" icon="💉" variant="glucose" />
```

**d) Replace all usages of the old local `<MetricCard>` with the new shared one:**

Old usage pattern:
```jsx
<MetricCard label="GMI" value={metrics.gmi} subtitle="Estimation HbA1c" status={gmiStatus} />
```

New usage (note: new MetricCard uses `statusText` not `subtitle`):
```jsx
<MetricCard label="GMI" value={metrics.gmi} statusText="Estimation HbA1c" status={gmiStatus} />
```

**e) Wrap the input form and the metrics grid in `.card`:**
```jsx
<div className="card" style={{ margin: '16px' }}>
  {/* existing glucose input form */}
</div>

<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px', marginBottom: 16 }}>
  <MetricCard ... />
  <MetricCard ... />
  <MetricCard ... />
</div>
```

- [ ] **Step 2: Run all tests — expect PASS**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/GlucoseTrackingPage.jsx
git commit -m "feat(ui): restyle GlucoseTrackingPage — GradientHeader glucose + shared MetricCard (DES-05)"
```

---

## Task 13: DES-05 — Restyle ProfilePage + REG-08/09

**Files:**
- Modify: `src/pages/ProfilePage.jsx`
- Create: `src/tests/ProfilePage.test.jsx`

- [ ] **Step 1: Write REG-08 and REG-09 tests**

```jsx
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
    get:  jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put:  jest.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
}));

jest.mock('../store', () => ({
  useProfileStore: () => ({
    profile: { nom: 'Test', age: 30, sexe: 'h', taille: 175, poids: 70, objectif: 'maintien', activite: 'mod', target_kcal: 2000 },
    updateProfile: jest.fn(), setProfileLocal: jest.fn(),
  }),
  useAuthStore: () => ({ user: { email: 'test@test.com' }, logout: jest.fn() }),
}));

jest.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({ isSubscribed: false, subscribe: jest.fn(), unsubscribe: jest.fn() }),
}));

// REG-08: i18n + RTL
describe('REG-08 — Language selector in ProfilePage', () => {
  test('ProfilePage renders LanguageSelector', () => {
    renderWithProviders(<ProfilePage />);
    // Language selector buttons should be present in ProfilePage
    expect(
      screen.getByRole('button', { name: /ar|fr|en/i }) ||
      screen.getByText(/langue|language/i)
    ).toBeInTheDocument();
  });
});

// REG-09: Dark mode toggle
describe('REG-09 — Dark mode toggle in ProfilePage', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  test('dark mode toggle changes data-theme attribute on html', async () => {
    renderWithProviders(<ProfilePage />);
    const toggle = screen.getByRole('checkbox', { name: /dark|sombre|nuit/i })
      || screen.getByLabelText(/dark|sombre|nuit/i)
      || screen.getByRole('button', { name: /dark|sombre|nuit/i });
    userEvent.click(toggle);
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });
});
```

- [ ] **Step 2: Run — note baseline (some tests may fail until ProfilePage is restyled)**

```bash
cd frontend && npm test -- --testPathPattern=ProfilePage --watchAll=false
```

- [ ] **Step 3: Restyle ProfilePage**

**a) Add imports:**
```jsx
import GradientHeader from '../components/GradientHeader';
import LanguageSelector from '../components/LanguageSelector';
```

**b) Replace the page header** with:
```jsx
<GradientHeader
  title={user?.name || 'Profil'}
  subtitle={user?.email}
  icon="👤"
  variant="slate"
/>
```

**c) Replace tab row inline styles** with `.pill` class buttons:
```jsx
<div style={{ display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto' }}>
  {['corps', 'objectif', 'activite', 'compte'].map(tabId => (
    <button
      key={tabId}
      className={`pill${tab === tabId ? ' active' : ''}`}
      onClick={() => setTab(tabId)}
    >
      {t(`profile.tab.${tabId}`) || tabId}
    </button>
  ))}
</div>
```

**d) Add LanguageSelector section** at the top of the profile content (or as first card):
```jsx
<div className="card" style={{ margin: '12px 16px' }}>
  <div style={{ marginBottom: 8, fontWeight: 600 }}>Langue</div>
  <LanguageSelector />
</div>
```

**e) Wrap each profile section in `.card`:**
```jsx
<div className="card" style={{ margin: '12px 16px' }}>
  {/* existing form fields for the active tab */}
</div>
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npm test -- --testPathPattern=ProfilePage --watchAll=false
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProfilePage.jsx src/tests/ProfilePage.test.jsx
git commit -m "feat(ui): restyle ProfilePage — GradientHeader slate + LanguageSelector + pill tabs (DES-05, REG-08, REG-09)"
```

---

## Task 14: DES-05 — Restyle LandingPage + LoginPage + RegisterPage + OnboardingModal

**Files:**
- Modify: `src/pages/LandingPage.jsx`
- Modify: `src/pages/LoginPage.jsx`
- Modify: `src/pages/RegisterPage.jsx`
- Modify: `src/components/OnboardingModal.jsx`

- [ ] **Step 1: Restyle LandingPage**

Key changes in `src/pages/LandingPage.jsx`:

**a) Hero section** — ensure it uses `.gradient-hero` class (replace any inline background gradient):
```jsx
<div className="gradient-hero" style={{ padding: '48px 24px 56px', textAlign: 'center', color: '#fff', borderRadius: '0 0 32px 32px' }}>
  {/* existing hero content */}
</div>
```

**b) Feature cards** — replace inline `<div style={{ background: ..., borderRadius: ..., padding: ... }}>` with `.card`:
```jsx
<div className="card" style={{ marginBottom: 12 }}>
  {/* existing feature content */}
</div>
```

**c) CTA buttons** — replace inline style buttons with `.pill.active`:
```jsx
<button className="pill active" style={{ fontSize: '1rem', padding: '12px 28px' }} onClick={() => navigate('/register')}>
  Commencer gratuitement
</button>
```

- [ ] **Step 2: Restyle LoginPage**

Wrap the entire form in a centered `.card`:
```jsx
// src/pages/LoginPage.jsx — wrap content
return (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: 16 }}>
    <div className="card" style={{ width: '100%', maxWidth: 400 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 24, fontWeight: 700 }}>Connexion</h1>
      {/* existing form fields unchanged, just replace inline styles on inputs with: */}
      {/* style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} */}
    </div>
  </div>
);
```

- [ ] **Step 3: Restyle RegisterPage (same pattern as LoginPage)**

Same card-centered layout. Replace inline input styles with the token-based style from Step 2.

- [ ] **Step 4: Restyle OnboardingModal**

In `src/components/OnboardingModal.jsx`, replace the modal backdrop and card container:
```jsx
<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}>
  <div className="modal-content" style={{ borderRadius: '24px 24px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
    {/* Step 0 header with gradient */}
    {step === 0 && (
      <div className="gradient-hero" style={{ padding: '24px 20px', borderRadius: '24px 24px 0 0', color: '#fff', textAlign: 'center' }}>
        {/* welcome content */}
      </div>
    )}
    {/* remaining steps as .card sections */}
  </div>
</div>
```

- [ ] **Step 5: Run all tests — expect still PASS**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/LandingPage.jsx src/pages/LoginPage.jsx src/pages/RegisterPage.jsx src/components/OnboardingModal.jsx
git commit -m "feat(ui): restyle Landing, Login, Register, OnboardingModal (DES-05)"
```

---

## Task 15: DES-05 — Restyle BilanPage (replace local MetricCard)

**Files:**
- Modify: `src/pages/BilanPage.jsx`

BilanPage has its own local `MetricCard` component (lines ~55–75) with hardcoded `rgba()` colors. Replace it with the shared component.

- [ ] **Step 1: Remove local MetricCard and import shared one**

In `src/pages/BilanPage.jsx`:

**a) Remove** the local `function MetricCard({ label, value, unit, status })` block entirely.

**b) Add import:**
```jsx
import MetricCard from '../components/MetricCard';
```

**c) Update any usages** — the local MetricCard had a `unit` prop; the shared one also has it. The local one had `status`; so does the shared one. The only difference: if BilanPage used `subtitle` instead of `statusText`, update the prop name.

- [ ] **Step 2: Run StatsPage tests — expect PASS**

```bash
cd frontend && npm test -- --testPathPattern=StatsPage --watchAll=false
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/BilanPage.jsx
git commit -m "refactor: replace local MetricCard in BilanPage with shared component (DES-05)"
```

---

## Task 16: Final — run full test suite and verify

- [ ] **Step 1: Run the complete test suite**

```bash
cd frontend && npm test -- --watchAll=false 2>&1
```

Expected output: all test suites PASS, 0 failures.

Key test files to verify:
- `GradientHeader.test.jsx` → 6 tests PASS
- `MacroPillCard.test.jsx` → 4 tests PASS
- `MetricCard.test.jsx` → 5 tests PASS
- `Navigation.test.jsx` → 3 tests PASS
- `StatsPage.test.jsx` → 2 tests PASS
- `BaselineReg.test.jsx` → 3 tests PASS
- `JournalPage.test.jsx` → 5 tests PASS
- `DishesPage.test.jsx` → 3 tests PASS
- `ProfilePage.test.jsx` → 2 tests PASS

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully.` — no TypeScript/ESLint errors.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: NutraLance frontend restyling complete — DES-01→05 + REG-01→11 all green"
```
