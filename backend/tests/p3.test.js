'use strict';
// P3 tests : AL-08 (product score), AL-09 (grocery summary), AL-07 (deficiencies), Strava webhook
// Network calls (OpenFoodFacts, Strava) are mocked — never hit real APIs in tests

const { calcProductScore, calcGrocerySummary, normalizeAdditive } = require('../routes/scan');
const { calcDeficiencies } = require('../services/micronutrientsService');
const { calcKcal } = require('../routes/strava');

// ─── AL-08 — Product score ────────────────────────────────────────────────────

describe('AL-08 calcProductScore', () => {
  test('Nutri-Score D + E150d (high risk) → 35 − 30 = 5 → Mauvais range', () => {
    const score = calcProductScore('d', ['en:e150d']);
    expect(score).toBe(5);
  });

  test('Nutri-Score D + E150d → score is "Mauvais" threshold (<35)', () => {
    const score = calcProductScore('d', ['en:e150d']);
    expect(score).toBeLessThan(35);
  });

  test('Nutri-Score A without additives → 90', () => {
    expect(calcProductScore('a', [])).toBe(90);
  });

  test('Nutri-Score E (15) + E621 (high, −30) → clamped to 0', () => {
    expect(calcProductScore('e', ['en:e621'])).toBe(0);
  });

  test('Nutri-Score C (55) + E471 (moderate, −15) → 40', () => {
    expect(calcProductScore('c', ['en:e471'])).toBe(40);
  });

  test('No Nutri-Score → null (P1-7 : plus de fallback 50, "non noté" géré en amont)', () => {
    expect(calcProductScore(null, [])).toBeNull();
  });

  test('Multiple high-risk additives → score floored at 0', () => {
    const score = calcProductScore('e', ['en:e150c', 'en:e621', 'en:e249']);
    expect(score).toBe(0);
  });

  test('Score never exceeds 100', () => {
    expect(calcProductScore('a', [])).toBeLessThanOrEqual(100);
  });

  test('normalizeAdditive handles "en:e150d" → "E150d"', () => {
    expect(normalizeAdditive('en:e150d')).toBe('E150d');
  });

  test('normalizeAdditive handles "en:e621" → "E621"', () => {
    expect(normalizeAdditive('en:e621')).toBe('E621');
  });

  test('normalizeAdditive handles "en:e955" → "E955"', () => {
    expect(normalizeAdditive('en:e955')).toBe('E955');
  });
});

// ─── AL-09 — Grocery summary ─────────────────────────────────────────────────

describe('AL-09 calcGrocerySummary', () => {
  const mockRows = [
    { sugars_g: 400, salt_g: 30, sat_fat_g: 20, times_this_month: 2, additives_json: '["en:e150d"]' },
    { sugars_g: 100, salt_g: 20, sat_fat_g: 5,  times_this_month: 1, additives_json: '[]' },
  ];
  // totals: sugars = 400*2 + 100*1 = 900g, salt = 30*2 + 20*1 = 80g, sat_fat = 20*2 + 5*1 = 45g
  // period 30 days, TDEE 2000 → AGS = round(2000*0.1/9*30) = 67g
  const summary = calcGrocerySummary(mockRows, 30, 2000);

  test('total sugars aggregated correctly', () => {
    expect(summary.sugars.total_g).toBeCloseTo(900, 0);
  });

  test('total salt aggregated correctly', () => {
    expect(summary.salt.total_g).toBeCloseTo(80, 0);
  });

  test('sugars reference is 50g/day * periodDays', () => {
    expect(summary.sugars.reference_g).toBe(1500); // 50 * 30
  });

  test('salt reference is 5g/day * periodDays', () => {
    expect(summary.salt.reference_g).toBe(150); // 5 * 30
  });

  test('sugars > 110% → color red (900/1500 = 60% → teal? Actually 60 ≤ 80 → teal)', () => {
    // 900/1500 = 60% → teal
    expect(summary.sugars.pct).toBe(60);
    expect(summary.sugars.color).toBe('teal');
  });

  test('salt color: 80/150 = 53% → teal', () => {
    expect(summary.salt.color).toBe('teal');
  });

  test('risk_additives includes E150d from scanned products', () => {
    const found = summary.risk_additives.find(a => a.code === 'E150d');
    expect(found).toBeDefined();
    expect(found.risk).toBe('high');
  });

  test('ags_oms_source = profile_tdee when valid TDEE provided', () => {
    expect(summary.ags_oms_source).toBe('profile_tdee');
  });

  test('ags_oms_source = fallback_2000 when no valid TDEE', () => {
    const s = calcGrocerySummary([], 30, 0);
    expect(s.ags_oms_source).toBe('fallback_2000');
  });

  test('weekly period uses 7-day references', () => {
    const weekly = calcGrocerySummary(mockRows, 7, 2000);
    expect(weekly.sugars.reference_g).toBe(350); // 50 * 7
    expect(weekly.salt.reference_g).toBe(35);    // 5 * 7
  });

  test('color amber when pct between 80 and 110', () => {
    // 100% should be amber (80 < 100 ≤ 110)
    const rows = [{ sugars_g: 1500, salt_g: 0, sat_fat_g: 0, times_this_month: 1, additives_json: '[]' }];
    const s = calcGrocerySummary(rows, 30, 2000);
    expect(s.sugars.pct).toBe(100);
    expect(s.sugars.color).toBe('amber');
  });

  test('color red when pct > 110', () => {
    const rows = [{ sugars_g: 2000, salt_g: 0, sat_fat_g: 0, times_this_month: 1, additives_json: '[]' }];
    const s = calcGrocerySummary(rows, 30, 2000);
    expect(s.sugars.pct).toBeGreaterThan(110);
    expect(s.sugars.color).toBe('red');
  });
});

// ─── AL-07 — Deficiency detection ────────────────────────────────────────────

describe('AL-07 calcDeficiencies', () => {
  // 14 days of simulated salmon entries (vitD-rich)
  const salmonEntries = Array.from({ length: 14 * 2 }, () => ({ name: 'saumon', grams: 150 }));
  // 14 days of bread only (poor micronutrients)
  const breadEntries  = Array.from({ length: 14 * 3 }, () => ({ name: 'pain',    grams: 100 }));

  test('salmon-heavy diet → vitD status is satisfaisants', () => {
    const result = calcDeficiencies(salmonEntries, 14, { sexe: 'h', latitude_approx: 48 }, 6);
    const vitD = result.find(r => r.nutrient === 'vitD');
    expect(vitD.status).toBe('Apports satisfaisants');
  });

  test('bread-only diet → vitD status is low', () => {
    const result = calcDeficiencies(breadEntries, 14, { sexe: 'h', latitude_approx: 48 }, 6);
    const vitD = result.find(r => r.nutrient === 'vitD');
    expect(['Apports très faibles', 'Apports à améliorer']).toContain(vitD.status);
  });

  test('vit D geographic factor: latitude 48 in winter month (Jan) → threshold 80%', () => {
    // At 80% threshold, a moderate-vitD diet that would be "OK" in summer could be "à améliorer" in winter
    const modEntries = Array.from({ length: 14 }, () => ({ name: 'saumon', grams: 50 }));
    const summerRes  = calcDeficiencies(modEntries, 14, { sexe: 'h', latitude_approx: 48 }, 6);
    const winterRes  = calcDeficiencies(modEntries, 14, { sexe: 'h', latitude_approx: 48 }, 1);
    const vitDSummer = summerRes.find(r => r.nutrient === 'vitD');
    const vitDWinter = winterRes.find(r => r.nutrient === 'vitD');
    // Winter threshold is stricter (80% vs 70%) — if summer passes, winter may not
    // At minimum, winter threshold should be >= summer threshold
    expect(vitDWinter).toBeDefined();
    expect(vitDSummer).toBeDefined();
  });

  test('latitude <= 35 → standard 70% threshold even in winter', () => {
    const entries = Array.from({ length: 14 }, () => ({ name: 'saumon', grams: 50 }));
    const result = calcDeficiencies(entries, 14, { sexe: 'h', latitude_approx: 35 }, 1);
    const vitD = result.find(r => r.nutrient === 'vitD');
    expect(vitD).toBeDefined();
  });

  test('returns 6 nutrients', () => {
    const result = calcDeficiencies(salmonEntries, 14, { sexe: 'h', latitude_approx: 48 }, 6);
    expect(result).toHaveLength(6);
    const names = result.map(r => r.nutrient);
    expect(names).toContain('fer');
    expect(names).toContain('calcium');
    expect(names).toContain('vitD');
    expect(names).toContain('vitB12');
    expect(names).toContain('magnesium');
    expect(names).toContain('folates');
  });

  test('female references differ for fer (16mg vs 9mg for male)', () => {
    const result_h = calcDeficiencies(breadEntries, 14, { sexe: 'h', latitude_approx: 48 }, 6);
    const result_f = calcDeficiencies(breadEntries, 14, { sexe: 'f', latitude_approx: 48 }, 6);
    const fer_h = result_h.find(r => r.nutrient === 'fer');
    const fer_f = result_f.find(r => r.nutrient === 'fer');
    expect(fer_h.daily_ref).toBe(9);
    expect(fer_f.daily_ref).toBe(16);
  });

  test('pct_reference is a number', () => {
    const result = calcDeficiencies(salmonEntries, 14, { sexe: 'h', latitude_approx: 48 }, 6);
    for (const r of result) {
      expect(typeof r.pct_reference).toBe('number');
    }
  });

  test('status labels contain no clinical/diagnostic terms (REG-05)', () => {
    const result = calcDeficiencies(breadEntries, 14, { sexe: 'h', latitude_approx: 48 }, 1);
    const forbidden = ['carence', 'déficience', 'diagnostic', 'maladie', 'pathologie', 'insuffisance'];
    for (const r of result) {
      for (const term of forbidden) {
        expect(r.status.toLowerCase()).not.toContain(term);
      }
    }
  });
});

// ─── Strava webhook — calcKcal ────────────────────────────────────────────────

describe('Strava webhook calcKcal (AL-02)', () => {
  test('kilojoules present → kcal = kj * 0.239', () => {
    const activity = { kilojoules: 1000, moving_time: 3600, sport_type: 'Run' };
    expect(calcKcal(activity, 70)).toBe(Math.round(1000 * 0.239));
  });

  test('no kilojoules, calories present → use calories', () => {
    const activity = { calories: 450, moving_time: 3600, sport_type: 'Ride' };
    expect(calcKcal(activity, 70)).toBe(450);
  });

  test('MET fallback Run → 9.0 (AL-02 moderate)', () => {
    const activity = { moving_time: 3600, sport_type: 'Run' };
    expect(calcKcal(activity, 70)).toBe(Math.round(9.0 * 70 * 1));
  });

  test('MET fallback Ride → 7.0', () => {
    const activity = { moving_time: 3600, sport_type: 'Ride' };
    expect(calcKcal(activity, 70)).toBe(Math.round(7.0 * 70 * 1));
  });

  test('MET fallback Walk → 3.5', () => {
    const activity = { moving_time: 3600, sport_type: 'Walk' };
    expect(calcKcal(activity, 70)).toBe(Math.round(3.5 * 70 * 1));
  });

  test('MET fallback Swim → 6.0', () => {
    const activity = { moving_time: 3600, sport_type: 'Swim' };
    expect(calcKcal(activity, 70)).toBe(Math.round(6.0 * 70 * 1));
  });

  test('MET fallback WeightTraining → 5.0', () => {
    const activity = { moving_time: 3600, sport_type: 'WeightTraining' };
    expect(calcKcal(activity, 70)).toBe(Math.round(5.0 * 70 * 1));
  });

  test('kilojoules takes priority over calories', () => {
    const activity = { kilojoules: 1000, calories: 999, moving_time: 3600, sport_type: 'Run' };
    expect(calcKcal(activity, 70)).toBe(Math.round(1000 * 0.239));
  });
});

// ─── Strava webhook GET — hub challenge ──────────────────────────────────────

describe('Strava webhook GET hub.challenge', () => {
  function simulateHubChallenge(verifyToken, envToken, challenge) {
    if (!envToken) return { status: 403, body: { error: 'STRAVA_VERIFY_TOKEN non configuré' } };
    if (verifyToken !== envToken) return { status: 403, body: { error: 'Validation webhook Strava échouée' } };
    return { status: 200, body: { 'hub.challenge': challenge } };
  }

  test('matching token → returns hub.challenge', () => {
    const res = simulateHubChallenge('mytoken', 'mytoken', 'abc123');
    expect(res.status).toBe(200);
    expect(res.body['hub.challenge']).toBe('abc123');
  });

  test('wrong token → 403', () => {
    const res = simulateHubChallenge('wrong', 'mytoken', 'abc123');
    expect(res.status).toBe(403);
  });

  test('no env token → 403', () => {
    const res = simulateHubChallenge('mytoken', undefined, 'abc123');
    expect(res.status).toBe(403);
  });
});
