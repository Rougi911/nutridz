'use strict';
/**
 * S25 — Éditer / supprimer une activité.
 * - PATCH /api/activities/:id : recalcul kcal (MET × poids × durée), 200.
 * - PATCH activité Strava → 409 (non modifiable).
 * - PATCH / DELETE d'un autre utilisateur → 404 (IDOR-guard sur userId).
 * - DELETE → success ; re-DELETE → 404.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

process.env.JWT_SECRET = 'test-secret-s25';
const TMP_DB = path.join(os.tmpdir(), `nutridz-s25-${process.pid}-${Date.now()}.db`);
process.env.NUTRIDZ_DB_PATH = TMP_DB;

jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = req.headers['x-test-user'] || 'u1';
  next();
});

const express = require('express');
const request = require('supertest');
const { getDB, initDB } = require('../db');

let app, db;

function makeApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/activities', require('../routes/activity'));
  return a;
}

beforeAll(async () => {
  await initDB();
  db = getDB();
  app = makeApp();
  await db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 's25-u1@test.local', 'x', 'U1') ON CONFLICT (id) DO NOTHING").run();
  await db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u2', 's25-u2@test.local', 'x', 'U2') ON CONFLICT (id) DO NOTHING").run();
});

afterAll(() => { try { fs.unlinkSync(TMP_DB); } catch (_) {} });

async function createManual(user = 'u1', body = { type: 'marche', duration_min: 30 }) {
  const res = await request(app).post('/api/activities/manual').set('x-test-user', user).send(body);
  return res.body.activity;
}

describe('S25 — PATCH /api/activities/:id', () => {
  test('modifie la durée → kcal recalculé (200)', async () => {
    const a = await createManual('u1', { type: 'marche', duration_min: 30 });
    // marche/modérée MET 3.5 × poids défaut 70 × 0.5 h = 122.5 → 123
    expect(a.calories_burned).toBe(123);

    const res = await request(app).patch(`/api/activities/${a.id}`).set('x-test-user', 'u1')
      .send({ duration_min: 60 });
    expect(res.status).toBe(200);
    expect(res.body.activity.duration_min).toBe(60);
    expect(res.body.activity.calories_burned).toBe(245); // 3.5 × 70 × 1 h

    const row = await db.prepare('SELECT calories_burned FROM activities WHERE id = ?').get(a.id);
    expect(row.calories_burned).toBe(245);
  });

  test('change le type → recalcul selon le MET du nouveau type', async () => {
    const a = await createManual('u1', { type: 'marche', duration_min: 30 });
    const res = await request(app).patch(`/api/activities/${a.id}`).set('x-test-user', 'u1')
      .send({ type: 'course', duration_min: 30 });
    expect(res.status).toBe(200);
    expect(res.body.activity.calories_burned).toBe(315); // course/modérée MET 9 × 70 × 0.5
  });

  test('durée invalide → 400', async () => {
    const a = await createManual('u1');
    const res = await request(app).patch(`/api/activities/${a.id}`).set('x-test-user', 'u1')
      .send({ duration_min: 0 });
    expect(res.status).toBe(400);
  });

  test('activité Strava → 409 (non modifiable)', async () => {
    const sid = uuidv4();
    await db.prepare(
      "INSERT INTO activities (id, user_id, date, type, duration_min, distance_km, calories_burned, source, strava_id) VALUES (?, 'u1', '2026-06-25', 'course', 40, 8, 400, 'strava', '999')"
    ).run(sid);
    const res = await request(app).patch(`/api/activities/${sid}`).set('x-test-user', 'u1')
      .send({ duration_min: 50 });
    expect(res.status).toBe(409);
  });

  test('PATCH inexistante → 404', async () => {
    const res = await request(app).patch('/api/activities/does-not-exist').set('x-test-user', 'u1')
      .send({ duration_min: 50 });
    expect(res.status).toBe(404);
  });

  test('IDOR : PATCH activité d\'un autre user → 404', async () => {
    const a = await createManual('u2', { type: 'velo', duration_min: 45 });
    const res = await request(app).patch(`/api/activities/${a.id}`).set('x-test-user', 'u1')
      .send({ duration_min: 10 });
    expect(res.status).toBe(404);
    const row = await db.prepare('SELECT duration_min FROM activities WHERE id = ?').get(a.id);
    expect(row.duration_min).toBe(45); // inchangée
  });
});

describe('S25 — DELETE /api/activities/:id', () => {
  test('supprime puis 404 au 2e appel', async () => {
    const a = await createManual('u1');
    const res1 = await request(app).delete(`/api/activities/${a.id}`).set('x-test-user', 'u1');
    expect(res1.status).toBe(200);
    const res2 = await request(app).delete(`/api/activities/${a.id}`).set('x-test-user', 'u1');
    expect(res2.status).toBe(404);
  });

  test('IDOR : DELETE activité d\'un autre user → 404 (reste en base)', async () => {
    const a = await createManual('u2');
    const res = await request(app).delete(`/api/activities/${a.id}`).set('x-test-user', 'u1');
    expect(res.status).toBe(404);
    const row = await db.prepare('SELECT id FROM activities WHERE id = ?').get(a.id);
    expect(row).toBeTruthy();
  });
});
