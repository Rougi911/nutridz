'use strict';
/**
 * S26 — Préférences de notifications (rappels). GET défauts / PUT maj / bornage heures / IDOR.
 * (L'envoi push + VAPID n'est pas couvert ici — étape ultérieure.)
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.JWT_SECRET = 'test-secret-s26';
const TMP_DB = path.join(os.tmpdir(), `nutridz-s26-${process.pid}-${Date.now()}.db`);
process.env.NUTRIDZ_DB_PATH = TMP_DB;

jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = req.headers['x-test-user'] || 'u1';
  next();
});

const express = require('express');
const request = require('supertest');
const { getDB, initDB } = require('../db');

let app, db;

beforeAll(async () => {
  await initDB();
  db = getDB();
  app = express();
  app.use(express.json());
  app.use('/api/notifications', require('../routes/notifications'));
  await db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 's26-u1@test.local', 'x', 'U1') ON CONFLICT (id) DO NOTHING").run();
  await db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u2', 's26-u2@test.local', 'x', 'U2') ON CONFLICT (id) DO NOTHING").run();
});

afterAll(() => { try { fs.unlinkSync(TMP_DB); } catch (_) {} });

describe('S26 — préférences de rappels', () => {
  test('GET /prefs sans enregistrement → valeurs par défaut', async () => {
    const res = await request(app).get('/api/notifications/prefs').set('x-test-user', 'u1');
    expect(res.status).toBe(200);
    expect(res.body.journal_enabled).toBe(false);
    expect(res.body.journal_time).toBe('20:00');
    expect(res.body.glucose_enabled).toBe(false);
    expect(res.body.geo_consent).toBe(false);
  });

  test('PUT /prefs met à jour, GET reflète', async () => {
    const put = await request(app).put('/api/notifications/prefs').set('x-test-user', 'u1')
      .send({ journal_enabled: true, journal_time: '07:30', glucose_enabled: true, geo_consent: true });
    expect(put.status).toBe(200);
    expect(put.body.prefs.journal_enabled).toBe(true);
    expect(put.body.prefs.journal_time).toBe('07:30');

    const get = await request(app).get('/api/notifications/prefs').set('x-test-user', 'u1');
    expect(get.body.journal_enabled).toBe(true);
    expect(get.body.journal_time).toBe('07:30');
    expect(get.body.glucose_enabled).toBe(true);
    expect(get.body.geo_consent).toBe(true);
  });

  test('patch partiel : n\'écrase pas les autres champs (fix régression notifications)', async () => {
    await request(app).put('/api/notifications/prefs').set('x-test-user', 'u1')
      .send({ journal_enabled: true, journal_time: '07:30' });
    // active la glycémie SANS toucher au journal
    await request(app).put('/api/notifications/prefs').set('x-test-user', 'u1')
      .send({ glucose_enabled: true });
    const get = await request(app).get('/api/notifications/prefs').set('x-test-user', 'u1');
    expect(get.body.journal_enabled).toBe(true);  // toujours actif
    expect(get.body.journal_time).toBe('07:30');   // heure conservée
    expect(get.body.glucose_enabled).toBe(true);
  });

  test('heure invalide → conserve la valeur courante (fusion, pas de désactivation)', async () => {
    await request(app).put('/api/notifications/prefs').set('x-test-user', 'u1').send({ journal_time: '06:15' });
    const put = await request(app).put('/api/notifications/prefs').set('x-test-user', 'u1').send({ journal_time: '99:99' });
    expect(put.body.prefs.journal_time).toBe('06:15');
  });

  test('IDOR : les prefs de u2 n\'affectent pas u1', async () => {
    await request(app).put('/api/notifications/prefs').set('x-test-user', 'u2')
      .send({ hydration_enabled: true });
    const u1 = await request(app).get('/api/notifications/prefs').set('x-test-user', 'u1');
    expect(u1.body.hydration_enabled).toBe(false); // u1 n'a jamais activé l'hydratation
  });

  test('subscribe stocke un abonnement (table existante)', async () => {
    const res = await request(app).post('/api/notifications/subscribe').set('x-test-user', 'u1')
      .send({ subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'x', auth: 'y' } } });
    expect(res.status).toBe(200);
    const row = await db.prepare('SELECT user_id FROM push_subscriptions WHERE user_id = ?').get('u1');
    expect(row).toBeTruthy();
  });
});
