'use strict';
/**
 * S4 — Tests exposition additifs (GET /api/stats/additives)
 *
 * TU-S4-1 : 2 entrées (Coca → E150D + E338 ; aliment sans additif)
 *           → counts.high=1, moderate=1, low=0, entries_with_additives=1, total_entries=2
 * TU-S4-2 : 0 entrées → total_entries=0, counts={high:0,moderate:0,low:0}, items=[]
 * TU-S4-3 : toutes les entrées sans additifs → entries_with_additives=0
 * TU-S4-4 : code inconnu dans additifs → ignoré, ne fausse pas les counts
 * TU-S4-5 : items triés high→moderate→low, puis count décroissant dans chaque niveau
 * TU-S4-6 : HTTP GET /api/stats/additives?days=abc → réponse contient days=7 (défaut)
 */

// ─── Mocks module-level (requis avant require du module) ────────────────────
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = 'test-user';
  next();
});

jest.mock('../data/additives', () => ({
  ADDITIVES_CLASSIFICATION: {
    E150d: { name: 'Caramel sulfite-ammoniacal', risk: 'high',     concern: 'test' },
    E338:  { name: 'Acide phosphorique',          risk: 'moderate', concern: 'test' },
    E330:  { name: 'Acide citrique',              risk: 'low',      concern: 'test' },
    E250:  { name: 'Nitrite de sodium',           risk: 'high',     concern: 'test' },
  },
}));

// DB mock — données configurables par test via mockEntriesRef
let mockEntriesRef = [];
jest.mock('../db', () => ({
  getDB: () => ({
    prepare: () => ({
      all: jest.fn().mockImplementation(() => Promise.resolve(mockEntriesRef)),
    }),
  }),
}));

const { calcAdditivesStats } = require('../routes/stats-additives');

// ─── TU-S4-1 ─────────────────────────────────────────────────────────────────
describe('TU-S4-1 — scénario spec (Coca + sans additif)', () => {
  test('counts.high=1, moderate=1, low=0', () => {
    const entries = [
      { id: 'e1', additifs: JSON.stringify(['E150D', 'E338']) },
      { id: 'e2', additifs: '[]' },
    ];
    const r = calcAdditivesStats(entries);
    expect(r.counts.high).toBe(1);
    expect(r.counts.moderate).toBe(1);
    expect(r.counts.low).toBe(0);
    expect(r.entries_with_additives).toBe(1);
    expect(r.total_entries).toBe(2);
  });
});

// ─── TU-S4-2 ─────────────────────────────────────────────────────────────────
describe('TU-S4-2 — 0 entrées', () => {
  test('total_entries=0, items=[], counts tous à 0', () => {
    const r = calcAdditivesStats([]);
    expect(r.total_entries).toBe(0);
    expect(r.entries_with_additives).toBe(0);
    expect(r.items).toEqual([]);
    expect(r.counts).toEqual({ high: 0, moderate: 0, low: 0, unknown: 0 });
  });
});

// ─── TU-S4-3 ─────────────────────────────────────────────────────────────────
describe('TU-S4-3 — entrées sans additifs', () => {
  test('entries_with_additives=0 même si total_entries > 0', () => {
    const entries = [
      { id: 'e1', additifs: '[]' },
      { id: 'e2', additifs: null },
      { id: 'e3', additifs: 'not-json' },
    ];
    const r = calcAdditivesStats(entries);
    expect(r.total_entries).toBe(3);
    expect(r.entries_with_additives).toBe(0);
    expect(r.counts).toEqual({ high: 0, moderate: 0, low: 0, unknown: 0 });
  });
});

// ─── TU-S4-4 ─────────────────────────────────────────────────────────────────
// S10 : les codes E-number non classifiés vont dans le groupe "unknown" (plus jamais écartés)
// Les tags sans format E-number (ex. "XINVALID") restent ignorés (normalizeCode → null).
describe('TU-S4-4 — code E-number non classifié → groupe unknown', () => {
  test('E999 non classifié → counts.unknown=1, items=[{risk:unknown}] ; XINVALID ignoré', () => {
    const entries = [
      { id: 'e1', additifs: JSON.stringify(['E999', 'XINVALID']) },
    ];
    const r = calcAdditivesStats(entries);
    expect(r.counts.high).toBe(0);
    expect(r.counts.moderate).toBe(0);
    expect(r.counts.low).toBe(0);
    expect(r.counts.unknown).toBe(1);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].risk).toBe('unknown');
    expect(r.items[0].code).toBe('E999');
  });
});

// ─── TU-S4-5 ─────────────────────────────────────────────────────────────────
describe('TU-S4-5 — tri items : high→moderate→low, puis count décroissant', () => {
  test('E250 (high, ×2) avant E150D (high, ×1) avant E338 (moderate, ×1)', () => {
    const entries = [
      { id: 'e1', additifs: JSON.stringify(['E250', 'E150D', 'E338']) },
      { id: 'e2', additifs: JSON.stringify(['E250']) },
    ];
    const r = calcAdditivesStats(entries);
    expect(r.counts.high).toBe(3);     // E250 × 2 + E150D × 1
    expect(r.counts.moderate).toBe(1); // E338 × 1
    expect(r.items[0].code).toBe('E250');  // high, count 2 → premier
    expect(r.items[1].code).toBe('E150D'); // high, count 1 → second
    expect(r.items[2].code).toBe('E338');  // moderate → troisième
  });
});

// ─── TU-S4-6 — HTTP endpoint ─────────────────────────────────────────────────
describe('TU-S4-6 — HTTP GET /api/stats/additives', () => {
  const express = require('express');
  const request = require('supertest');

  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/stats', require('../routes/stats-additives'));
    return app;
  }

  test('days invalide → réponse days=7', async () => {
    mockEntriesRef = [];
    const app = buildApp();
    const res = await request(app).get('/api/stats/additives?days=abc');
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(7);
    expect(res.body).toHaveProperty('counts');
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('disclaimer');
    expect(res.body.disclaimer).toHaveProperty('fr');
    expect(res.body.disclaimer).toHaveProperty('en');
    expect(res.body.disclaimer).toHaveProperty('ar');
  });

  test('days=30 → réponse days=30', async () => {
    mockEntriesRef = [];
    const app = buildApp();
    const res = await request(app).get('/api/stats/additives?days=30');
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(30);
  });
});
