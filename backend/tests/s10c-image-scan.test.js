'use strict';
/**
 * S10c — Tests image produit OFF
 *
 * TU-S10c-1 : POST /api/scan stocke et renvoie image_url depuis OFF
 * TU-S10c-2 : POST /api/scan → image_url null si OFF ne fournit pas de photo
 * TU-S10c-3 : GET /api/scanned → chaque produit inclut image_url
 */

jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = 'test-user';
  next();
});

jest.mock('../data/additives.js', () => ({
  high_risk:     {},
  moderate_risk: {},
  low_risk:      {},
  ADDITIVES_CLASSIFICATION: {},
}));

jest.mock('../services/additiveResolver', () => ({
  resolveAdditiveName: (code) => code,
}));

let mockDb;
jest.mock('../db', () => ({
  getDB: () => mockDb,
}));

const express = require('express');
const request = require('supertest');

// ─── TU-S10c-1 : POST /api/scan stocke et renvoie image_url ─────────────────

describe('TU-S10c-1 — POST /api/scan → image_url dans la réponse', () => {
  jest.mock('axios');
  const axios = require('axios');

  let insertedRow;

  beforeEach(() => {
    insertedRow = null;
    mockDb = {
      prepare: jest.fn((sql) => ({
        get: jest.fn().mockResolvedValue(null),
        run: jest.fn().mockImplementation((...args) => {
          if (sql.includes('INSERT')) insertedRow = args;
          return Promise.resolve({ changes: 1 });
        }),
        all: jest.fn().mockResolvedValue([]),
      })),
    };
  });

  test('image_front_small_url prioritaire', async () => {
    axios.get = jest.fn().mockResolvedValue({
      data: {
        status: 1,
        product: {
          product_name: 'Coca-Cola',
          nutriscore_grade: 'e',
          nova_group: 4,
          additives_tags: [],
          nutriments: { sugars_100g: 10, salt_100g: 0, 'saturated-fat_100g': 0 },
          image_front_small_url: 'https://images.openfoodfacts.org/small.jpg',
          image_front_url:       'https://images.openfoodfacts.org/front.jpg',
          image_url:             'https://images.openfoodfacts.org/generic.jpg',
        },
      },
    });

    const app = express();
    app.use(express.json());
    app.use('/api/scan', require('../routes/scan'));

    const res = await request(app)
      .post('/api/scan')
      .send({ barcode: '5449000000996' });

    expect(res.status).toBe(200);
    expect(res.body.image_url).toBe('https://images.openfoodfacts.org/small.jpg');
  });

  test('fallback vers image_front_url si small absent', async () => {
    axios.get = jest.fn().mockResolvedValue({
      data: {
        status: 1,
        product: {
          product_name: 'Produit test',
          nutriscore_grade: 'b',
          nova_group: 2,
          additives_tags: [],
          nutriments: { sugars_100g: 2, salt_100g: 0.1, 'saturated-fat_100g': 0.5 },
          image_front_small_url: undefined,
          image_front_url:       'https://images.openfoodfacts.org/front.jpg',
        },
      },
    });

    const app = express();
    app.use(express.json());
    app.use('/api/scan', require('../routes/scan'));

    const res = await request(app)
      .post('/api/scan')
      .send({ barcode: '1234567890123' });

    expect(res.status).toBe(200);
    expect(res.body.image_url).toBe('https://images.openfoodfacts.org/front.jpg');
  });
});

// ─── TU-S10c-2 : POST /api/scan → image_url null si pas de photo ─────────────

describe('TU-S10c-2 — POST /api/scan → image_url null quand absent', () => {
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

  test('null quand aucune image dans la réponse OFF', async () => {
    axios.get = jest.fn().mockResolvedValue({
      data: {
        status: 1,
        product: {
          product_name: 'Sans photo',
          nutriscore_grade: 'c',
          nova_group: 3,
          additives_tags: [],
          nutriments: { sugars_100g: 3, salt_100g: 0.2, 'saturated-fat_100g': 1 },
        },
      },
    });

    const app = express();
    app.use(express.json());
    app.use('/api/scan', require('../routes/scan'));

    const res = await request(app)
      .post('/api/scan')
      .send({ barcode: '9999999999999' });

    expect(res.status).toBe(200);
    expect(res.body.image_url).toBeNull();
  });
});

// ─── TU-S10c-3 : GET /api/scanned → image_url dans chaque produit ───────────

describe('TU-S10c-3 — GET /api/scanned → image_url inclus', () => {
  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/scanned', require('../routes/scanned'));
    return app;
  }

  test('image_url présent dans les produits retournés', async () => {
    const fakeRows = [
      {
        id: 1,
        barcode: '5449000000996',
        product_name: 'Coca-Cola',
        score: 25,
        verdict: 'À éviter',
        nutri_score: 'E',
        nova: 4,
        sugars_g: 10,
        salt_g: 0,
        sat_fat_g: 0,
        times_this_month: 1,
        scanned_at: '2026-06-20T10:00:00.000Z',
        additives_json: '[]',
        image_url: 'https://images.openfoodfacts.org/coca.jpg',
      },
      {
        id: 2,
        barcode: '1234567890123',
        product_name: 'Produit sans photo',
        score: 60,
        verdict: 'Acceptable',
        nutri_score: 'B',
        nova: 2,
        sugars_g: 2,
        salt_g: 0.1,
        sat_fat_g: 0.5,
        times_this_month: 1,
        scanned_at: '2026-06-19T09:00:00.000Z',
        additives_json: '[]',
        image_url: null,
      },
    ];

    mockDb = {
      prepare: jest.fn((sql) => ({
        all:  jest.fn().mockResolvedValue(fakeRows),
        get:  jest.fn().mockResolvedValue({ n: 2 }),
        run:  jest.fn().mockResolvedValue({ changes: 0 }),
      })),
    };

    const res = await request(makeApp()).get('/api/scanned');

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(2);

    const coca = res.body.products.find(p => p.barcode === '5449000000996');
    expect(coca?.image_url).toBe('https://images.openfoodfacts.org/coca.jpg');

    const noPhoto = res.body.products.find(p => p.barcode === '1234567890123');
    expect(noPhoto?.image_url).toBeNull();
  });
});
