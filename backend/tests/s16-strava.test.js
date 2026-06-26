'use strict';
/**
 * S16 — Brancher Strava (backend nutridz).
 *
 * Câble le service services/strava.js dans routes/strava.js :
 *   GET    /api/strava/connect    (auth) → URL OAuth, state signé anti-CSRF
 *   GET    /api/strava/callback           → exchangeCode → stocke tokens → redirige app
 *   GET    /api/strava/status     (auth) → { connected, athleteName }
 *   POST   /api/strava/sync       (auth) → importe les activités du jour (dédup)
 *   DELETE /api/strava/disconnect (auth) → efface les tokens
 *
 * Tokens backend-only. axios mocké. Vraie base SQLite temporaire (NUTRIDZ_DB_PATH).
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.JWT_SECRET = 'test-secret-s16';
process.env.STRAVA_CLIENT_ID = '12345';
process.env.STRAVA_CLIENT_SECRET = 'secret';
process.env.STRAVA_REDIRECT_URI = 'https://nutridz.onrender.com/api/strava/callback';
process.env.FRONTEND_URL = 'https://nutrivita-v0.onrender.com';
const TMP_DB = path.join(os.tmpdir(), `nutridz-s16-${process.pid}-${Date.now()}.db`);
process.env.NUTRIDZ_DB_PATH = TMP_DB;

jest.mock('axios');
// Auth mock : userId pris dans l'en-tête x-test-user (simule 2 users)
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = req.headers['x-test-user'] || 'u1';
  next();
});

const axios = require('axios');
const express = require('express');
const request = require('supertest');
const { getDB, initDB } = require('../db');

let app;
let db;

function makeApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/strava', require('../routes/strava'));
  return a;
}

// Tokens renvoyés par l'échange OAuth Strava
const FUTURE = Math.floor(Date.now() / 1000) + 6 * 3600;
const TOKENS = {
  access_token: 'acc-123',
  refresh_token: 'ref-456',
  expires_at: FUTURE,
  athlete: { id: 99887766, firstname: 'Ahmed', lastname: 'B.' },
};

// Activités renvoyées par GET /athlete/activities
const STRAVA_ACTIVITIES = [
  { id: 1001, sport_type: 'Run', moving_time: 1800, distance: 5000, kilojoules: 1255, name: 'Footing matin' },
  { id: 1002, type: 'Ride', moving_time: 3600, distance: 20000, calories: 400, name: 'Sortie vélo' },
];

function mockAxios() {
  axios.post = jest.fn((url) => {
    if (String(url).includes('/oauth/token')) return Promise.resolve({ data: TOKENS });
    return Promise.reject(new Error('unexpected post ' + url));
  });
  axios.get = jest.fn((url) => {
    if (String(url).includes('/athlete/activities')) return Promise.resolve({ data: STRAVA_ACTIVITIES });
    return Promise.reject(new Error('unexpected get ' + url));
  });
}

beforeAll(async () => {
  await initDB();
  db = getDB();
  app = makeApp();
  // Profils pour 2 users
  await db.prepare("INSERT OR IGNORE INTO profiles (user_id, weight) VALUES ('u1', 70)").run();
  await db.prepare("INSERT OR IGNORE INTO profiles (user_id, weight) VALUES ('u2', 80)").run();
});

beforeEach(() => { jest.clearAllMocks(); mockAxios(); });

afterAll(() => { try { fs.unlinkSync(TMP_DB); } catch (_) {} });

// Extrait le paramètre state de l'URL OAuth renvoyée par /connect
function stateFromUrl(url) {
  return new URL(url).searchParams.get('state');
}

// ─── GET /api/strava/connect ─────────────────────────────────────────────────
describe('S16 — GET /api/strava/connect', () => {
  test('renvoie une URL OAuth Strava valide avec un state signé', async () => {
    const res = await request(app).get('/api/strava/connect').set('x-test-user', 'u1');
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^https:\/\/www\.strava\.com\/oauth\/authorize\?/);
    const u = new URL(res.body.url);
    expect(u.searchParams.get('client_id')).toBe('12345');
    expect(u.searchParams.get('scope')).toBe('activity:read_all');
    const state = u.searchParams.get('state');
    expect(state).toBeTruthy();
    // state signé (JWT) → 3 segments, pas le userId en clair
    expect(state).not.toBe('u1');
    expect(state.split('.')).toHaveLength(3);
  });

  test('503 si Strava non configuré (STRAVA_CLIENT_ID manquant)', async () => {
    const saved = process.env.STRAVA_CLIENT_ID;
    delete process.env.STRAVA_CLIENT_ID;
    const res = await request(app).get('/api/strava/connect').set('x-test-user', 'u1');
    process.env.STRAVA_CLIENT_ID = saved;
    expect(res.status).toBe(503);
  });
});

// ─── GET /api/strava/callback ────────────────────────────────────────────────
describe('S16 — GET /api/strava/callback', () => {
  test('state valide + code → stocke les tokens et redirige avec succès', async () => {
    const connect = await request(app).get('/api/strava/connect').set('x-test-user', 'u1');
    const state = stateFromUrl(connect.body.url);

    const res = await request(app).get('/api/strava/callback').query({ code: 'auth-code', state });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('strava=ok');

    const row = await db.prepare(
      'SELECT strava_access_token, strava_refresh_token, strava_athlete_id, strava_token_expires_at, strava_athlete_name FROM profiles WHERE user_id = ?'
    ).get('u1');
    expect(row.strava_access_token).toBe('acc-123');
    expect(row.strava_refresh_token).toBe('ref-456');
    expect(row.strava_athlete_id).toBe('99887766');
    expect(row.strava_token_expires_at).toBe(FUTURE);
    expect(row.strava_athlete_name).toBe('Ahmed B.');
  });

  test('state forgé/invalide → redirige en erreur, aucun token stocké (anti-CSRF)', async () => {
    const res = await request(app).get('/api/strava/callback').query({ code: 'auth-code', state: 'forged.state.value' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('strava=error');

    const row = await db.prepare('SELECT strava_access_token FROM profiles WHERE user_id = ?').get('u2');
    expect(row.strava_access_token == null).toBe(true);
    // exchangeCode ne doit pas être appelé sur un state invalide
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('paramètres manquants → redirige en erreur', async () => {
    const res = await request(app).get('/api/strava/callback').query({ state: 'x' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('strava=error');
  });
});

// ─── GET /api/strava/status ──────────────────────────────────────────────────
describe('S16 — GET /api/strava/status', () => {
  test('reflète l\'état connecté + nom athlète', async () => {
    // u1 connecté via le callback précédent (describe ordonné) — on (re)connecte pour robustesse
    const connect = await request(app).get('/api/strava/connect').set('x-test-user', 'u1');
    const state = stateFromUrl(connect.body.url);
    await request(app).get('/api/strava/callback').query({ code: 'c', state });

    const res = await request(app).get('/api/strava/status').set('x-test-user', 'u1');
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(res.body.athleteName).toBe('Ahmed B.');
  });

  test('IDOR : u2 (non connecté) → connected:false même si u1 connecté', async () => {
    const res = await request(app).get('/api/strava/status').set('x-test-user', 'u2');
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
    expect(res.body.athleteName).toBeNull();
  });
});

// ─── POST /api/strava/sync ───────────────────────────────────────────────────
describe('S16 — POST /api/strava/sync', () => {
  test('importe les activités du jour, sans doublon au 2e sync', async () => {
    // u1 connecté
    const connect = await request(app).get('/api/strava/connect').set('x-test-user', 'u1');
    const state = stateFromUrl(connect.body.url);
    await request(app).get('/api/strava/callback').query({ code: 'c', state });

    const first = await request(app).post('/api/strava/sync').set('x-test-user', 'u1');
    expect(first.status).toBe(200);
    expect(first.body.connected).toBe(true);
    expect(first.body.imported).toBe(2);

    const countAfter1 = await db.prepare(
      "SELECT COUNT(*) as c FROM activities WHERE user_id = 'u1' AND source = 'strava'"
    ).get();
    expect(countAfter1.c).toBe(2);

    // 2e sync : mêmes activités Strava → aucun doublon
    const second = await request(app).post('/api/strava/sync').set('x-test-user', 'u1');
    expect(second.status).toBe(200);
    expect(second.body.imported).toBe(0);

    const countAfter2 = await db.prepare(
      "SELECT COUNT(*) as c FROM activities WHERE user_id = 'u1' AND source = 'strava'"
    ).get();
    expect(countAfter2.c).toBe(2);
  });

  test('non connecté → 200 connected:false, imported:0, sans appel réseau', async () => {
    const res = await request(app).post('/api/strava/sync').set('x-test-user', 'u2');
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
    expect(res.body.imported).toBe(0);
    expect(axios.get).not.toHaveBeenCalled();
  });
});

// ─── DELETE /api/strava/disconnect ───────────────────────────────────────────
describe('S16 — DELETE /api/strava/disconnect', () => {
  test('efface les tokens → status connected:false', async () => {
    // u1 connecté
    const connect = await request(app).get('/api/strava/connect').set('x-test-user', 'u1');
    const state = stateFromUrl(connect.body.url);
    await request(app).get('/api/strava/callback').query({ code: 'c', state });

    const del = await request(app).delete('/api/strava/disconnect').set('x-test-user', 'u1');
    expect(del.status).toBe(200);
    expect(del.body.connected).toBe(false);

    const row = await db.prepare(
      'SELECT strava_access_token, strava_refresh_token, strava_athlete_name FROM profiles WHERE user_id = ?'
    ).get('u1');
    expect(row.strava_access_token == null).toBe(true);
    expect(row.strava_refresh_token == null).toBe(true);
    expect(row.strava_athlete_name == null).toBe(true);

    const status = await request(app).get('/api/strava/status').set('x-test-user', 'u1');
    expect(status.body.connected).toBe(false);
  });
});
