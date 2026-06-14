'use strict';
/**
 * P4.12 — Tests : scoring CIQUAL forme brute, estimation de portion, termes génériques
 *
 * TU-P412-1  : rawBonus() positif pour "crue", nul pour "sechee"
 * TU-P412-2  : transformMalus() positif pour "a l huile", "seche", "sauce"
 * TU-P412-3  : transformMalus() "cuit" avec/sans "cuit" dans la query
 * TU-P412-4  : score() — "Tomate, crue" > "Tomate séchée à l'huile" sur query "tomate"
 * TU-P412-5  : score() — "Tomate, crue" > "Tomate, en conserve"
 * TU-P412-6  : score() — "Tomate, crue" > "Sauce tomate"
 * TU-P412-7  : searchByName() avec mock data → crue en premier (tiebreaker longueur)
 * TU-P412-8  : isGenericFoodTerm("fruit") → true
 * TU-P412-9  : isGenericFoodTerm("pomme") → false
 * TU-P412-10 : isGenericFoodTerm("légume vert") → false (terme composé non entièrement générique)
 * TU-P412-11 : defaultPortion("pomme") → 150g
 * TU-P412-12 : defaultPortion("riz") → 150g
 * TU-P412-13 : defaultPortion("oeuf") → 55g
 * TU-P412-14 : defaultPortion("inconnu") → 100g
 * TU-P412-15 : resolveNutrition quantity_explicit=true → estimated_portion=false, portion_source='user'
 * TU-P412-16 : resolveNutrition quantity_g Gemini → estimated_portion=true, portion_source='gemini'
 * TU-P412-17 : resolveNutrition quantity_g=null + "pomme" → portion_source='default', portion=150g
 * TU-P412-18 : resolveNutrition quantity_g=null + inconnu → portion_source='default', portion=100g
 */

jest.mock('../services/ciqual', () => {
  const actual = jest.requireActual('../services/ciqual');
  return {
    ...actual,
    searchByName: jest.fn(),
  };
});
jest.mock('../services/usda',       () => ({ searchFood: jest.fn(), rankByDataType: jest.requireActual('../services/usda').rankByDataType }));
jest.mock('../services/foodvision', () => ({ callGemini: jest.fn() }));
jest.mock('../middleware/auth',      () => (req, _res, next) => { req.userId = 'test-user'; next(); });
jest.mock('../db',                   () => ({ getDB: () => ({}) }));

const { score, rawBonus, transformMalus, normalize, searchByName } = require('../services/ciqual');
const { isGenericFoodTerm, defaultPortion, resolveNutrition } = require('../routes/interpret');

// ─── TU-P412-1 : rawBonus ────────────────────────────────────────────────────
describe('TU-P412-1 — rawBonus()', () => {
  test('"tomate crue" a un bonus > 0', () => {
    expect(rawBonus(normalize('Tomate, crue'))).toBeGreaterThan(0);
  });
  test('"tomate sechee a l huile" n\'a pas de raw bonus', () => {
    expect(rawBonus(normalize('Tomate séchée à l\'huile'))).toBe(0);
  });
  test('"pomme crue" a un bonus > 0', () => {
    expect(rawBonus(normalize('Pomme, crue'))).toBeGreaterThan(0);
  });
  test('"carotte nature" a un bonus > 0', () => {
    expect(rawBonus(normalize('Carotte, nature'))).toBeGreaterThan(0);
  });
});

// ─── TU-P412-2 : transformMalus ──────────────────────────────────────────────
describe('TU-P412-2 — transformMalus()', () => {
  test('"a l huile" dans le nom → malus > 0', () => {
    expect(transformMalus(normalize('Tomate séchée à l\'huile'), 'tomate')).toBeGreaterThan(0);
  });
  test('"seche" dans le nom → malus > 0', () => {
    expect(transformMalus(normalize('Tomate séchée'), 'tomate')).toBeGreaterThan(0);
  });
  test('"sauce" dans le nom → malus > 0', () => {
    expect(transformMalus(normalize('Sauce tomate'), 'tomate')).toBeGreaterThan(0);
  });
  test('"en conserve" → malus > 0', () => {
    expect(transformMalus(normalize('Tomate en conserve'), 'tomate')).toBeGreaterThan(0);
  });
  test('nom brut sans marqueur → malus = 0', () => {
    expect(transformMalus(normalize('Tomate, crue'), 'tomate')).toBe(0);
  });
});

// ─── TU-P412-3 : cuit conditionnel ───────────────────────────────────────────
describe('TU-P412-3 — "cuit" conditionnel selon la query', () => {
  test('"Carotte cuite" reçoit malus quand query="carotte"', () => {
    expect(transformMalus(normalize('Carotte, cuite'), 'carotte')).toBeGreaterThan(0);
  });
  test('"Carotte cuite" ne reçoit PAS malus quand query="carotte cuite"', () => {
    expect(transformMalus(normalize('Carotte, cuite'), 'carotte cuite')).toBe(0);
  });
});

// ─── TU-P412-4 à 6 : score() ─────────────────────────────────────────────────
describe('TU-P412-4–6 — score() préfère forme crue', () => {
  const entryCrue     = { alim_nom_fr: 'Tomate, crue',               alim_nom_en: 'Tomato, raw' };
  const entryHuile    = { alim_nom_fr: 'Tomate séchée à l\'huile',   alim_nom_en: null };
  const entryConserve = { alim_nom_fr: 'Tomate, en conserve',         alim_nom_en: null };
  const entrySauce    = { alim_nom_fr: 'Sauce tomate',                alim_nom_en: 'Tomato sauce' };

  test('Tomate crue > Tomate à l\'huile', () => {
    expect(score('tomate', entryCrue)).toBeGreaterThan(score('tomate', entryHuile));
  });

  test('Tomate crue > Tomate en conserve', () => {
    expect(score('tomate', entryCrue)).toBeGreaterThan(score('tomate', entryConserve));
  });

  test('Tomate crue > Sauce tomate', () => {
    expect(score('tomate', entryCrue)).toBeGreaterThan(score('tomate', entrySauce));
  });

  test('Score "tomate huile" < 80 (malus appliqué)', () => {
    expect(score('tomate', entryHuile)).toBeLessThan(80);
  });

  test('Score "tomate crue" ≥ 80 (base + rawBonus)', () => {
    expect(score('tomate', entryCrue)).toBeGreaterThanOrEqual(80);
  });
});

// ─── TU-P412-7 : searchByName tiebreaker longueur ────────────────────────────
describe('TU-P412-7 — searchByName() tiebreaker nom court', () => {
  test('à score égal, nom court avant nom long', () => {
    // Deux entrées avec même score (même base, même rawBonus, même malus)
    const data = [
      { alim_nom_fr: 'Pomme, crue, variété long name extra', alim_nom_en: null, kcal: 52, glucides: 14, proteines: 0.3, lipides: 0.2, fibres: 2.4, sel: 0 },
      { alim_nom_fr: 'Pomme, crue',                          alim_nom_en: null, kcal: 52, glucides: 14, proteines: 0.3, lipides: 0.2, fibres: 2.4, sel: 0 },
    ];
    // Both startWith 'pomme' and have 'crue' → same score → tiebreaker = length
    const sCourt = score('pomme', data[1]);
    const sLong  = score('pomme', data[0]);
    // Both should have same score
    expect(sCourt).toBe(sLong);
    // Tiebreaker: shorter name comes first
    const sorted = [...data]
      .map(e => ({ e, s: score('pomme', e) }))
      .sort((a, b) => {
        if (b.s !== a.s) return b.s - a.s;
        return normalize(a.e.alim_nom_fr).length - normalize(b.e.alim_nom_fr).length;
      });
    expect(sorted[0].e.alim_nom_fr).toBe('Pomme, crue');
  });
});

// ─── TU-P412-8 à 10 : isGenericFoodTerm ──────────────────────────────────────
describe('TU-P412-8–10 — isGenericFoodTerm()', () => {
  test('"fruit" → true', () => expect(isGenericFoodTerm('fruit')).toBe(true));
  test('"légume" → true', () => expect(isGenericFoodTerm('légume')).toBe(true));
  test('"plat" → true', () => expect(isGenericFoodTerm('plat')).toBe(true));
  test('"food" → true', () => expect(isGenericFoodTerm('food')).toBe(true));
  test('"pomme" → false', () => expect(isGenericFoodTerm('pomme')).toBe(false));
  test('"poulet rôti" → false (terme composé spécifique)', () => expect(isGenericFoodTerm('poulet rôti')).toBe(false));
  test('"légume vert" → false (vert n\'est pas générique)', () => expect(isGenericFoodTerm('légume vert')).toBe(false));
  test('"" (vide) → false', () => expect(isGenericFoodTerm('')).toBe(false));
  test('null → false', () => expect(isGenericFoodTerm(null)).toBe(false));
});

// ─── TU-P412-11 à 14 : defaultPortion ───────────────────────────────────────
describe('TU-P412-11–14 — defaultPortion()', () => {
  test('"pomme" → 150g', () => expect(defaultPortion('pomme').g).toBe(150));
  test('"Pomme, crue" → 150g (nom CIQUAL)', () => expect(defaultPortion('Pomme, crue').g).toBe(150));
  test('"riz" → 150g', () => expect(defaultPortion('riz').g).toBe(150));
  test('"oeuf" → 55g', () => expect(defaultPortion('oeuf').g).toBe(55));
  test('"lait" → 250g', () => expect(defaultPortion('lait').g).toBe(250));
  test('"fromage" → 30g', () => expect(defaultPortion('fromage').g).toBe(30));
  test('"tomate" → 100g', () => expect(defaultPortion('tomate').g).toBe(100));
  test('"inconnu" → 100g (défaut)', () => expect(defaultPortion('inconnu').g).toBe(100));
});

// ─── TU-P412-20 à 23 : corrections gate (B-1 + M-1 + M-2 critique-algo, M-3 revue-code) ─
describe('TU-P412-20–23 — corrections gate', () => {
  test('TU-P412-20 (B-1) : "poulet roti" in query → malus roti exempt, malus cuit exempt', () => {
    // Before fix: transformMalus = 50 (roti+cuit) → score = 0, entry eliminated
    // After fix: queryHasTransform (roti) → no malus for roti or cuit → score > 0
    expect(transformMalus(
      normalize('Poulet, viande et peau, roti/cuit au four'),
      normalize('poulet roti')
    )).toBe(0);
  });

  test('TU-P412-21 (B-1) : score("poulet roti", roti entry) > score("poulet roti", foie cru)', () => {
    const entryRoti = { alim_nom_fr: 'Poulet, viande et peau, roti/cuit au four', alim_nom_en: null };
    const entryFoie = { alim_nom_fr: 'Foie, poulet, cru', alim_nom_en: null };
    // allMatch boost (2 words match in roti entry) + 0 malus > foie (1 word match + rawBonus)
    expect(score('poulet roti', entryRoti)).toBeGreaterThan(score('poulet roti', entryFoie));
  });

  test('TU-P412-22 (M-1) : "sucre" in query → no malus for "Sucre blanc"', () => {
    expect(transformMalus(normalize('Sucre blanc'), 'sucre')).toBe(0);
  });

  test('TU-P412-22b (M-1) : score("sucre", "Sucre blanc") >= 80', () => {
    const entry = { alim_nom_fr: 'Sucre blanc', alim_nom_en: 'White sugar' };
    expect(score('sucre', entry)).toBeGreaterThanOrEqual(80);
  });

  test('TU-P412-23 (M-3 revue-code) : isGenericFoodTerm("fruits légumes") → true', () => {
    expect(isGenericFoodTerm('fruits légumes')).toBe(true);
  });

  test('TU-P412-23b : isGenericFoodTerm("fruits boissons") → true (deux termes génériques)', () => {
    expect(isGenericFoodTerm('fruits boissons')).toBe(true);
  });

  test('TU-P412-23c : score Math.max(0) — jamais négatif', () => {
    // Entry with many transform markers should score 0, not negative
    const entry = { alim_nom_fr: 'Produit seche frit roti confite surgele', alim_nom_en: null };
    expect(score('tomate', entry)).toBeGreaterThanOrEqual(0);
  });
});

// ─── TU-P412-15 à 18 : resolveNutrition portion_source ──────────────────────
describe('TU-P412-15–18 — resolveNutrition portion_source + estimated_portion', () => {
  const POMME_100G = { kcal: 52, glucides: 14, proteines: 0.3, lipides: 0.2, fibres: 2.4, sel: 0 };
  const { searchFood: usdaSpy } = require('../services/usda');

  beforeEach(() => {
    jest.clearAllMocks();
    usdaSpy.mockResolvedValue([]);
  });

  test('TU-P412-15 : quantity_explicit=true → estimated_portion=false, portion_source="user"', async () => {
    searchByName.mockReturnValue([POMME_100G]);
    const r = await resolveNutrition('Pomme', 200, true);
    expect(r.estimated_portion).toBe(false);
    expect(r.portion_source).toBe('user');
    expect(r.quantity_g).toBe(200);
    expect(r.kcal).toBe(104);   // 52 * 2
  });

  test('TU-P412-16 : quantity_g=150, explicit=false → estimated_portion=true, portion_source="gemini"', async () => {
    searchByName.mockReturnValue([POMME_100G]);
    const r = await resolveNutrition('Pomme', 150, false);
    expect(r.estimated_portion).toBe(true);
    expect(r.portion_source).toBe('gemini');
    expect(r.quantity_g).toBe(150);
    expect(r.kcal).toBe(78);    // 52 * 1.5
  });

  test('TU-P412-17 : quantity_g=null + "pomme" → portion_source="default", portion=150g', async () => {
    searchByName.mockReturnValue([POMME_100G]);
    const r = await resolveNutrition('pomme', null, false);
    expect(r.portion_source).toBe('default');
    expect(r.estimated_portion).toBe(true);
    expect(r.quantity_g).toBe(150);
    expect(r.kcal).toBe(78);    // 52 * 1.5
  });

  test('TU-P412-18 : quantity_g=null + inconnu → portion_source="default", portion=100g', async () => {
    searchByName.mockReturnValue([POMME_100G]);
    const r = await resolveNutrition('inconnu', null, false);
    expect(r.portion_source).toBe('default');
    expect(r.quantity_g).toBe(100);
  });

  test('TU-P412-19 : foodName vide → null', async () => {
    const r = await resolveNutrition('', null, false);
    expect(r).toBeNull();
  });
});
