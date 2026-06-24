'use strict';
/**
 * P1-7c — Recalcul Nutri-Score migré 2017 → **2023**.
 *
 * Validation principale : on rejoue des produits réels dont OFF expose le calcul 2023
 * (`nutriscore.2023.data`). On fournit à notre fonction exactement les VALEURS de
 * composants utilisées par OFF (énergie, sucres, AGS, sel, fibres, protéines, % fruits)
 * et on vérifie qu'on retrouve le grade 2023 d'OFF. Cela teste l'algorithme, pas
 * l'estimation du % fruits depuis les ingrédients (hors périmètre du repli).
 *
 * + cas dédiés : malus édulcorants, plafond protéines viande rouge, bornes de grade.
 */

const { computeNutriScoreGrade, detectSweeteners, detectRedMeat } = require('../services/nutriScore');

// Fixtures capturées depuis world.openfoodfacts.org (api v2, nutriscore.2023).
// Catégories spéciales (matières grasses/noix, fromages, boissons lactées) exclues.
const FIXTURES = [
  { name: 'Nutella',            offGrade: 'e', isBeverage: false, isWater: false, hasSweeteners: false,
    nut: { 'energy-kj_100g': 2252, 'sugars_100g': 56.3, 'saturated-fat_100g': 10.6, 'salt_100g': 0.11, 'fiber_100g': 3.68, 'proteins_100g': 0, 'fruits-vegetables-legumes_100g': 0 } },
  { name: 'Sauce Basilico',     offGrade: 'a', isBeverage: false, isWater: false, hasSweeteners: false,
    nut: { 'energy-kj_100g': 268, 'sugars_100g': 5.9, 'saturated-fat_100g': 0.3, 'salt_100g': 0.9, 'fiber_100g': 1.9, 'proteins_100g': 1.6, 'fruits-vegetables-legumes_100g': 94.2 } },
  { name: 'Muesli superfruits',  offGrade: 'a', isBeverage: false, isWater: false, hasSweeteners: false,
    nut: { 'energy-kj_100g': 1526, 'sugars_100g': 13, 'saturated-fat_100g': 0.86, 'salt_100g': 0.04, 'fiber_100g': 10, 'proteins_100g': 12, 'fruits-vegetables-legumes_100g': 16 } },
  { name: 'Fonds artichauts',    offGrade: 'a', isBeverage: false, isWater: false, hasSweeteners: false,
    nut: { 'energy-kj_100g': 176, 'sugars_100g': 2.5, 'saturated-fat_100g': 0, 'salt_100g': 0, 'fiber_100g': 8.3, 'proteins_100g': 1.8, 'fruits-vegetables-legumes_100g': 100 } },
  { name: 'Solide gras (D)',     offGrade: 'd', isBeverage: false, isWater: false, hasSweeteners: false,
    nut: { 'energy-kj_100g': 2555, 'sugars_100g': 7, 'saturated-fat_100g': 30, 'salt_100g': 0.03, 'fiber_100g': 14, 'proteins_100g': 0, 'fruits-vegetables-legumes_100g': 0 } },
  { name: 'Prince chocolat',     offGrade: 'e', isBeverage: false, isWater: false, hasSweeteners: false,
    nut: { 'energy-kj_100g': 1962, 'sugars_100g': 32, 'saturated-fat_100g': 5.6, 'salt_100g': 0.49, 'fiber_100g': 4, 'proteins_100g': 0, 'fruits-vegetables-legumes_100g': 0 } },
  { name: 'Petit Beurre',        offGrade: 'e', isBeverage: false, isWater: false, hasSweeteners: false,
    nut: { 'energy-kj_100g': 1850, 'sugars_100g': 23, 'saturated-fat_100g': 7.6, 'salt_100g': 1.4, 'fiber_100g': 3, 'proteins_100g': 0, 'fruits-vegetables-legumes_100g': 0 } },
  { name: 'Coca-Cola classique', offGrade: 'e', isBeverage: true, isWater: false, hasSweeteners: false,
    nut: { 'energy-kj_100g': 180, 'sugars_100g': 10.6, 'saturated-fat_100g': 0, 'salt_100g': 0, 'fiber_100g': 0, 'proteins_100g': 0, 'fruits-vegetables-legumes_100g': 0 } },
  { name: 'Coca-Cola Zero',      offGrade: 'c', isBeverage: true, isWater: false, hasSweeteners: true,
    nut: { 'energy-kj_100g': 0, 'sugars_100g': 0, 'saturated-fat_100g': 0, 'salt_100g': 0.02, 'fiber_100g': 0, 'proteins_100g': 0, 'fruits-vegetables-legumes_100g': 0 } },
  { name: 'Eau minérale',        offGrade: 'a', isBeverage: true, isWater: true, hasSweeteners: false,
    nut: { 'energy-kj_100g': 0, 'sugars_100g': 0, 'saturated-fat_100g': 0, 'salt_100g': 0, 'fiber_100g': 0, 'proteins_100g': 0, 'fruits-vegetables-legumes_100g': 0 } },
];

describe('computeNutriScoreGrade 2023 — concordance avec OFF (P1-7c)', () => {
  test.each(FIXTURES)('$name → $offGrade', (f) => {
    const grade = computeNutriScoreGrade(f.nut, {
      isBeverage: f.isBeverage, isWater: f.isWater, hasSweeteners: f.hasSweeteners,
    });
    expect(grade).toBe(f.offGrade);
  });
});

describe('Malus édulcorants non nutritifs (2023, P1-7c)', () => {
  const sodaBase = { 'energy-kj_100g': 0, 'sugars_100g': 0, 'saturated-fat_100g': 0, 'salt_100g': 0.02 };
  test('boisson édulcorée (+4) → C, sinon B', () => {
    expect(computeNutriScoreGrade(sodaBase, { isBeverage: true, hasSweeteners: true })).toBe('c');
    expect(computeNutriScoreGrade(sodaBase, { isBeverage: true, hasSweeteners: false })).toBe('b');
  });
  test('detectSweeteners repère un édulcorant via additives_tags', () => {
    expect(detectSweeteners(['en:e330', 'en:e951'])).toBe(true);  // aspartame
    expect(detectSweeteners(['en:e150d', 'en:e330'])).toBe(false);
  });
});

describe('Plafond points protéines viande rouge (2023, P1-7c)', () => {
  // N=8 (énergie 1700→5, AGS 3.5→3), protéines 20 (sans plafond → 7 ; plafonné → 2)
  const meat = { 'energy-kj_100g': 1700, 'saturated-fat_100g': 3.5, 'sugars_100g': 0, 'salt_100g': 0, 'proteins_100g': 20 };
  test('sans plafond (protéines comptées en plein) → B', () => {
    expect(computeNutriScoreGrade(meat, {})).toBe('b'); // 8 - 7 = 1
  });
  test('viande rouge → plafond 2 → grade dégradé en C', () => {
    expect(computeNutriScoreGrade(meat, { isRedMeat: true })).toBe('c'); // 8 - 2 = 6
  });
  test('detectRedMeat via categories_tags', () => {
    expect(detectRedMeat(['en:meats', 'en:beef'])).toBe(true);
    expect(detectRedMeat(['en:plant-based-foods'])).toBe(false);
  });
});

describe('Bornes & cas limites 2023 (P1-7c)', () => {
  test('eau toujours A', () => {
    expect(computeNutriScoreGrade({ 'energy-kj_100g': 0 }, { isWater: true, isBeverage: true })).toBe('a');
  });
  test('boisson non-eau ne peut pas être A (minimum B)', () => {
    expect(computeNutriScoreGrade({ 'energy-kj_100g': 0, 'sugars_100g': 0 }, { isBeverage: true })).toBe('b');
  });
  test('aucune donnée → null (non noté)', () => {
    expect(computeNutriScoreGrade({})).toBeNull();
  });
  test('sel en barème 2023 (0–20) via salt_100g', () => {
    // salt 4.2g → 20 pts (max) ; solide énergie 0 → N=20 → E
    expect(computeNutriScoreGrade({ 'energy-kj_100g': 0, 'salt_100g': 4.2 }, {})).toBe('e');
  });
});
