'use strict';
/**
 * S5 — Extraction composition étiquette : parser durci (`buildComposition`) + endpoint
 * POST /api/scan/composition.
 *
 * Les 23 scénarios du prototype validé sont rejoués contre les VRAIS dictionnaires
 * (`ADDITIVES_CLASSIFICATION` / `ADDITIVES_NAMES`). Seule adaptation : le nom « caramel »
 * (absent du dico réel — il liste les caramels par variante précise) est remplacé par
 * « curcumine » (présent), pour préserver l'intention « nom → code E » du scénario.
 */

process.env.GEMINI_API_KEY = 'test-key'; // callGeminiLabel exige une clé avant l'appel (mocké)

jest.mock('../middleware/auth', () => (req, _res, next) => { req.userId = 'u1'; next(); });
jest.mock('../db', () => ({ getDB: () => ({ prepare: () => ({ get: jest.fn().mockResolvedValue(null), run: jest.fn().mockResolvedValue({ changes: 1 }), all: jest.fn().mockResolvedValue([]) }) }) }));
jest.mock('axios');

const axios = require('axios');
const express = require('express');
const request = require('supertest');
const { buildComposition } = require('../services/compositionParser');
const scanRouter = require('../routes/scan');

function makeApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/scan', scanRouter);
  return a;
}

// ─── 23 scénarios parser ──────────────────────────────────────────────────────
describe('S5 buildComposition — parser durci (23 scénarios)', () => {
  test('FR propre : décimales virgule + additif + pas de confirmation', () => {
    const r = buildComposition({ product_name: 'Biscuits', per_100g: { kcal: '480', glucides: '62,5', dont_sucres: '24,1', proteines: '6,8', lipides: '21,3', dont_satures: '10,2', fibres: '3,1', sel: '0,8' }, ingredients_text: 'farine, sucre, huile, sel, acide citrique', confidence: 0.9 });
    expect(r.per_100g.glucides).toBe(62.5);
    expect(r.additives.some(a => a.code === 'E330' && a.risk === 'low')).toBe(true);
    expect(r.needs_confirmation).toBe(false);
  });

  test('kJ → kcal (2009 kJ ≈ 480)', () => {
    expect(buildComposition({ per_100g: { kcal: '2009', glucides: '62', proteines: '7', lipides: '21' }, confidence: 0.85 }).per_100g.kcal).toBe(480);
  });
  test('kJ en texte → kcal', () => {
    expect(buildComposition({ per_100g: { kcal: '2009 kJ', glucides: '10' }, confidence: 0.8 }).per_100g.kcal).toBe(480);
  });

  test('traces → 0', () => {
    expect(buildComposition({ per_100g: { kcal: '50', sel: 'traces', fibres: 'NC', dont_sucres: '-' }, confidence: 0.8 }).per_100g.sel).toBe(0);
  });
  test('NC → null', () => {
    expect(buildComposition({ per_100g: { kcal: '50', fibres: 'NC' }, confidence: 0.8 }).per_100g.fibres).toBeNull();
  });
  test('<0,5 → 0.25 (moitié)', () => {
    expect(buildComposition({ per_100g: { kcal: '50', sel: '<0,5' }, confidence: 0.8 }).per_100g.sel).toBe(0.25);
  });

  test('sucres > glucides → null + warning', () => {
    const r = buildComposition({ per_100g: { kcal: '100', glucides: '10', dont_sucres: '40' }, confidence: 0.9 });
    expect(r.per_100g.dont_sucres).toBeNull();
    expect(r.warnings).toContain('sucres>glucides');
    expect(r.needs_confirmation).toBe(true);
  });

  test('additifs codes : E150d high + 3 additifs', () => {
    const r = buildComposition({ per_100g: { kcal: '100' }, ingredients_text: 'eau, colorant E150d, E338, conservateur E250', confidence: 0.8 });
    expect(r.additives.some(a => a.code === 'E150D' && a.risk === 'high')).toBe(true);
    expect(r.additives).toHaveLength(3);
  });
  test('additifs noms → E (curcumine + acide citrique + lécithine = 3)', () => {
    const r = buildComposition({ per_100g: { kcal: '100' }, ingredients_text: 'sucre, curcumine, acide citrique, lécithine de soja', confidence: 0.8 });
    expect(r.additives).toHaveLength(3);
    expect(r.additives.some(a => a.code === 'E330')).toBe(true);
  });
  test('code inconnu E4999 → unknown', () => {
    expect(buildComposition({ per_100g: { kcal: '100' }, ingredients_text: 'E4999 bizarre', confidence: 0.8 }).additives.some(a => a.risk === 'unknown')).toBe(true);
  });
  test('sous-variant E450i → capté en unknown', () => {
    expect(buildComposition({ per_100g: { kcal: '100' }, ingredients_text: 'émulsifiant E450i', confidence: 0.8 }).additives.some(a => a.code === 'E450I' && a.risk === 'unknown')).toBe(true);
  });
  test('nom en majuscules → E330', () => {
    expect(buildComposition({ per_100g: { kcal: '100' }, ingredients_text: 'sucre, ACIDE CITRIQUE', confidence: 0.8 }).additives.some(a => a.code === 'E330')).toBe(true);
  });

  test('kcal absurde → null', () => {
    expect(buildComposition({ per_100g: { kcal: '99999', glucides: '50' }, confidence: 0.9 }).per_100g.kcal).toBeNull();
  });
  test('valeur négative → null + warning', () => {
    const r = buildComposition({ per_100g: { kcal: '100', lipides: '-5' }, confidence: 0.9 });
    expect(r.per_100g.lipides).toBeNull();
    expect(r.warnings).toContain('negatif');
  });
  test('unité g collée retirée', () => {
    const r = buildComposition({ per_100g: { lipides: '21,3 g', kcal: '480 kcal' }, confidence: 0.8 });
    expect(r.per_100g.lipides).toBe(21.3);
    expect(r.per_100g.kcal).toBe(480);
  });
  test('double énergie « 480 kcal (2009 kJ) » → 480', () => {
    expect(buildComposition({ per_100g: { kcal: '480 kcal (2009 kJ)', glucides: '60' }, confidence: 0.85 }).per_100g.kcal).toBe(480);
  });
  test('points décimaux EN', () => {
    const r = buildComposition({ per_100g: { kcal: '12.5', glucides: '3.2', proteines: '1.1', lipides: '0.5' }, confidence: 0.9 });
    expect(r.per_100g.kcal).toBe(13);
    expect(r.per_100g.glucides).toBe(3.2);
  });

  test('tableau vide → tout null + needs_confirmation', () => {
    const r = buildComposition({ per_100g: {}, confidence: 0.9 });
    expect(r.per_100g.kcal).toBeNull();
    expect(r.needs_confirmation).toBe(true);
  });
  test('peu de champs (<4) → needs_confirmation', () => {
    expect(buildComposition({ per_100g: { kcal: '100' }, confidence: 0.9 }).needs_confirmation).toBe(true);
  });
  test('produit suffisamment rempli & cohérent → confiance ≥ 0.7', () => {
    const r = buildComposition({ per_100g: { kcal: '200', glucides: '20', proteines: '10', lipides: '5', fibres: '2' }, confidence: 0.9 });
    expect(r.confidence).toBeGreaterThanOrEqual(0.7);
    expect(r.needs_confirmation).toBe(false);
  });
  test('saturés > lipides → null + warning', () => {
    const r = buildComposition({ per_100g: { kcal: '100', lipides: '5', dont_satures: '40' }, confidence: 0.9 });
    expect(r.per_100g.dont_satures).toBeNull();
    expect(r.warnings).toContain('satures>lipides');
  });
});

// ─── Endpoint POST /api/scan/composition ──────────────────────────────────────
describe('POST /api/scan/composition (S5)', () => {
  const app = makeApp();
  const geminiText = (obj) => ({ data: { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] } });
  beforeEach(() => jest.clearAllMocks());

  test('succès → composition structurée + additifs + disclaimer', async () => {
    axios.post.mockResolvedValue(geminiText({
      product_name: 'Biscuits chocolat',
      per_100g: { kcal: 480, glucides: 62.5, dont_sucres: 24, proteines: 6.8, lipides: 21, dont_satures: 10, fibres: 3, sel: 0.8 },
      ingredients_text: 'farine, sucre, huile, acide citrique',
      additives: ['E330'],
      serving_g: 30, confidence: 0.9,
    }));
    const res = await request(app).post('/api/scan/composition').send({ image: 'base64fake==', mimeType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('gemini_label');
    expect(res.body.per_100g.kcal).toBe(480);
    expect(res.body.additives.some(a => a.code === 'E330')).toBe(true);
    expect(res.body.needs_confirmation).toBe(false);
    expect(res.body.disclaimer).toHaveProperty('fr');
    expect(res.body.disclaimer).toHaveProperty('ar');
  });

  test('incohérence Gemini → needs_confirmation + warnings', async () => {
    axios.post.mockResolvedValue(geminiText({ per_100g: { kcal: 100, glucides: 10, dont_sucres: 40 }, confidence: 0.9 }));
    const res = await request(app).post('/api/scan/composition').send({ image: 'b64==', mimeType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.needs_confirmation).toBe(true);
    expect(res.body.warnings).toContain('sucres>glucides');
    expect(res.body.per_100g.dont_sucres).toBeNull();
  });

  test('image absente → 422', async () => {
    const res = await request(app).post('/api/scan/composition').send({ mimeType: 'image/jpeg' });
    expect(res.status).toBe(422);
  });

  test('Gemini indisponible (503) → 502 sans message interne', async () => {
    const err = new Error('Service Unavailable'); err.response = { status: 503 };
    axios.post.mockRejectedValue(err);
    const res = await request(app).post('/api/scan/composition').send({ image: 'b64==', mimeType: 'image/jpeg' });
    expect(res.status).toBe(502);
    expect(res.body.error).not.toMatch(/Service Unavailable/i);
  });
});
