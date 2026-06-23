'use strict';
/**
 * P1-7 — Recalcul du Nutri-Score officiel quand OFF n'a pas de grade ; « non noté »
 * au lieu de « unknown » / 50.
 *
 * Cas (cf. backlog) : café noir (grade calculé), eau (boisson → A), solide sans grade
 * (Nutri-Score recalculé), produit sans aucun nutriment (score null), produit avec
 * grade OFF présent (comportement inchangé — non-régression).
 */

const { computeNutriScoreGrade, detectBeverage } = require('../services/nutriScore');
const { resolveProductScore, calcProductScore, scoreToVerdict } = require('../routes/scan');

// ─── Algorithme officiel : grades attendus ───────────────────────────────────
describe('computeNutriScoreGrade — algorithme officiel (P1-7)', () => {
  test('solide gras/sucré/salé → D', () => {
    // energy 1500kJ(4) + sugars 20(4) + satfat 5(4) + sodium 400mg(4) = N16 ; fibres 2(2) protéines non comptées (N≥11)
    const grade = computeNutriScoreGrade({
      'energy-kj_100g': 1500, 'sugars_100g': 20, 'saturated-fat_100g': 5, 'salt_100g': 1,
      'fiber_100g': 2, 'proteins_100g': 8,
    });
    expect(grade).toBe('d');
  });

  test('solide sain (légumes) → A', () => {
    const grade = computeNutriScoreGrade({
      'energy-kj_100g': 300, 'sugars_100g': 2, 'saturated-fat_100g': 0.5, 'salt_100g': 0.1,
      'fiber_100g': 5, 'proteins_100g': 4, 'fruits-vegetables-nuts_100g': 90,
    });
    expect(grade).toBe('a');
  });

  test('eau → A (cas boisson, water)', () => {
    const grade = computeNutriScoreGrade({ 'energy-kj_100g': 0, 'sugars_100g': 0 }, { isWater: true, isBeverage: true });
    expect(grade).toBe('a');
  });

  test('café noir (boisson, ~0 kcal, sans sucre) → grade calculé (B)', () => {
    const grade = computeNutriScoreGrade({ 'energy-kcal_100g': 2, 'sugars_100g': 0, 'proteins_100g': 0.3 }, { isBeverage: true });
    expect(grade).toBe('b');
  });

  test('soda sucré (boisson) → E', () => {
    const grade = computeNutriScoreGrade({ 'energy-kj_100g': 180, 'sugars_100g': 10.5 }, { isBeverage: true });
    expect(grade).toBe('e');
  });

  test('aucun nutriment exploitable → null', () => {
    expect(computeNutriScoreGrade({})).toBeNull();
    expect(computeNutriScoreGrade(null)).toBeNull();
  });
});

describe('detectBeverage', () => {
  test('catégorie eaux → isWater + isBeverage', () => {
    expect(detectBeverage(['en:beverages', 'en:waters'])).toEqual({ isWater: true, isBeverage: true });
  });
  test('catégorie cafés → boisson non-eau', () => {
    const r = detectBeverage(['en:beverages', 'en:hot-beverages', 'en:coffees']);
    expect(r.isBeverage).toBe(true);
    expect(r.isWater).toBe(false);
  });
  test('aliment solide → ni eau ni boisson', () => {
    expect(detectBeverage(['en:snacks', 'en:biscuits'], 'Biscuits')).toEqual({ isWater: false, isBeverage: false });
  });
});

// ─── Orchestrateur resolveProductScore : source + non noté ────────────────────
describe('resolveProductScore — source du score (P1-7)', () => {
  test('grade OFF présent → source nutriscore_off, comportement inchangé', () => {
    const r = resolveProductScore({ nutriScore: 'd', additiveTags: ['en:e150d'], nutriments: {}, categoriesTags: [], name: 'X' });
    expect(r.source).toBe('nutriscore_off');
    expect(r.grade).toBe('d');
    expect(r.score).toBe(calcProductScore('d', ['en:e150d'])); // 35 - 30 = 5
    expect(r.verdict).toBe('Mauvais');
  });

  test('pas de grade OFF mais nutriments (eau) → nutriscore_calcule, grade A', () => {
    const r = resolveProductScore({
      nutriScore: null, additiveTags: [],
      nutriments: { 'energy-kj_100g': 0, 'sugars_100g': 0 },
      categoriesTags: ['en:beverages', 'en:waters'], name: 'Eau minérale',
    });
    expect(r.source).toBe('nutriscore_calcule');
    expect(r.grade).toBe('a');
    expect(typeof r.score).toBe('number');
  });

  test('café noir sans grade OFF → nutriscore_calcule (score numérique)', () => {
    const r = resolveProductScore({
      nutriScore: null, additiveTags: [],
      nutriments: { 'energy-kcal_100g': 2, 'sugars_100g': 0 },
      categoriesTags: ['en:beverages', 'en:coffees'], name: 'Café',
    });
    expect(r.source).toBe('nutriscore_calcule');
    expect(typeof r.score).toBe('number');
    expect(r.score).toBeGreaterThan(0);
  });

  test('aucun nutriment ni grade → non_note, score null, verdict null', () => {
    const r = resolveProductScore({ nutriScore: null, additiveTags: [], nutriments: {}, categoriesTags: [], name: 'Inconnu' });
    expect(r.source).toBe('non_note');
    expect(r.score).toBeNull();
    expect(r.verdict).toBeNull();
  });
});

describe('scoreToVerdict — null → non noté (P1-7)', () => {
  test('score null → verdict null', () => {
    expect(scoreToVerdict(null)).toBeNull();
  });
  test('score numérique → verdict classique', () => {
    expect(scoreToVerdict(90)).toBe('Excellent');
    expect(scoreToVerdict(50)).toBe('Médiocre');
    expect(scoreToVerdict(10)).toBe('Mauvais');
  });
});
