'use strict';
/**
 * P1-8 — Performance scan : champs OFF ciblés, cache barcode, persistance async, /health.
 *
 * - l'appel OFF utilise `fields=` (payload réduit) ;
 * - un 2e scan du même barcode sert le cache (axios appelé 1 seule fois) ;
 * - la réponse est renvoyée même si l'écriture DB échoue (persistance en tâche de fond) ;
 * - GET /health → 200.
 */

process.env.JWT_SECRET = 'test-secret-p1-8';

jest.mock('../middleware/auth', () => (req, _res, next) => { req.userId = 'u1'; next(); });

let mockDb;
jest.mock('../db', () => ({ getDB: () => mockDb }));

jest.mock('axios');
const axios = require('axios');
const express = require('express');
const request = require('supertest');
const offCache = require('../services/offCache');
const scanRoutes = require('../routes/scan');

const BARCODE = '3017620422003';
const offOk = (product) => ({ data: { status: 1, product } });
const tick = () => new Promise(r => setImmediate(r)); // laisse la persistance de fond se résoudre

function scanApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/scan', scanRoutes);
  return a;
}

beforeEach(() => {
  offCache.clear();
  mockDb = {
    prepare: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue(null),
      run: jest.fn().mockResolvedValue({ changes: 1 }),
    }),
  };
  axios.get = jest.fn().mockResolvedValue(offOk({ product_name: 'Nutella', nutriscore_grade: 'e', nutriments: {} }));
});

describe('POST /api/scan — champs ciblés + cache (P1-8)', () => {
  test('l\'appel OFF demande des champs précis via fields=', async () => {
    await request(scanApp()).post('/api/scan').send({ barcode: BARCODE });
    await tick();
    expect(axios.get).toHaveBeenCalledTimes(1);
    const url = axios.get.mock.calls[0][0];
    expect(url).toMatch(/[?&]fields=/);
    expect(url).toContain('nutriments');
    expect(url).toContain('categories_tags'); // requis pour la détection boisson (P1-7)
  });

  test('2e scan du même barcode → servi par le cache, pas de 2e appel réseau', async () => {
    const app = scanApp();
    const r1 = await request(app).post('/api/scan').send({ barcode: BARCODE });
    const r2 = await request(app).post('/api/scan').send({ barcode: BARCODE });
    await tick();
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r2.body.score).toBe(r1.body.score);
    expect(axios.get).toHaveBeenCalledTimes(1); // 1 seul appel OFF pour 2 scans
  });

  test('OFF indisponible mais barcode déjà en cache → repli sur le cache', async () => {
    const app = scanApp();
    await request(app).post('/api/scan').send({ barcode: BARCODE }); // amorce le cache
    axios.get = jest.fn().mockRejectedValue(new Error('OFF down'));
    const res = await request(app).post('/api/scan').send({ barcode: BARCODE });
    await tick();
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Nutella');
  });
});

describe('POST /api/scan — persistance async résiliente (P1-8)', () => {
  test('réponse 200 même si l\'écriture DB échoue', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('db down')),
        run: jest.fn().mockRejectedValue(new Error('db down')),
      }),
    };
    axios.get = jest.fn().mockResolvedValue(offOk({ product_name: 'X', nutriscore_grade: 'b', nutriments: {} }));
    const res = await request(scanApp()).post('/api/scan').send({ barcode: BARCODE });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(75); // grade b, sans additif
    await tick(); // laisse la persistance de fond échouer et loguer
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe('GET /health (P1-8 keep-warm)', () => {
  test('→ 200 {status:ok}', async () => {
    const app = require('../server'); // require.main !== module → pas de listen ni initDB
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
