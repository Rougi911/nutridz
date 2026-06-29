'use strict';
/**
 * S27 — suggestSeasonalFoods / isInSeason (fonctions pures, sans DB).
 */
const { suggestSeasonalFoods, isInSeason, NUTRIENT_FOODS } = require('../services/seasonalFoods');

describe('S27 — isInSeason (calendrier France)', () => {
  test('aliment toujours dispo (null) → vrai quel que soit le mois', () => {
    expect(isInSeason('lentilles', 1)).toBe(true);
    expect(isInSeason('lentilles', 7)).toBe(true);
  });
  test('asperge en saison en mai (5), hors saison en décembre (12)', () => {
    expect(isInSeason('asperge', 5)).toBe(true);
    expect(isInSeason('asperge', 12)).toBe(false);
  });
  test('aliment inconnu → vrai (pas de contrainte de saison)', () => {
    expect(isInSeason('inconnu-xyz', 5)).toBe(true);
  });
});

describe('S27 — suggestSeasonalFoods', () => {
  test('ne renvoie que les nutriments passés (carences) avec des aliments', () => {
    const res = suggestSeasonalFoods([{ nutrient: 'fer', status: 'Apports à améliorer' }], 6);
    expect(res).toHaveLength(1);
    expect(res[0].nutrient).toBe('fer');
    expect(res[0].status).toBe('Apports à améliorer');
    expect(res[0].foods.length).toBeGreaterThan(0);
    expect(res[0].foods.length).toBeLessThanOrEqual(4);
    res[0].foods.forEach((f) => {
      expect(typeof f.name).toBe('string');
      expect(typeof f.inSeason).toBe('boolean');
    });
  });

  test('priorise les aliments de saison en tête de liste', () => {
    // folates en mai : asperge (saison [4,5,6]) doit remonter avant un hors-saison
    const res = suggestSeasonalFoods([{ nutrient: 'folates' }], 5);
    const foods = res[0].foods;
    const firstOutOfSeason = foods.findIndex((f) => !f.inSeason);
    const lastInSeason = foods.map((f) => f.inSeason).lastIndexOf(true);
    if (firstOutOfSeason !== -1) {
      // tout ce qui est de saison vient avant le premier hors-saison
      expect(lastInSeason).toBeLessThan(firstOutOfSeason);
    }
    expect(foods.some((f) => f.name === 'asperge' && f.inSeason)).toBe(true);
  });

  test('nutriment inconnu → liste d\'aliments vide', () => {
    const res = suggestSeasonalFoods([{ nutrient: 'inconnu' }], 6);
    expect(res[0].foods).toEqual([]);
  });

  test('entrée vide → []', () => {
    expect(suggestSeasonalFoods([], 6)).toEqual([]);
    expect(suggestSeasonalFoods(undefined, 6)).toEqual([]);
  });

  test('couvre les 6 nutriments suivis', () => {
    for (const n of ['fer', 'calcium', 'vitD', 'vitB12', 'magnesium', 'folates']) {
      expect(NUTRIENT_FOODS[n].length).toBeGreaterThan(0);
    }
  });
});
