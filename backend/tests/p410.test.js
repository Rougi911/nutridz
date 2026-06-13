'use strict';
/**
 * P4.10 — Tests middleware body-size + CORS error handler
 *
 * Utilise une mini-app Express isolée (sans DB) pour tester uniquement les
 * couches middleware modifiées dans server.js. Gemini est remplacé par un
 * stub de route.
 *
 * TU-P410-1 : POST /api/interpret avec image base64 sous 15 MB → body parsé, pas de 413
 * TU-P410-2 : POST /api/interpret avec body > 15 MB → 413 + CORS header + corps JSON
 * TU-P410-3 : POST /api/other  avec body > 1 MB (limite globale) → 413 + CORS header
 * TU-P410-4 : POST /api/other  avec body < 1 MB → 200 (non-régression limite globale)
 * TU-P410-5 : JSON invalide → 400 + CORS header + corps JSON
 */

const express = require('express');
const cors    = require('cors');
const request = require('supertest');

const ALLOWED_ORIGIN = 'https://nutrivita-v0.onrender.com';
const allowedOrigins = [ALLOWED_ORIGIN, 'http://localhost:3000'];

function buildApp() {
  const app = express();

  const corsOptions = {
    origin: (origin, cb) => (!origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS'))),
    credentials: true,
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // Mirror server.js: route-specific large limit BEFORE global
  app.use('/api/interpret', express.json({ limit: '15mb' }));
  app.use(express.json({ limit: '1mb' }));

  // Stub route — Gemini never called in tests
  app.post('/api/interpret', (req, res) => res.json({ ok: true, received: typeof req.body }));
  app.post('/api/other',     (req, res) => res.json({ ok: true }));

  // Mirror server.js error handler
  app.use((err, req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Credentials', 'true');
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Image trop volumineuse (limite 15 Mo)' });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Corps JSON invalide' });
    }
    res.status(err.status || 500).json({ error: 'Erreur interne du serveur' });
  });

  return app;
}

const app = buildApp();

// ─── TU-P410-1 : payload sous 15 MB → passe ──────────────────────────────────

describe('TU-P410-1 : /api/interpret avec payload < 15 MB', () => {
  const smallBase64 = Buffer.alloc(100 * 1024).toString('base64'); // 100 KB

  test('renvoie 200 et body parsé', async () => {
    const res = await request(app)
      .post('/api/interpret')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ mode: 'photo', payload: smallBase64 }));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ─── TU-P410-2 : payload > 15 MB → 413 + CORS ────────────────────────────────

describe('TU-P410-2 : /api/interpret avec payload > 15 MB', () => {
  // Single 16 MB request shared across all assertions to avoid 3 × 16 MB allocations.
  let res;
  beforeAll(async () => {
    const hugeBase64 = 'A'.repeat(16 * 1024 * 1024);
    res = await request(app)
      .post('/api/interpret')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ mode: 'photo', payload: hugeBase64 }));
  });

  test('renvoie 413', () => {
    expect(res.status).toBe(413);
  });

  test('corps JSON contient champ error lisible', () => {
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
  });

  test("réponse porte l'en-tête CORS Access-Control-Allow-Origin", () => {
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });
});

// ─── TU-P410-3 : autre route avec body > 1 MB (limite globale) → 413 + CORS ──

describe('TU-P410-3 : /api/other avec body > 1 MB', () => {
  const over1mb = 'B'.repeat(1.2 * 1024 * 1024);

  test('renvoie 413', async () => {
    const res = await request(app)
      .post('/api/other')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: over1mb }));

    expect(res.status).toBe(413);
  });

  test('en-tête CORS présent sur 413 de route globale', async () => {
    const res = await request(app)
      .post('/api/other')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: over1mb }));

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });
});

// ─── TU-P410-4 : non-régression — body < 1 MB sur route globale → 200 ────────

describe('TU-P410-4 : /api/other avec body < 1 MB', () => {
  test('renvoie 200 (limite globale non atteinte)', async () => {
    const res = await request(app)
      .post('/api/other')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: 'small payload' }));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ─── TU-P410-5 : JSON invalide → 400 + CORS ──────────────────────────────────

describe('TU-P410-5 : JSON invalide', () => {
  test('renvoie 400 avec corps JSON', async () => {
    const res = await request(app)
      .post('/api/other')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{invalid json}');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('en-tête CORS présent sur 400', async () => {
    const res = await request(app)
      .post('/api/other')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{invalid json}');

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });
});
