// P1-4 — tests unitaires purs du service Glycémie × Repas (aucune DB requise).
const { aggregateMeals, buildDayTimeline, detectPattern, postprandial } = require('../services/glucoseMeals');

const DATE = '2026-07-03';
const target = { low: 70, high: 180 };

function reading(hhmm, val) {
  return { glucose_mg_dl: val, timestamp: `${DATE}T${hhmm}:00Z` };
}

describe('postprandial', () => {
  test('pic dans les 2 h − lecture pré => delta et pic', () => {
    const mealMs = new Date(`${DATE}T12:30:00Z`).getTime();
    const readings = [reading('12:15', 100), reading('13:30', 175)];
    const pp = postprandial(mealMs, readings);
    expect(pp).toEqual({ deltaMgDl: 75, peakMgDl: 175 });
  });
  test('pas de lecture pré => null', () => {
    const mealMs = new Date(`${DATE}T12:30:00Z`).getTime();
    expect(postprandial(mealMs, [reading('13:30', 175)])).toBeNull();
  });
});

describe('buildDayTimeline', () => {
  const meals = [
    { date: DATE, meal_type: 'dej', logged_at: `${DATE}T12:30:00Z`, kcal: 720, glucides: 92, name: 'pain blanc' },
  ];
  const readings = [reading('12:15', 100), reading('13:30', 178), reading('18:00', 120)];

  test('points, marqueurs, TIR', () => {
    const tl = buildDayTimeline(DATE, readings, aggregateMeals(meals), target);
    expect(tl.points).toHaveLength(3);
    expect(tl.markers).toHaveLength(1);
    expect(tl.markers[0].mealType).toBe('lunch'); // dej -> lunch
    expect(tl.markers[0].carbs).toBe(92);
    expect(tl.markers[0].deltaMgDl).toBe(78);
    expect(tl.tir).toBe(100); // 3/3 dans [70,180]
    expect(tl.maxPeakDeltaMgDl).toBe(78);
  });

  test('jour sans glycémie => tir null, points vides', () => {
    const tl = buildDayTimeline(DATE, [], aggregateMeals(meals), target);
    expect(tl.points).toHaveLength(0);
    expect(tl.tir).toBeNull();
  });
});

describe('detectPattern', () => {
  function buildDays(n, carbs, peak) {
    const meals = [];
    const readings = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      meals.push({ date: d, meal_type: 'dej', logged_at: `${d}T12:30:00Z`, kcal: 700, glucides: carbs, name: 'x' });
      readings.push({ glucose_mg_dl: peak, timestamp: `${d}T13:30:00Z` });
    }
    return { mealsByDate: aggregateMeals(meals), readings };
  }
  test('assez de déjeuners riches suivis de pics => pattern', () => {
    const { mealsByDate, readings } = buildDays(5, 90, 185);
    const p = detectPattern(mealsByDate, readings);
    expect(p).not.toBeNull();
    expect(p.total).toBe(5);
    expect(p.count).toBe(5);
    expect(p.carbThreshold).toBe(80);
  });
  test('trop peu de données => null', () => {
    const { mealsByDate, readings } = buildDays(2, 90, 185);
    expect(detectPattern(mealsByDate, readings)).toBeNull();
  });
  test('déjeuners pauvres en glucides => null', () => {
    const { mealsByDate, readings } = buildDays(5, 40, 185);
    expect(detectPattern(mealsByDate, readings)).toBeNull();
  });
});
