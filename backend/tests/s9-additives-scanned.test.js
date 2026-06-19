'use strict';
/**
 * S9 — Tests additifs : risk dans /api/scan + cumul journal+scannés + GET/DELETE /api/scanned
 *
 * TU-S9-1 : POST /api/scan → chaque additif inclut le champ `risk` (high|moderate|low|null)
 * TU-S9-2 : calcAdditivesStats accepte les entrées scanned (additifs_json aliasé en additifs)
 *           → counts correctement cumulés avec entrées journal
 * TU-S9-3 : GET /api/scanned → retourne liste paginée avec total
 * TU-S9-4 : DELETE /api/scanned/:id → supprime un scan précis ; 404 si inconnu
 * TU-S9-5 : DELETE /api/scanned → supprime tout l'historique, retourne deleted_count
 */

jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = 'test-user';
  next();
});

jest.mock('../data/additives.js', () => ({
  high_risk:     { E150d: { name: 'Caramel sulfite-ammoniacal' }, E250: { name: 'Nitrite de sodium' } },
  moderate_risk: { E338: { name: 'Acide phosphorique' } },
  low_risk:      { E330: { name: 'Acide citrique' } },
  ADDITIVES_CLASSIFICATION: {
    E150d: { name: 'Caramel sulfite-ammoniacal', risk: 'high',     concern: 'test' },
    E338:  { name: 'Acide phosphorique',          risk: 'moderate', concern: 'test' },
    E330:  { name: 'Acide citrique',              risk: 'low',      concern: 'test' },
    E250:  { name: 'Nitrite de sodium',           risk: 'high',     concern: 'test' },
  },
}));

// Variable MUST be prefixed with "mock" so Jest allows hoisted factory access
let mockDb;
jest.mock('../db', () => ({
  getDB: () => mockDb,
}));

const express = require('express');
const request = require('supertest');

// ─── TU-S9-1 : POST /api/scan → additives[].risk ────────────────────────────

describe('TU-S9-1 — POST /api/scan → champ risk dans chaque additif', () => {
  jest.mock('axios');
  const axios = require('axios');

  beforeEach(() => {
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(null),
        run: jest.fn().mockResolvedValue({ changes: 1 }),
        all: jest.fn().mockResolvedValue([]),
      }),
    };
  });

  test('high / moderate / low / null selon ADDITIVES', async () => {
    axios.get = jest.fn().mockResolvedValue({
      data: {
        status: 1,
        product: {
          product_name: 'Produit test',
          nutriscore_grade: 'c',
          nova_group: 4,
          additives_tags: ['en:e150d', 'en:e338', 'en:e330', 'en:e999'],
          nutriments: { sugars_100g: 5, salt_100g: 0.5, 'saturated-fat_100g': 2 },
        },
      },
    });

    const app = express();
    app.use(express.json());
    app.use('/api/scan', require('../routes/scan'));

    const res = await request(app)
      .post('/api/scan')
      .send({ barcode: '3017620422003' });

    expect(res.status).toBe(200);
    const adds = res.body.additives;
    expect(Array.isArray(adds)).toBe(true);

    const high = adds.find(a => a.code === 'E150D');
    expect(high?.risk).toBe('high');

    const mod = adds.find(a => a.code === 'E338');
    expect(mod?.risk).toBe('moderate');

    const low = adds.find(a => a.code === 'E330');
    expect(low?.risk).toBe('low');

    const unknown = adds.find(a => a.code === 'E999');
    expect(unknown?.risk).toBeNull();
  });
});

// ─── TU-S9-2 : calcAdditivesStats cumule journal + scanned ──────────────────

describe('TU-S9-2 — calcAdditivesStats cumule journal + scanned', () => {
  const { calcAdditivesStats } = require('../routes/stats-additives');

  test('entrées journal et scanned utilisent le même champ additifs', () => {
    const entries = [
      { id: 'j1', additifs: JSON.stringify(['E150D', 'E338']) }, // journal
      { id: 's1', additifs: JSON.stringify(['E250']) },          // scanned (alias SQL)
      { id: 'j2', additifs: '[]' },                              // sans additifs
    ];
    const r = calcAdditivesStats(entries);
    expect(r.total_entries).toBe(3);
    expect(r.entries_with_additives).toBe(2);
    expect(r.counts.high).toBe(2);     // E150D + E250
    expect(r.counts.moderate).toBe(1); // E338
    expect(r.items.length).toBe(3);
  });
});

// ─── TU-S9-3 : GET /api/scanned → liste paginée ─────────────────────────────

describe('TU-S9-3 — GET /api/scanned', () => {
  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/scanned', require('../routes/scanned'));
    return app;
  }

  test('retourne total, limit, offset et products[]', async () => {
    mockDb = {
      prepare: jest.fn().mockImplementation((sql) => {
        if (sql.includes('COUNT')) {
          return { get: jest.fn().mockResolvedValue({ n: 1 }), all: jest.fn(), run: jest.fn() };
        }
        return {
          all: jest.fn().mockResolvedValue([{
            id: 1, barcode: '123', product_name: 'Coca-Cola', score: 30, verdict: 'Mauvais',
            nutri_score: 'e', nova: 4, sugars_g: 10.5, salt_g: 0, sat_fat_g: 0,
            times_this_month: 3, scanned_at: '2026-06-15T10:00:00Z',
            additives_json: JSON.stringify(['en:e150d']),
          }]),
          get: jest.fn(),
          run: jest.fn(),
        };
      }),
    };

    const res = await request(makeApp()).get('/api/scanned');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total', 1);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products[0].name).toBe('Coca-Cola');
    expect(Array.isArray(res.body.products[0].additives)).toBe(true);
  });
});

// ─── TU-S9-4 : DELETE /api/scanned/:id ──────────────────────────────────────

describe('TU-S9-4 — DELETE /api/scanned/:id', () => {
  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/scanned', require('../routes/scanned'));
    return app;
  }

  test('400 si :id non numérique', async () => {
    mockDb = { prepare: jest.fn() };
    const res = await request(makeApp()).delete('/api/scanned/abc');
    expect(res.status).toBe(400);
  });

  test('404 si scan introuvable', async () => {
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(null),
        run: jest.fn().mockResolvedValue({ changes: 0 }),
        all: jest.fn().mockResolvedValue([]),
      }),
    };
    const res = await request(makeApp()).delete('/api/scanned/99');
    expect(res.status).toBe(404);
  });

  test('200 + deleted:id si trouvé', async () => {
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ id: 5 }),
        run: jest.fn().mockResolvedValue({ changes: 1 }),
        all: jest.fn().mockResolvedValue([]),
      }),
    };
    const res = await request(makeApp()).delete('/api/scanned/5');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(5);
  });
});

// ─── TU-S9-5 : DELETE /api/scanned — vide tout ──────────────────────────────

describe('TU-S9-5 — DELETE /api/scanned (historique complet)', () => {
  test('retourne deleted_count', async () => {
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        run: jest.fn().mockResolvedValue({ changes: 7 }),
        get: jest.fn(),
        all: jest.fn().mockResolvedValue([]),
      }),
    };
    const app = express();
    app.use(express.json());
    app.use('/api/scanned', require('../routes/scanned'));

    const res = await request(app).delete('/api/scanned');
    expect(res.status).toBe(200);
    expect(res.body.deleted_count).toBe(7);
  });
});
