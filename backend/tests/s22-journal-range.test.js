'use strict';
/**
 * S22 / DEF-8 — POST /api/journal/range : entrées plates du journal sur une plage de N jours.
 *
 * Alimente les graphiques Bilan (calories/jour + radar micronutriments) sur jour/semaine/mois/année.
 * - Renvoie les entrées dont `date` ∈ [aujourd'hui - (days-1), aujourd'hui], au format ApiMealEntry plat.
 * - Exclut les entrées hors plage.
 * - `days` borné à [1, 365] (un body absent → 30).
 * - IDOR : ne renvoie que les entrées de req.userId.
 *
 * Mêmes conventions que s15-meal-edit.test.js (base réelle, auth mockée par en-tête).
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.JWT_SECRET = 'test-secret-s22';
const TMP_DB = path.join(os.tmpdir(), `nutridz-s22-${process.pid}-${Date.now()}.db`);
process.env.NUTRIDZ_DB_PATH = TMP_DB;

jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = req.headers['x-test-user'] || 'u1';
  next();
});

const express = require('express');
const request = require('supertest');
const { getDB, initDB } = require('../db');

let app;
let db;
let productId;

function makeApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/journal', require('../routes/journal'));
  return a;
}

const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

beforeAll(async () => {
  await initDB();
  db = getDB();
  app = makeApp();

  await db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 's22-u1@test.local', 'x', 'U1') ON CONFLICT (id) DO NOTHING").run();
  await db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u2', 's22-u2@test.local', 'x', 'U2') ON CONFLICT (id) DO NOTHING").run();

  const p = await db.prepare(`
    INSERT INTO products (name, brand, kcal_per100, glucides, proteines, lipides, fibres)
    VALUES ('Aliment range S22', 'TestBrand', 200, 20, 10, 5, 2)
  `).run();
  productId = p.lastInsertRowid;

  // u1 : entrées aujourd'hui, J-3 (dans la plage 7 j) et J-40 (hors plage 7 j)
  for (const [date, amount, meal] of [
    [isoDaysAgo(0), 100, 'breakfast'],
    [isoDaysAgo(3), 150, 'lunch'],
    [isoDaysAgo(40), 120, 'dinner'],
  ]) {
    await request(app).post('/api/journal').set('x-test-user', 'u1')
      .send({ food_id: String(productId), amount, meal_type: meal, date });
  }
  // u2 : une entrée aujourd'hui (ne doit jamais remonter pour u1)
  await request(app).post('/api/journal').set('x-test-user', 'u2')
    .send({ food_id: String(productId), amount: 90, meal_type: 'lunch', date: isoDaysAgo(0) });
});

afterAll(() => {
  try { fs.unlinkSync(TMP_DB); } catch (_) {}
});

describe('S22 — POST /api/journal/range', () => {
  test('plage 7 j : renvoie aujourd\'hui + J-3, exclut J-40', async () => {
    const res = await request(app).post('/api/journal/range').set('x-test-user', 'u1').send({ days: 7 });
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(7);
    expect(Array.isArray(res.body.entries)).toBe(true);

    const dates = res.body.entries.map((e) => e.date);
    expect(dates).toContain(isoDaysAgo(0));
    expect(dates).toContain(isoDaysAgo(3));
    expect(dates).not.toContain(isoDaysAgo(40));
  });

  test('format ApiMealEntry plat : food.calories = kcal/100g, amount, meal_type mappé', async () => {
    const res = await request(app).post('/api/journal/range').set('x-test-user', 'u1').send({ days: 7 });
    const today = res.body.entries.find((e) => e.date === isoDaysAgo(0));
    expect(today).toBeTruthy();
    expect(today.food.calories).toBe(200);   // kcal_per100, pas la portion
    expect(today.amount).toBe(100);
    expect(today.meal_type).toBe('breakfast'); // pdej (interne) → breakfast (API)
    expect(today.food).toHaveProperty('protein');
  });

  test('plage large (>365) : bornée à 365 et inclut J-40', async () => {
    const res = await request(app).post('/api/journal/range').set('x-test-user', 'u1').send({ days: 999 });
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(365);
    const dates = res.body.entries.map((e) => e.date);
    expect(dates).toContain(isoDaysAgo(40));
  });

  test('body sans days → défaut 30 j (exclut J-40)', async () => {
    const res = await request(app).post('/api/journal/range').set('x-test-user', 'u1').send({});
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(30);
    const dates = res.body.entries.map((e) => e.date);
    expect(dates).not.toContain(isoDaysAgo(40));
  });

  test('IDOR : u1 ne voit pas les entrées de u2', async () => {
    const res = await request(app).post('/api/journal/range').set('x-test-user', 'u1').send({ days: 7 });
    // u2 a une entrée de 90 g aujourd'hui ; u1 ne doit voir que ses propres montants.
    expect(res.body.entries.every((e) => e.amount !== 90)).toBe(true);
  });
});
