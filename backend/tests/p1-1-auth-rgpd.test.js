'use strict';
/**
 * P1-1 — Tests des routes critiques auth + RGPD (db mockée).
 *
 * register (201 / 409 / 400), login (200 / 401), export RGPD (200 / 401),
 * suppression de compte RGPD (200 + cascade).
 */

process.env.JWT_SECRET = 'test-secret-p1-1';

let mockDb;
jest.mock('../db', () => ({ getDB: () => mockDb }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authRoutes = require('../routes/auth');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/user', authRoutes); // /export et /account (RGPD)
  return app;
}
const bearer = (uid) => `Bearer ${jwt.sign({ userId: uid }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;

// ─── register ────────────────────────────────────────────────────────────────
describe('POST /api/auth/register (P1-1)', () => {
  test('succès → 201 + token + user', async () => {
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(null), // pas d'email existant
        run: jest.fn().mockResolvedValue({ changes: 1 }),
      }),
    };
    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'new@user.co', password: 'secret123', name: 'Nadia' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('new@user.co');
  });

  test('email déjà utilisé → 409', async () => {
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ id: 'existing' }),
        run: jest.fn().mockResolvedValue({ changes: 1 }),
      }),
    };
    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'dup@user.co', password: 'secret123', name: 'Dup' });
    expect(res.status).toBe(409);
  });

  test('email invalide → 400', async () => {
    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'secret123', name: 'X' });
    expect(res.status).toBe(400);
  });

  test('mot de passe trop court → 400', async () => {
    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'short@user.co', password: '123', name: 'X' });
    expect(res.status).toBe(400);
  });
});

// ─── login ───────────────────────────────────────────────────────────────────
describe('POST /api/auth/login (P1-1)', () => {
  test('succès → 200 + token', async () => {
    const hash = bcrypt.hashSync('secret123', 10);
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.co', name: 'A', password_hash: hash }),
      }),
    };
    const res = await request(makeApp()).post('/api/auth/login').send({ email: 'a@b.co', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('mauvais mot de passe → 401', async () => {
    const hash = bcrypt.hashSync('secret123', 10);
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.co', name: 'A', password_hash: hash }),
      }),
    };
    const res = await request(makeApp()).post('/api/auth/login').send({ email: 'a@b.co', password: 'WRONG' });
    expect(res.status).toBe(401);
  });

  test('utilisateur inconnu → 401', async () => {
    mockDb = { prepare: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(null) }) };
    const res = await request(makeApp()).post('/api/auth/login').send({ email: 'ghost@user.co', password: 'secret123' });
    expect(res.status).toBe(401);
  });
});

// ─── export RGPD ───────────────────────────────────────────────────────────────
describe('GET /api/user/export (P1-1, RGPD)', () => {
  test('sans token → 401', async () => {
    const res = await request(makeApp()).get('/api/user/export');
    expect(res.status).toBe(401);
  });

  test('avec token → 200 + payload structuré', async () => {
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ id: 'user-1234', email: 'a@b.co', name: 'A' }),
        all: jest.fn().mockResolvedValue([]),
      }),
    };
    const res = await request(makeApp()).get('/api/user/export').set('Authorization', bearer('user-1234'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('export_date');
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('journal_entries');
    expect(res.body).toHaveProperty('glucose_readings');
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });
});

// ─── suppression de compte RGPD ────────────────────────────────────────────────
describe('DELETE /api/user/account (P1-1, RGPD)', () => {
  test('sans token → 401', async () => {
    const res = await request(makeApp()).delete('/api/user/account');
    expect(res.status).toBe(401);
  });

  test('avec token → 200 + cascade de suppression exécutée', async () => {
    const run = jest.fn().mockResolvedValue({ changes: 1 });
    mockDb = { prepare: jest.fn().mockReturnValue({ run }) };
    const res = await request(makeApp()).delete('/api/user/account').set('Authorization', bearer('user-1234'));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // users + profiles + 7 tables de données + push_subscriptions → plusieurs DELETE
    expect(run).toHaveBeenCalled();
    expect(mockDb.prepare.mock.calls.some(c => /DELETE FROM users/i.test(c[0]))).toBe(true);
  });
});
