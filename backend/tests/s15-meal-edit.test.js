'use strict';
/**
 * S15 — Édition d'un repas enregistré + sauces/condiments (backend nutridz).
 *
 * - PATCH /api/journal/:id : modifie la quantité (amount) → recalcul proportionnel kcal/macros + 200.
 * - PATCH /api/journal/:id d'un autre utilisateur → 404 (IDOR-guard sur req.userId).
 * - Ajout d'une sauce = nouvelle entrée de journal dans le même mealType, liée via parent_entry_id.
 * - Seed du catalogue condiments (kcal/100g + portion_default_g) dans products.
 *
 * Utilise une vraie base SQLite temporaire (NUTRIDZ_DB_PATH).
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.JWT_SECRET = 'test-secret-s15';
const TMP_DB = path.join(os.tmpdir(), `nutridz-s15-${process.pid}-${Date.now()}.db`);
process.env.NUTRIDZ_DB_PATH = TMP_DB;

// Auth mock : userId pris dans l'en-tête x-test-user (permet de simuler 2 users)
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = req.headers['x-test-user'] || 'u1';
  next();
});

const express = require('express');
const request = require('supertest');
const { getDB, initDB } = require('../db');

let app;
let db;
let productId;     // produit aliment de base
let condimentId;   // produit condiment seedé (Mayonnaise)

function makeApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/journal', require('../routes/journal'));
  return a;
}

beforeAll(async () => {
  await initDB();
  db = getDB();
  app = makeApp();

  // Postgres applique les FK (contrairement à SQLite) → créer les users référencés.
  await db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u1', 's15-u1@test.local', 'x', 'U1') ON CONFLICT (id) DO NOTHING").run();
  await db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('u2', 's15-u2@test.local', 'x', 'U2') ON CONFLICT (id) DO NOTHING").run();

  // Produit aliment de base : 200 kcal/100g, macros connues
  const p = await db.prepare(`
    INSERT INTO products (name, brand, kcal_per100, glucides, proteines, lipides, fibres)
    VALUES ('Aliment test', 'TestBrand', 200, 20, 10, 5, 2)
  `).run();
  productId = p.lastInsertRowid;

  // Condiment seedé : Mayonnaise (catalogue S15)
  const mayo = await db.prepare(
    "SELECT id, kcal_per100, portion_default_g FROM products WHERE category = 'condiment' AND name = 'Mayonnaise'"
  ).get();
  condimentId = mayo ? mayo.id : null;
});

afterAll(() => {
  try { fs.unlinkSync(TMP_DB); } catch (_) {}
});

// ─── Seed catalogue condiments ───────────────────────────────────────────────
describe('S15 — seed catalogue condiments', () => {
  test('le catalogue est seedé dans products (category=condiment)', async () => {
    const row = await db.prepare("SELECT COUNT(*) as cnt FROM products WHERE category = 'condiment'").get();
    expect(row.cnt).toBeGreaterThanOrEqual(50);
  });

  test('Mayonnaise : kcal/100g = 680 et portion_default_g = 15', async () => {
    const mayo = await db.prepare(
      "SELECT kcal_per100, portion_default_g FROM products WHERE category = 'condiment' AND name = 'Mayonnaise'"
    ).get();
    expect(mayo).toBeTruthy();
    expect(mayo.kcal_per100).toBe(680);
    expect(mayo.portion_default_g).toBe(15);
  });

  test('seed idempotent : ne duplique pas au 2e initDB', async () => {
    const before = await db.prepare("SELECT COUNT(*) as cnt FROM products WHERE category = 'condiment'").get();
    await initDB();
    const after = await db.prepare("SELECT COUNT(*) as cnt FROM products WHERE category = 'condiment'").get();
    expect(after.cnt).toBe(before.cnt);
  });
});

// ─── PATCH /api/journal/:id — recalcul proportionnel ─────────────────────────
describe('S15 — PATCH /api/journal/:id (quantité)', () => {
  test('modifie amount → 200 + kcal/macros recalculés proportionnellement', async () => {
    // Crée une entrée de 100 g (kcal 200, glucides 20, proteines 10, lipides 5, fibres 2)
    const create = await request(app)
      .post('/api/journal')
      .set('x-test-user', 'u1')
      .send({ food_id: String(productId), amount: 100, meal_type: 'lunch', date: '2026-06-25' });
    expect(create.status).toBe(201);
    const entryId = create.body.id;

    // Passe à 50 g → tout divisé par 2
    const patch = await request(app)
      .patch(`/api/journal/${entryId}`)
      .set('x-test-user', 'u1')
      .send({ amount: 50 });

    expect(patch.status).toBe(200);
    expect(patch.body.grams).toBe(50);
    expect(patch.body.kcal).toBe(100);
    expect(patch.body.glucides).toBe(10);
    expect(patch.body.proteines).toBe(5);
    expect(patch.body.lipides).toBe(2.5);
    expect(patch.body.fibres).toBe(1);

    // Persisté en base
    const row = await db.prepare('SELECT grams, kcal FROM journal_entries WHERE id = ?').get(entryId);
    expect(row.grams).toBe(50);
    expect(row.kcal).toBe(100);
  });

  test('quantité invalide → 400', async () => {
    const create = await request(app)
      .post('/api/journal')
      .set('x-test-user', 'u1')
      .send({ food_id: String(productId), amount: 100, meal_type: 'lunch', date: '2026-06-25' });
    const res = await request(app)
      .patch(`/api/journal/${create.body.id}`)
      .set('x-test-user', 'u1')
      .send({ amount: 0 });
    expect(res.status).toBe(400);
  });

  test('PATCH entrée inexistante → 404', async () => {
    const res = await request(app)
      .patch('/api/journal/does-not-exist')
      .set('x-test-user', 'u1')
      .send({ amount: 50 });
    expect(res.status).toBe(404);
  });

  test('IDOR : PATCH entrée d\'un autre user → 404', async () => {
    // Entrée appartenant à u2
    const create = await request(app)
      .post('/api/journal')
      .set('x-test-user', 'u2')
      .send({ food_id: String(productId), amount: 100, meal_type: 'dinner', date: '2026-06-25' });
    expect(create.status).toBe(201);

    // u1 tente de la modifier
    const res = await request(app)
      .patch(`/api/journal/${create.body.id}`)
      .set('x-test-user', 'u1')
      .send({ amount: 50 });
    expect(res.status).toBe(404);

    // Inchangée en base
    const row = await db.prepare('SELECT grams FROM journal_entries WHERE id = ?').get(create.body.id);
    expect(row.grams).toBe(100);
  });
});

// ─── Ajout d'une sauce = nouvelle entrée liée ────────────────────────────────
describe('S15 — ajout condiment = nouvelle entrée liée (parent_entry_id)', () => {
  test('le condiment crée une entrée dans le même mealType, liée au parent', async () => {
    // Aliment parent au déjeuner
    const parent = await request(app)
      .post('/api/journal')
      .set('x-test-user', 'u1')
      .send({ food_id: String(productId), amount: 150, meal_type: 'lunch', date: '2026-06-26' });
    expect(parent.status).toBe(201);
    const parentId = parent.body.id;

    // Ajout d'une sauce (condiment seedé) liée à l'aliment, même repas
    const sauce = await request(app)
      .post('/api/journal')
      .set('x-test-user', 'u1')
      .send({
        food_id: String(condimentId),
        amount: 15,
        meal_type: 'lunch',
        date: '2026-06-26',
        parent_entry_id: parentId,
      });
    expect(sauce.status).toBe(201);

    const row = await db.prepare(
      'SELECT meal_type, parent_entry_id, kcal FROM journal_entries WHERE id = ?'
    ).get(sauce.body.id);
    expect(row.meal_type).toBe('dej');         // lunch → dej (interne)
    expect(row.parent_entry_id).toBe(parentId);
    expect(row.kcal).toBe(102);                 // mayo 680 kcal/100g × 15 g = 102
  });
});
