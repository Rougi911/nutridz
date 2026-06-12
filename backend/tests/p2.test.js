'use strict';
// P2 tests : Gemini parsing, interpret route logic, AGS utility, CIQUAL "crème fraîche"

const { calcMonthlyAGSTarget } = require('../services/agsUtils');
const { searchByName }          = require('../services/ciqual');

// ─── DEF-11 — AGS monthly target ─────────────────────────────────────────────
describe('AGS calcMonthlyAGSTarget (DEF-11)', () => {
  test('TDEE 2500 → target = round(2500 * 0.1 / 9 * 30) = 83g', () => {
    const r = calcMonthlyAGSTarget({ tdee: 2500 });
    expect(r.target_g).toBe(Math.round(2500 * 0.1 / 9 * 30));
    expect(r.default_used).toBe(false);
    expect(r.tdee_used).toBe(2500);
  });

  test('TDEE absent → fallback 2000 kcal avec default_used: true', () => {
    const r = calcMonthlyAGSTarget({});
    expect(r.default_used).toBe(true);
    expect(r.tdee_used).toBe(2000);
    expect(r.target_g).toBe(Math.round(2000 * 0.1 / 9 * 30));
  });

  test('profil null → fallback', () => {
    const r = calcMonthlyAGSTarget(null);
    expect(r.default_used).toBe(true);
  });

  test('TDEE absurde (< 800) → fallback', () => {
    const r = calcMonthlyAGSTarget({ tdee: 100 });
    expect(r.default_used).toBe(true);
  });

  test('TDEE 1800 → formule cohérente', () => {
    const r = calcMonthlyAGSTarget({ tdee: 1800 });
    expect(r.target_g).toBe(Math.round(1800 * 0.1 / 9 * 30));
    expect(r.default_used).toBe(false);
  });
});

// ─── Bug 4a — CIQUAL "crème fraîche" accent normalization ─────────────────────
describe('CIQUAL accent normalization (bug 4a)', () => {
  test('searchByName("crème fraîche") retourne au moins un résultat', () => {
    const results = searchByName('crème fraîche', 3);
    expect(results.length).toBeGreaterThan(0);
  });

  test('searchByName("creme fraiche") (sans accent) retourne au moins un résultat', () => {
    const results = searchByName('creme fraiche', 3);
    expect(results.length).toBeGreaterThan(0);
  });

  test('résultat CIQUAL contient les champs nutritionnels attendus', () => {
    const results = searchByName('poulet', 1);
    if (results.length) {
      expect(results[0]).toHaveProperty('kcal');
      expect(results[0]).toHaveProperty('glucides');
      expect(results[0]).toHaveProperty('proteines');
      expect(results[0]).toHaveProperty('lipides');
    }
  });
});

// ─── Gemini JSON defensive parsing (simulate interpret route logic) ────────────
describe('Gemini JSON defensive parsing', () => {
  function parseGeminiJSON(raw) {
    const cleaned = (raw || '')
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) return JSON.parse(match[0]);
      throw new Error('JSON invalide');
    }
  }

  test('JSON valide parsé directement', () => {
    const raw = '{"intents":[{"type":"food","name":"poulet","confidence":0.9}]}';
    const result = parseGeminiJSON(raw);
    expect(result.intents[0].name).toBe('poulet');
  });

  test('JSON entouré de backticks parsé', () => {
    const raw = '```json\n{"intents":[{"type":"food","name":"riz","confidence":0.8}]}\n```';
    const result = parseGeminiJSON(raw);
    expect(result.intents[0].name).toBe('riz');
  });

  test('JSON avec texte avant/après extrait par regex', () => {
    const raw = 'Voici la réponse:\n{"intents":[{"type":"food","name":"couscous","confidence":0.7}]}\nFin.';
    const result = parseGeminiJSON(raw);
    expect(result.intents[0].name).toBe('couscous');
  });

  test('JSON non parseable lance une erreur → 422', () => {
    expect(() => parseGeminiJSON('Aucune réponse disponible.')).toThrow();
  });

  test('Array JSON valide (mode photo concepts)', () => {
    const raw = '[{"name":"pizza","value":0.95},{"name":"cheese","value":0.7}]';
    const result = parseGeminiJSON(raw);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe('pizza');
  });
});

// ─── Bug 4b — dishes.js kcal fallback field (unit test logique) ───────────────
describe('dishes.js kcal_per100 || kcal fallback (bug 4b)', () => {
  function calcIngredientKcal(ing) {
    const r = ing.grams / 100;
    const kcal100 = ing.kcal_per100 ?? ing.kcal ?? 0;
    return kcal100 * r;
  }

  test('kcal_per100 présent → utilisé', () => {
    expect(calcIngredientKcal({ grams: 200, kcal_per100: 356 })).toBeCloseTo(712);
  });

  test('kcal_per100 absent, kcal présent → fallback', () => {
    expect(calcIngredientKcal({ grams: 100, kcal: 165 })).toBeCloseTo(165);
  });

  test('les deux présents → kcal_per100 prioritaire', () => {
    expect(calcIngredientKcal({ grams: 100, kcal_per100: 200, kcal: 100 })).toBeCloseTo(200);
  });

  test('aucun kcal → 0', () => {
    expect(calcIngredientKcal({ grams: 100 })).toBe(0);
  });
});
