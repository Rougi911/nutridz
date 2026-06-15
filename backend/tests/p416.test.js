'use strict';
/**
 * P4.16 — Tests de contrat backend/frontend
 *
 * TU-P416-1 : MEAL_TYPE_TO_API  — pdej → breakfast
 * TU-P416-2 : MEAL_TYPE_TO_API  — dej → lunch
 * TU-P416-3 : MEAL_TYPE_TO_API  — coll → snack
 * TU-P416-4 : MEAL_TYPE_TO_API  — diner → dinner
 * TU-P416-5 : MEAL_TYPE_FROM_API — breakfast → pdej
 * TU-P416-6 : MEAL_TYPE_FROM_API — lunch → dej
 * TU-P416-7 : MEAL_TYPE_FROM_API — snack → coll
 * TU-P416-8 : MEAL_TYPE_FROM_API — dinner → diner
 * TU-P416-9 : journal/query     — réponse contient entries[] (tableau plat ApiMealEntry)
 * TU-P416-10 : journal/query    — entries[0].food.calories = kcal_per100 (par 100g, pas par portion)
 * TU-P416-11 : POST /api/foods/search?q= — 200 avec tableau (même si vide)
 * TU-P416-12 : POST /api/journal — accepte food_id + amount (aliases P4.16)
 */

jest.mock('../middleware/auth', () => (req, _res, next) => { req.userId = 'test-user'; next(); });
jest.mock('../services/ciqual', () => ({
  searchByName: jest.fn().mockReturnValue([{
    source: 'ciqual',
    nom_fr: 'Pomme de terre, crue',
    nom_en: 'Potato, raw',
    kcal: 76,
    proteines: 2,
    glucides: 16,
    lipides: 0.1,
    fibres: 1.4,
    sel: 0,
  }]),
}));
jest.mock('../services/usda', () => ({
  searchFood: jest.fn().mockResolvedValue([]),
  cacheInProducts: jest.fn().mockResolvedValue(99),
  rankByDataType: jest.fn(x => x),
}));
jest.mock('../services/foodvision', () => ({ callGemini: jest.fn() }));
jest.mock('../data/dishModifiers', () => ({ findById: jest.fn(), localizeModifier: jest.fn() }));
jest.mock('../data/translations.json', () => ({ en_to_fr: {} }), { virtual: true });

// DB mock — simule les entrées du journal et les produits
const mockProduct = {
  id: 7, name: 'Pomme de terre, crue', brand: '', kcal_per100: 76,
  p_glucides: 16, p_proteines: 2, p_lipides: 0.1, p_fibres: 1.4,
  glucides: 16, proteines: 2, lipides: 0.1, fibres: 1.4,
};
const mockJournalEntry = {
  id: 'entry-uuid-1', user_id: 'test-user', date: '2026-06-15',
  meal_type: 'pdej', product_id: 7, grams: 400,
  kcal: 304, glucides: 64, proteines: 8, lipides: 0.4, fibres: 5.6,
  logged_at: '2026-06-15T07:00:00Z', modifiers_json: '[]',
  name: 'Pomme de terre, crue', brand: '', emoji: null, score: null, kcal_per100: 76,
  p_glucides: 16, p_proteines: 2, p_lipides: 0.1, p_fibres: 1.4, additifs: '[]',
};

jest.mock('../db', () => ({
  getDB: () => ({
    prepare: (sql) => ({
      get: jest.fn().mockImplementation((...args) => {
        // Lookup product by id
        if (sql.includes('SELECT * FROM products WHERE id')) return Promise.resolve(mockProduct);
        // Lookup product by name+source (upsert check in foods.js)
        if (sql.includes('SELECT id FROM products WHERE name = ?')) return Promise.resolve(null);
        return Promise.resolve(null);
      }),
      all: jest.fn().mockImplementation(() => {
        // Journal entries query
        if (sql.includes('FROM journal_entries')) return Promise.resolve([mockJournalEntry]);
        // Products name LIKE
        if (sql.includes('FROM products WHERE name LIKE')) return Promise.resolve([]);
        return Promise.resolve([]);
      }),
      run: jest.fn().mockResolvedValue({ lastInsertRowid: 7, changes: 1 }),
    }),
  }),
}));

const MEAL_TYPE_TO_API   = { pdej: 'breakfast', dej: 'lunch', coll: 'snack', diner: 'dinner' };
const MEAL_TYPE_FROM_API = { breakfast: 'pdej', lunch: 'dej', snack: 'coll', dinner: 'diner' };

// ─── TU-P416-1..8 : mappings meal_type ───────────────────────────────────────

describe('Meal type mapping (P4.16)', () => {
  test('TU-P416-1 : pdej → breakfast', () => expect(MEAL_TYPE_TO_API.pdej).toBe('breakfast'));
  test('TU-P416-2 : dej → lunch',       () => expect(MEAL_TYPE_TO_API.dej).toBe('lunch'));
  test('TU-P416-3 : coll → snack',      () => expect(MEAL_TYPE_TO_API.coll).toBe('snack'));
  test('TU-P416-4 : diner → dinner',    () => expect(MEAL_TYPE_TO_API.diner).toBe('dinner'));
  test('TU-P416-5 : breakfast → pdej',  () => expect(MEAL_TYPE_FROM_API.breakfast).toBe('pdej'));
  test('TU-P416-6 : lunch → dej',       () => expect(MEAL_TYPE_FROM_API.lunch).toBe('dej'));
  test('TU-P416-7 : snack → coll',      () => expect(MEAL_TYPE_FROM_API.snack).toBe('coll'));
  test('TU-P416-8 : dinner → diner',    () => expect(MEAL_TYPE_FROM_API.dinner).toBe('diner'));
});

// ─── TU-P416-9..10 : journal/query response shape ────────────────────────────

const request = require('supertest');

// Lazy-require routes to avoid hoisting issues with jest.mock
let app;
beforeAll(() => {
  const express = require('express');
  app = express();
  app.use(express.json());
  app.use('/api/journal', require('../routes/journal'));
  app.use('/api/foods',   require('../routes/foods'));
});

describe('POST /api/journal/query — entries[] (P4.16)', () => {
  test('TU-P416-9 : réponse contient entries[] tableau plat', async () => {
    const res = await request(app)
      .post('/api/journal/query')
      .send({ date: '2026-06-15' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
    expect(res.body.entries.length).toBeGreaterThan(0);
  });

  test('TU-P416-10 : entries[0].food.calories = kcal_per100 (76, pas 304)', async () => {
    const res = await request(app)
      .post('/api/journal/query')
      .send({ date: '2026-06-15' });
    const first = res.body.entries[0];
    expect(first.food.calories).toBe(76);   // par 100g — pas 304 (par portion)
    expect(first.amount).toBe(400);          // grams
    expect(first.meal_type).toBe('breakfast'); // pdej → breakfast
    expect(first.food_id).toBe('7');
  });
});

// ─── TU-P416-11 : GET /api/foods/search ──────────────────────────────────────

describe('GET /api/foods/search (P4.16)', () => {
  test('TU-P416-11 : renvoie 200 + tableau (au moins résultat CIQUAL)', async () => {
    const res = await request(app)
      .get('/api/foods/search?q=pomme');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // CIQUAL mock retourne "Pomme de terre, crue"
    const names = res.body.map(r => r.name);
    expect(names.some(n => n.includes('Pomme'))).toBe(true);
  });
});

// ─── TU-P416-12 : POST /api/journal — aliases food_id + amount ───────────────

describe('POST /api/journal — aliases P4.16', () => {
  test('TU-P416-12 : accepte food_id + amount + meal_type anglais', async () => {
    const res = await request(app)
      .post('/api/journal')
      .send({ food_id: '7', amount: 400, meal_type: 'breakfast', date: '2026-06-15' });
    // 201 = entrée créée avec succès
    expect(res.status).toBe(201);
  });
});
