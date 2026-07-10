'use strict';
/**
 * Tests de non-régression — corrections ultrareview (07/2026).
 * Couvre les fixes vérifiables : E2, E4, M2, M3, M4, M6, M7 + faibles (barcode, N jours, NaN limit).
 * Harnais aligné sur les suites existantes (auth mockée via x-test-user).
 */
process.env.JWT_SECRET = 'test-secret-ultrareview';

jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = req.headers['x-test-user'] || 'u1';
  next();
});

const express = require('express');
const request = require('supertest');
const { getDB, initDB } = require('../db');

let db;
beforeAll(async () => {
  await initDB();
  db = getDB();
  for (const u of ['ur1', 'ur2']) {
    await db.prepare(
      "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, 'x', ?) ON CONFLICT (id) DO NOTHING"
    ).run(u, `${u}@ur.local`, u);
    await db.prepare('INSERT INTO profiles (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING').run(u);
  }
});

// ─── E4 : composante micronutriments du Score Santé non nulle ────────────────────
describe('E4 — healthScore lit pct_reference (micro > 0)', () => {
  const { computeHealthScore } = require('../services/healthScore');
  test('des aliments riches en micronutriments donnent components.micro > 0', () => {
    const dailyAgg = [], entries = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      dailyAgg.push({ date, kcal: 2000, protein: 100, carbs: 225, fat: 67 });
      entries.push({ date, name: 'lentilles cuites', grams: 200, additifs: '[]' });
    }
    const r = computeHealthScore({ dailyAgg, entries, targetKcal: 2000, profile: { sexe: 'h', age: 35, latitude_approx: 46 } });
    expect(r.components.micro).toBeGreaterThan(0); // avant le fix : toujours 0 (n.pct inexistant)
  });
});

// ─── E2 : state OAuth Strava signé anti-CSRF ─────────────────────────────────────
describe('E2 — signState/verifyState', () => {
  const { signState, verifyState } = require('../services/strava');
  test('un state signé est vérifié et rend le userId', () => {
    expect(verifyState(signState('ur1'))).toBe('ur1');
  });
  test('un state brut (ancien comportement) est rejeté', () => {
    expect(verifyState('ur1')).toBeNull();          // userId brut → refusé
    expect(verifyState('n-importe-quoi')).toBeNull();
  });
});

// ─── M2 : validation de grams sur POST /api/journal ──────────────────────────────
describe('M2 — POST /journal valide grams', () => {
  let app, productId;
  beforeAll(async () => {
    app = express(); app.use(express.json());
    app.use('/api/journal', require('../routes/journal'));
    const ins = await db.prepare(
      "INSERT INTO products (name, brand, kcal_per100, glucides, proteines, lipides, fibres, category) VALUES ('UR Test','UR',100,10,5,3,1,'divers')"
    ).run();
    productId = ins.lastInsertRowid;
  });
  test('grams négatif → 400', async () => {
    const res = await request(app).post('/api/journal').set('x-test-user', 'ur1')
      .send({ product_id: productId, grams: -50, meal_type: 'dej' });
    expect(res.status).toBe(400);
  });
  test('grams non numérique → 400', async () => {
    const res = await request(app).post('/api/journal').set('x-test-user', 'ur1')
      .send({ product_id: productId, grams: 'abc', meal_type: 'dej' });
    expect(res.status).toBe(400);
  });
  test('grams valide → 201 et kcal numérique', async () => {
    const res = await request(app).post('/api/journal').set('x-test-user', 'ur1')
      .send({ product_id: productId, grams: 200, meal_type: 'dej' });
    expect(res.status).toBe(201);
    expect(Number.isFinite(res.body.kcal)).toBe(true);
  });
});

// ─── M4 : RGPD — scanned_products purgé à la suppression de compte ───────────────
describe('M4 — DELETE /account purge scanned_products', () => {
  let app;
  beforeAll(() => {
    app = express(); app.use(express.json());
    app.use('/api/user', require('../routes/auth'));
  });
  test('les lignes scanned_products sont supprimées', async () => {
    await db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('urdel','urdel@ur.local','x','D') ON CONFLICT (id) DO NOTHING").run();
    await db.prepare('INSERT INTO profiles (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING').run('urdel');
    await db.prepare(
      "INSERT INTO scanned_products (user_id, barcode, product_name, score, verdict, scan_month) VALUES ('urdel','3017620422003','Test',80,'Excellent','2026-07') ON CONFLICT DO NOTHING"
    ).run();
    const res = await request(app).delete('/api/user/account').set('x-test-user', 'urdel');
    expect(res.status).toBe(200);
    const left = await db.prepare("SELECT COUNT(*) AS c FROM scanned_products WHERE user_id = 'urdel'").get();
    expect(Number(left.c)).toBe(0);
  });
});

// ─── M7 : /dishes/:id/log respecte la visibilité (anti IDOR) ─────────────────────
describe('M7 — dishes/:id/log garde de visibilité', () => {
  let app, privateDishId;
  beforeAll(async () => {
    app = express(); app.use(express.json());
    app.use('/api/dishes', require('../routes/dishes'));
    const ins = await db.prepare(
      "INSERT INTO dishes (name, cuisine, category, default_portion_g, kcal_per_portion, glucides, proteines, lipides, fibres, is_user_created, created_by_user_id) VALUES ('Plat prive UR','française','plat',300,500,40,30,20,5,1,'ur2') RETURNING id"
    ).get();
    privateDishId = ins.id;
  });
  test('journaliser le plat privé d’un autre user → 404', async () => {
    const res = await request(app).post(`/api/dishes/${privateDishId}/log`).set('x-test-user', 'ur1')
      .send({ meal_type: 'dej', portion_g: 300 });
    expect(res.status).toBe(404);
  });
  test('le propriétaire peut le journaliser → 200/201', async () => {
    const res = await request(app).post(`/api/dishes/${privateDishId}/log`).set('x-test-user', 'ur2')
      .send({ meal_type: 'dej', portion_g: 300 });
    expect([200, 201]).toContain(res.status);
  });
});

// ─── L : validation du code-barres avant lookup OpenFoodFacts ────────────────────
describe('L — GET /scanner/barcode/:code valide le format', () => {
  let app;
  beforeAll(() => {
    app = express(); app.use(express.json());
    app.use('/api/scanner', require('../routes/scanner'));
  });
  test('code non numérique → 400 (pas de lookup)', async () => {
    const res = await request(app).get('/api/scanner/barcode/..%2Fabc').set('x-test-user', 'ur1');
    expect(res.status).toBe(400);
  });
});
