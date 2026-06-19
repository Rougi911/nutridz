'use strict';
/**
 * S10 — Tests unitaires : groupe "non classé" + resolveAdditiveName
 *
 * TU-S10-1  calcAdditivesStats avec code inconnu → counts.unknown ≥ 1, item présent (jamais ignoré)
 * TU-S10-2  tri high→moderate→low→unknown
 * TU-S10-3  resolveAdditiveName : code classifié → nom éditorial EFSA
 * TU-S10-4  resolveAdditiveName : code OFF-only (E433) → nom de la taxonomie OFF (fr)
 * TU-S10-5  resolveAdditiveName : code totalement inconnu → code lui-même
 */

// ─── Mocks (hoistés avant tout require) ──────────────────────────────────────

jest.mock('../data/additives', () => ({
  ADDITIVES_CLASSIFICATION: {
    E150d: { name: 'Caramel sulfite-ammoniacal', risk: 'high',     concern: 'test' },
    E338:  { name: 'Acide phosphorique',          risk: 'moderate', concern: 'test' },
    E330:  { name: 'Acide citrique',              risk: 'low',      concern: 'test' },
  },
  high_risk:     { E150d: { name: 'Caramel sulfite-ammoniacal' } },
  moderate_risk: { E338:  { name: 'Acide phosphorique' } },
  low_risk:      { E330:  { name: 'Acide citrique' } },
}));

jest.mock('../data/additive-names.json', () => ({
  E433: { fr: 'Polysorbate 80', en: 'Polysorbate 80' },
}));

jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = 'test-user';
  next();
});

jest.mock('../db', () => ({
  getDB: () => ({
    prepare: () => ({
      all: jest.fn().mockResolvedValue([]),
      get:  jest.fn().mockResolvedValue(null),
    }),
  }),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

const { calcAdditivesStats } = require('../routes/stats-additives');
const { resolveAdditiveName } = require('../services/additiveResolver');

// ─── TU-S10-1 — code inconnu → counts.unknown ≥ 1, item dans items[] ─────────

describe('TU-S10-1 — code inconnu jamais ignoré', () => {
  test('E999 incrémente counts.unknown et apparaît dans items[]', () => {
    const entries = [
      { id: 'e1', additifs: JSON.stringify(['E999']) },
    ];
    const r = calcAdditivesStats(entries);
    expect(r.counts.unknown).toBeGreaterThanOrEqual(1);
    const item = r.items.find(i => i.code === 'E999');
    expect(item).toBeDefined();
    expect(item.risk).toBe('unknown');
    expect(item.count).toBe(1);
  });

  test('items.length = 1 (le code inconnu n\'est pas écarté)', () => {
    const entries = [
      { id: 'e1', additifs: JSON.stringify(['E999']) },
    ];
    const r = calcAdditivesStats(entries);
    expect(r.items).toHaveLength(1);
  });

  test('entrées_with_additives comptabilisée même si tous les additifs sont inconnus', () => {
    const entries = [
      { id: 'e1', additifs: JSON.stringify(['E999', 'E998']) },
    ];
    const r = calcAdditivesStats(entries);
    expect(r.entries_with_additives).toBe(1);
    expect(r.counts.unknown).toBe(2);
  });
});

// ─── TU-S10-2 — tri high→moderate→low→unknown ────────────────────────────────

describe('TU-S10-2 — tri des items par risque décroissant', () => {
  test('items triés dans l\'ordre : high, moderate, low, unknown', () => {
    const entries = [
      { id: 'e1', additifs: JSON.stringify(['E999', 'E330', 'E150D', 'E338']) },
    ];
    const r = calcAdditivesStats(entries);
    const risks = r.items.map(i => i.risk);
    const idx = (risk) => risks.indexOf(risk);

    expect(idx('high')).toBeGreaterThanOrEqual(0);
    expect(idx('moderate')).toBeGreaterThanOrEqual(0);
    expect(idx('low')).toBeGreaterThanOrEqual(0);
    expect(idx('unknown')).toBeGreaterThanOrEqual(0);

    expect(idx('high')).toBeLessThan(idx('moderate'));
    expect(idx('moderate')).toBeLessThan(idx('low'));
    expect(idx('low')).toBeLessThan(idx('unknown'));
  });

  test('unknown est toujours en dernière position même avec count élevé', () => {
    const entries = [
      // E999 apparaît 5x, mais doit rester après low
      { id: 'e1', additifs: JSON.stringify(['E999', 'E999', 'E999', 'E999', 'E999', 'E330']) },
    ];
    const r = calcAdditivesStats(entries);
    const risks = r.items.map(i => i.risk);
    expect(risks[risks.length - 1]).toBe('unknown');
  });
});

// ─── TU-S10-3..5 — resolveAdditiveName ───────────────────────────────────────

describe('resolveAdditiveName', () => {
  test('TU-S10-3 — code classifié → nom éditorial EFSA (prioritaire)', () => {
    expect(resolveAdditiveName('E150d')).toBe('Caramel sulfite-ammoniacal');
  });

  test('TU-S10-4 — code OFF-only (E433) → nom de la taxonomie OFF en fr', () => {
    // E433 absent de ADDITIVES_CLASSIFICATION, présent dans additive-names.json
    expect(resolveAdditiveName('E433')).toBe('Polysorbate 80');
  });

  test('TU-S10-5 — code totalement inconnu → code lui-même (fallback)', () => {
    expect(resolveAdditiveName('E999')).toBe('E999');
  });

  test('TU-S10-5b — lang "en" → nom anglais si disponible', () => {
    expect(resolveAdditiveName('E433', 'en')).toBe('Polysorbate 80');
  });
});
