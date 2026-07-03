// P1-5 — tests unitaires purs du service Score Santé (aucune DB requise).
const { computeHealthScore, qualityForEntries, componentsForDates } = require('../services/healthScore');

function utcDateStr(daysAgo) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

describe('qualityForEntries', () => {
  test('aucune entrée => 0', () => {
    expect(qualityForEntries([])).toBe(0);
  });
  test('produits sans additif => 100', () => {
    expect(qualityForEntries([{ additifs: '[]' }, { additifs: [] }])).toBe(100);
  });
  test('résultat borné 0..100 avec additifs', () => {
    const q = qualityForEntries([{ additifs: '["E150D","E621"]' }, { additifs: '[]' }]);
    expect(q).toBeGreaterThanOrEqual(0);
    expect(q).toBeLessThanOrEqual(100);
  });
  test('JSON additifs invalide ne casse pas (traité comme vide)', () => {
    expect(qualityForEntries([{ additifs: 'pas-du-json' }])).toBe(100);
  });
});

describe('computeHealthScore', () => {
  const targetKcal = 2000;
  // 7 jours pile dans la cible + macros équilibrées.
  const dailyAgg = [];
  const entries = [];
  for (let i = 0; i < 7; i++) {
    const date = utcDateStr(i);
    dailyAgg.push({ date, kcal: 2000, protein: 100, carbs: 225, fat: 67 });
    entries.push({ date, name: 'lentilles cuites', grams: 200, additifs: '[]' });
  }

  test('structure de sortie complète', () => {
    const r = computeHealthScore({ dailyAgg, entries, targetKcal, profile: { sexe: 'h', age: 35, latitude_approx: 46 } });
    expect(r).toHaveProperty('total');
    expect(r).toHaveProperty('components.adherence');
    expect(r).toHaveProperty('components.quality');
    expect(r).toHaveProperty('components.micro');
    expect(r).toHaveProperty('components.macro');
    expect(Array.isArray(r.history)).toBe(true);
    expect(r.history).toHaveLength(8);
    expect(Array.isArray(r.actions)).toBe(true);
    expect(r.actions.length).toBeLessThanOrEqual(3);
  });

  test('total et composantes bornés 0..100', () => {
    const r = computeHealthScore({ dailyAgg, entries, targetKcal, profile: {} });
    for (const v of [r.total, r.components.adherence, r.components.quality, r.components.micro, r.components.macro]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  test('7 jours dans la cible => adhérence = 100', () => {
    const r = computeHealthScore({ dailyAgg, entries, targetKcal, profile: {} });
    expect(r.components.adherence).toBe(100);
  });

  test('aucune donnée => total 0 et prevTotal null', () => {
    const r = computeHealthScore({ dailyAgg: [], entries: [], targetKcal, profile: {} });
    expect(r.total).toBe(0);
    expect(r.prevTotal).toBeNull();
  });

  test('jours hors cible font baisser l’adhérence', () => {
    const off = dailyAgg.map((d) => ({ ...d, kcal: 3500 })); // très au-dessus
    const r = componentsForDates(
      dailyAgg.map((d) => d.date),
      new Map(off.map((d) => [d.date, d])),
      entries, targetKcal, {}, 7,
    );
    expect(r.adherence).toBe(0);
  });
});
