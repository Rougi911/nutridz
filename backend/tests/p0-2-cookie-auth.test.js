'use strict';
/**
 * P0-2 — Migration auth JWT → cookie httpOnly (rétro-compatible).
 *
 * Stratégie : le backend accepte Bearer ET cookie en parallèle. CSRF (double-submit)
 * n'est imposé que pour les requêtes authentifiées PAR COOKIE et mutantes (POST/PUT/
 * PATCH/DELETE) — les requêtes Bearer restent immunisées (non-régression frontend actuel).
 *
 * Couvre : login (token + Set-Cookie httpOnly + csrf), refresh, logout,
 *          middleware (Bearer, cookie, CSRF), non-régression Bearer.
 */

process.env.JWT_SECRET = 'test-secret-p0-2';

let mockDb;
jest.mock('../db', () => ({ getDB: () => mockDb }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const authRoutes = require('../routes/auth');

const sign = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });

function middlewareApp() {
  const app = express();
  app.use(express.json());
  app.get('/p', auth, (req, res) => res.json({ userId: req.userId }));
  app.post('/p', auth, (req, res) => res.json({ userId: req.userId }));
  return app;
}

function routesApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

// ─── Middleware : Bearer / cookie / CSRF ─────────────────────────────────────
describe('authMiddleware — Bearer + cookie + CSRF (P0-2)', () => {
  const app = middlewareApp();

  test('aucun token → 401', async () => {
    const res = await request(app).get('/p');
    expect(res.status).toBe(401);
  });

  test('Bearer valide → 200 (non-régression)', async () => {
    const res = await request(app).get('/p').set('Authorization', `Bearer ${sign('u1')}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('u1');
  });

  test('Bearer invalide → 403', async () => {
    const res = await request(app).get('/p').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(403);
  });

  test('cookie token valide → 200 (GET, pas de CSRF requis)', async () => {
    const res = await request(app).get('/p').set('Cookie', [`token=${sign('u2')}`]);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('u2');
  });

  test('cookie + POST sans header CSRF → 403', async () => {
    const res = await request(app).post('/p').set('Cookie', [`token=${sign('u3')}; csrf=abc123`]);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/csrf/i);
  });

  test('cookie + POST avec X-CSRF-Token correspondant → 200', async () => {
    const res = await request(app)
      .post('/p')
      .set('Cookie', [`token=${sign('u4')}; csrf=abc123`])
      .set('X-CSRF-Token', 'abc123');
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('u4');
  });

  test('cookie + POST avec X-CSRF-Token non correspondant → 403', async () => {
    const res = await request(app)
      .post('/p')
      .set('Cookie', [`token=${sign('u5')}; csrf=abc123`])
      .set('X-CSRF-Token', 'WRONG');
    expect(res.status).toBe(403);
  });

  test('Bearer + POST sans CSRF → 200 (Bearer immunisé)', async () => {
    const res = await request(app).post('/p').set('Authorization', `Bearer ${sign('u6')}`);
    expect(res.status).toBe(200);
  });
});

// ─── Routes login / logout / refresh ─────────────────────────────────────────
describe('routes auth — login/logout/refresh cookies (P0-2)', () => {
  const app = routesApp();

  test('POST /login → token + csrfToken + Set-Cookie httpOnly', async () => {
    const hash = bcrypt.hashSync('password123', 10);
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.co', name: 'A', password_hash: hash }),
        run: jest.fn().mockResolvedValue({ changes: 1 }),
      }),
    };
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.csrfToken).toBeTruthy();
    const setCookie = (res.headers['set-cookie'] || []).join(' ; ');
    expect(setCookie).toMatch(/token=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/csrf=/);
  });

  test('POST /login mauvais mot de passe → 401, pas de cookie', async () => {
    const hash = bcrypt.hashSync('password123', 10);
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.co', name: 'A', password_hash: hash }),
      }),
    };
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'WRONG' });
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('POST /logout → 200 + cookie token effacé', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    const setCookie = (res.headers['set-cookie'] || []).join(' ; ');
    expect(setCookie).toMatch(/token=;/);
  });

  test('POST /refresh avec Bearer → 200 + nouveau token + Set-Cookie', async () => {
    const res = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${sign('u1')}`);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    const setCookie = (res.headers['set-cookie'] || []).join(' ; ');
    expect(setCookie).toMatch(/token=/);
  });

  test('POST /refresh sans auth → 401', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});
