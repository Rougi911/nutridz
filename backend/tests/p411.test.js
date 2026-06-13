'use strict';
/**
 * P4.11 — Tests: préférence dataType USDA + mise à l'échelle portion
 *
 * TU-P411-1 : rankByDataType — Foundation/SR Legacy avant Branded (AL-BUG1)
 * TU-P411-2 : resolveNutrition(name, 200) → kcal mis à l'échelle depuis CIQUAL (AL-BUG3)
 * TU-P411-3 : resolveNutrition(name, null) → estimated_portion=true, quantity_g=100 (AL-BUG3)
 * TU-P411-4 : resolveNutrition → fallback USDA quand CIQUAL vide, source='usda'
 */

jest.mock('../services/ciqual',     () => ({ searchByName: jest.fn() }));
jest.mock('../services/usda',       () => ({
  searchFood:      jest.fn(),
  rankByDataType:  jest.requireActual('../services/usda').rankByDataType,
}));
jest.mock('../services/foodvision', () => ({ callGemini: jest.fn() }));
jest.mock('../middleware/auth',      () => (req, _res, next) => { req.userId = 'test-user'; next(); });
jest.mock('../db',                   () => ({ getDB: () => ({}) }));

const { rankByDataType }      = require('../services/usda');
const { searchByName }        = require('../services/ciqual');
const { searchFood: usdaSpy } = require('../services/usda');
const { resolveNutrition }    = require('../routes/interpret');

// ─── Fixture per-100g CIQUAL ──────────────────────────────────────────────────
const POMME_100G = { kcal: 52, glucides: 14.0, proteines: 0.3, lipides: 0.2, fibres: 2.4, sel: 0.01 };

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── TU-P411-1 ───────────────────────────────────────────────────────────────
describe('TU-P411-1 — rankByDataType', () => {
  test('met Foundation avant SR Legacy avant Branded', () => {
    const input = [
      { dataType: 'Branded',   nom_fr: 'Apple candy', kcal: 350 },
      { dataType: 'SR Legacy', nom_fr: 'Apples raw',  kcal: 52  },
      { dataType: 'Foundation',nom_fr: 'Apple',       kcal: 52  },
      { dataType: 'Branded',   nom_fr: 'Apple juice',  kcal: 46  },
    ];
    const ranked = rankByDataType(input);
    expect(ranked[0].dataType).toBe('Foundation');
    expect(ranked[1].dataType).toBe('SR Legacy');
    expect(ranked[2].dataType).toBe('Branded');
    expect(ranked[3].dataType).toBe('Branded');
  });

  test('ne modifie pas le tableau original', () => {
    const input = [
      { dataType: 'Branded',    nom_fr: 'x' },
      { dataType: 'Foundation', nom_fr: 'y' },
    ];
    const original = [...input];
    rankByDataType(input);
    expect(input[0].dataType).toBe(original[0].dataType);
  });
});

// ─── TU-P411-2 ───────────────────────────────────────────────────────────────
describe('TU-P411-2 — resolveNutrition avec quantity_g', () => {
  test('met à l\'échelle kcal et macros pour 200 g', async () => {
    searchByName.mockReturnValue([POMME_100G]);
    const result = await resolveNutrition('Pomme', 200);
    expect(result).not.toBeNull();
    expect(result.kcal).toBe(104);           // 52 * 2
    expect(result.glucides).toBe(28.0);      // 14 * 2
    expect(result.proteines).toBe(0.6);      // 0.3 * 2
    expect(result.lipides).toBe(0.4);        // 0.2 * 2
    expect(result.fibres).toBe(4.8);         // 2.4 * 2
    expect(result.quantity_g).toBe(200);
    expect(result.estimated_portion).toBe(false);
    expect(result.source).toBe('ciqual');
    expect(result.sel).toBe(0.02);           // 0.01 * 2
  });

  test('portion de 50 g correctement mise à l\'échelle', async () => {
    searchByName.mockReturnValue([POMME_100G]);
    const result = await resolveNutrition('Pomme', 50);
    expect(result.kcal).toBe(26);            // Math.round(52 * 0.5)
    expect(result.glucides).toBe(7.0);
    expect(result.quantity_g).toBe(50);
    expect(result.estimated_portion).toBe(false);
  });
});

// ─── TU-P411-3 ───────────────────────────────────────────────────────────────
describe('TU-P411-3 — resolveNutrition sans quantity_g', () => {
  test('null → portion estimée 100 g', async () => {
    searchByName.mockReturnValue([POMME_100G]);
    const result = await resolveNutrition('Pomme', null);
    expect(result.kcal).toBe(52);
    expect(result.quantity_g).toBe(100);
    expect(result.estimated_portion).toBe(true);
  });

  test('undefined → portion estimée 100 g', async () => {
    searchByName.mockReturnValue([POMME_100G]);
    const result = await resolveNutrition('Pomme', undefined);
    expect(result.quantity_g).toBe(100);
    expect(result.estimated_portion).toBe(true);
  });

  test('0 → portion estimée 100 g (0 est invalide)', async () => {
    searchByName.mockReturnValue([POMME_100G]);
    const result = await resolveNutrition('Pomme', 0);
    expect(result.quantity_g).toBe(100);
    expect(result.estimated_portion).toBe(true);
  });
});

// ─── TU-P411-4 ───────────────────────────────────────────────────────────────
describe('TU-P411-4 — resolveNutrition fallback USDA', () => {
  const USDA_RESULT = { dataType: 'Foundation', kcal: 52, glucides: 14.0, proteines: 0.3, lipides: 0.2, fibres: 2.4 };

  test('utilise USDA si CIQUAL ne trouve rien', async () => {
    searchByName.mockReturnValue([]);
    usdaSpy.mockResolvedValue([USDA_RESULT]);
    const result = await resolveNutrition('Apple', 150);
    expect(result).not.toBeNull();
    expect(result.source).toBe('usda');
    expect(result.kcal).toBe(78);            // Math.round(52 * 1.5)
    expect(result.quantity_g).toBe(150);
    expect(result.estimated_portion).toBe(false);
  });

  test('USDA appelé avec pageSize=10', async () => {
    searchByName.mockReturnValue([]);
    usdaSpy.mockResolvedValue([USDA_RESULT]);
    await resolveNutrition('Apple', 100);
    expect(usdaSpy).toHaveBeenCalledWith('Apple', 10);
  });

  test('retourne null si ni CIQUAL ni USDA ne trouvent', async () => {
    searchByName.mockReturnValue([]);
    usdaSpy.mockResolvedValue([]);
    const result = await resolveNutrition('XyzUnknownFood', 100);
    expect(result).toBeNull();
  });

  test('retourne null si foodName est vide', async () => {
    const result = await resolveNutrition('', 100);
    expect(result).toBeNull();
  });
});

// ─── TU-P411-5 ───────────────────────────────────────────────────────────────
describe('TU-P411-5 — rankByDataType cas supplémentaires', () => {
  test('Survey (FNDDS) avant Branded, après SR Legacy', () => {
    const input = [
      { dataType: 'Branded',        nom_fr: 'c' },
      { dataType: 'Survey (FNDDS)', nom_fr: 'b' },
      { dataType: 'Foundation',     nom_fr: 'a' },
    ];
    const ranked = rankByDataType(input);
    expect(ranked[0].dataType).toBe('Foundation');
    expect(ranked[1].dataType).toBe('Survey (FNDDS)');
    expect(ranked[2].dataType).toBe('Branded');
  });

  test('tableau vide → tableau vide', () => {
    expect(rankByDataType([])).toEqual([]);
  });
});

// ─── TU-P411-6 ───────────────────────────────────────────────────────────────
describe('TU-P411-6 — resolveNutrition valeurs quantity_g limites', () => {
  beforeEach(() => {
    searchByName.mockReturnValue([POMME_100G]);
  });

  test('quantity_g = Infinity → estimated_portion=true, quantity_g=100', async () => {
    const result = await resolveNutrition('Pomme', Infinity);
    expect(result.estimated_portion).toBe(true);
    expect(result.quantity_g).toBe(100);
  });

  test('quantity_g = -50 (négatif) → estimated_portion=true, quantity_g=100', async () => {
    const result = await resolveNutrition('Pomme', -50);
    expect(result.estimated_portion).toBe(true);
    expect(result.quantity_g).toBe(100);
  });

  test('quantity_g = NaN → estimated_portion=true, quantity_g=100', async () => {
    const result = await resolveNutrition('Pomme', NaN);
    expect(result.estimated_portion).toBe(true);
    expect(result.quantity_g).toBe(100);
  });
});
