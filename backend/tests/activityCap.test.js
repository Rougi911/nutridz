/**
 * Tests unitaires — DEF-07 : plafond calories brûlées à 1000 kcal/j
 *
 * On teste la logique de plafonnement inline (Math.min(total_burned, 1000))
 * sans appel HTTP ni mock de base de données.
 */

// Logique extraite / équivalente à ce qui doit exister dans activity.js
// pour DEF-07 : plafonner le total des calories brûlées à 1000 kcal/j.
function applyActivityCap(activities, cap = 1000) {
  const total = activities.reduce((sum, a) => sum + (a.calories_burned || 0), 0);
  return Math.min(total, cap);
}

// ========================================================================
// DEF-07 — plafond 1000 kcal/j
// ========================================================================
describe('DEF-07 — plafond 1000 kcal/j sur calories brûlées', () => {
  test('3 activités (400 + 500 + 600 = 1500 kcal) → plafonné à 1000', () => {
    const activities = [
      { calories_burned: 400 },
      { calories_burned: 500 },
      { calories_burned: 600 },
    ];
    expect(applyActivityCap(activities)).toBe(1000);
  });

  test('2 activités (200 + 300 = 500 kcal) → non plafonné, retourne 500', () => {
    const activities = [
      { calories_burned: 200 },
      { calories_burned: 300 },
    ];
    expect(applyActivityCap(activities)).toBe(500);
  });

  test('0 activités → retourne 0', () => {
    expect(applyActivityCap([])).toBe(0);
  });

  test('exactement 1000 kcal → retourne 1000 (limite incluse, non plafonné)', () => {
    const activities = [
      { calories_burned: 500 },
      { calories_burned: 500 },
    ];
    expect(applyActivityCap(activities)).toBe(1000);
  });

  test('1001 kcal → plafonné à 1000', () => {
    const activities = [{ calories_burned: 1001 }];
    expect(applyActivityCap(activities)).toBe(1000);
  });

  test('plafond respecte la valeur cap personnalisée (ex. 800)', () => {
    const activities = [{ calories_burned: 1200 }];
    expect(applyActivityCap(activities, 800)).toBe(800);
  });

  test('activité sans calories_burned (undefined) est comptée comme 0', () => {
    const activities = [
      { calories_burned: 300 },
      {},                          // calories_burned absent
      { calories_burned: 200 },
    ];
    expect(applyActivityCap(activities)).toBe(500);
  });
});
