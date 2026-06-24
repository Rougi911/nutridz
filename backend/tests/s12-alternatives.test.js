'use strict';
/**
 * S12 — GET /api/alternatives/:barcode (backend).
 * Produit + alternatives mieux notées → liste triée, origine exclue ; OFF KO → [].
 */

jest.mock('../middleware/auth', () => (req, _res, next) => { req.userId = 'u1'; next(); });
jest.mock('axios');

const axios = require('axios');
const express = require('express');
const request = require('supertest');
const alternativesRouter = require('../routes/alternatives');

function makeApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/alternatives', alternativesRouter);
  return a;
}
const app = makeApp();

const IMG = 'https://img/x.jpg';
const ORIGIN = '1111111';
// origine grade d ; la recherche renvoie un panier varié
const SEARCH_PRODUCTS = [
  { code: ORIGIN, product_name: 'Origine', nutriscore_grade: 'd', image_front_small_url: IMG }, // origine → exclue
  { code: '2222222', product_name: 'Meilleur A', nutriscore_grade: 'a', image_front_small_url: IMG },
  { code: '3333333', product_name: 'Moyen C', nutriscore_grade: 'c', image_front_small_url: IMG },
  { code: '4444444', product_name: 'Pire E', nutriscore_grade: 'e', image_front_small_url: IMG }, // pas meilleur → exclu
  { code: '5555555', product_name: 'B sans image', nutriscore_grade: 'b', image_front_small_url: '' }, // sans image → exclu
  { code: '6666666', product_name: '', nutriscore_grade: 'a', image_front_small_url: IMG }, // sans nom → exclu
  { code: '7777777', product_name: 'B ok', nutriscore_grade: 'b', image_front_small_url: IMG },
];

beforeEach(() => jest.clearAllMocks());

function mockOff({ product, search }) {
  axios.get = jest.fn((url) => {
    if (String(url).includes('/api/v0/product/')) return Promise.resolve({ data: product });
    if (String(url).includes('/api/v2/search')) return Promise.resolve({ data: search });
    return Promise.reject(new Error('unexpected url'));
  });
}

test('catégorie + alternatives mieux notées → liste triée par grade, origine exclue', async () => {
  mockOff({
    product: { status: 1, product: { categories_tags: ['en:snacks', 'en:biscuits'], nutriscore_grade: 'd' } },
    search: { products: SEARCH_PRODUCTS },
  });
  const res = await request(app).get(`/api/alternatives/${ORIGIN}`);
  expect(res.status).toBe(200);
  expect(res.body.category).toBe('en:biscuits'); // catégorie la plus spécifique
  const codes = res.body.alternatives.map(a => a.barcode);
  expect(codes).toEqual(['2222222', '7777777', '3333333']); // triés a, b, c
  expect(res.body.alternatives.map(a => a.nutriScore)).toEqual(['a', 'b', 'c']);
  expect(codes).not.toContain(ORIGIN);    // origine exclue
  expect(codes).not.toContain('4444444'); // e pas meilleur que d
  expect(codes).not.toContain('5555555'); // sans image
  expect(codes).not.toContain('6666666'); // sans nom
  expect(res.body.alternatives[0]).toEqual({ barcode: '2222222', name: 'Meilleur A', nutriScore: 'a', imageUrl: IMG });
});

test('max 5 alternatives', async () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ code: `90000${i}`, product_name: 'P' + i, nutriscore_grade: 'a', image_front_small_url: IMG }));
  mockOff({
    product: { status: 1, product: { categories_tags: ['en:biscuits'], nutriscore_grade: 'e' } },
    search: { products: many },
  });
  const res = await request(app).get('/api/alternatives/9999999');
  expect(res.body.alternatives).toHaveLength(5);
});

test('OFF produit indisponible → 200 alternatives:[]', async () => {
  axios.get = jest.fn().mockRejectedValue(Object.assign(new Error('down'), { code: 'ECONNABORTED' }));
  const res = await request(app).get(`/api/alternatives/${ORIGIN}`);
  expect(res.status).toBe(200);
  expect(res.body.alternatives).toEqual([]);
});

test('produit sans catégorie → 200 alternatives:[]', async () => {
  mockOff({ product: { status: 1, product: { categories_tags: [], nutriscore_grade: 'd' } }, search: { products: [] } });
  const res = await request(app).get(`/api/alternatives/${ORIGIN}`);
  expect(res.status).toBe(200);
  expect(res.body.alternatives).toEqual([]);
});

test('recherche OFF KO → 200 alternatives:[] avec catégorie', async () => {
  axios.get = jest.fn((url) => {
    if (String(url).includes('/api/v0/product/')) return Promise.resolve({ data: { status: 1, product: { categories_tags: ['en:biscuits'], nutriscore_grade: 'd' } } });
    return Promise.reject(new Error('search down'));
  });
  const res = await request(app).get(`/api/alternatives/${ORIGIN}`);
  expect(res.status).toBe(200);
  expect(res.body.category).toBe('en:biscuits');
  expect(res.body.alternatives).toEqual([]);
});

test('code-barres invalide → 400', async () => {
  const res = await request(app).get('/api/alternatives/abc');
  expect(res.status).toBe(400);
});

test('produit introuvable chez OFF → 200 alternatives:[]', async () => {
  mockOff({ product: { status: 0 }, search: { products: [] } });
  const res = await request(app).get(`/api/alternatives/${ORIGIN}`);
  expect(res.status).toBe(200);
  expect(res.body.alternatives).toEqual([]);
});
