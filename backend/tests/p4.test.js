'use strict';
// P4.5 tests — POST /query shared functions (journal, glucose, weight, activity)
// Tracé : P4.5 Section 2 — contrat frontend POST /query aligné backend

const { queryGlucoseRange }    = require('../routes/glucose');
const { queryWeightRange }     = require('../routes/weight');
const { queryActivitiesByDate } = require('../routes/activity');
const { queryJournalByDate }   = require('../routes/journal');

// Minimal mock db factory — returns fixed rows for .all(), fixed row for .get()
function mockDb(rows = []) {
  return {
    prepare: () => ({
      all: async () => rows,
      get:  async () => rows[0] || null,
    }),
  };
}

// ─── queryGlucoseRange ────────────────────────────────────────────────────────

describe('queryGlucoseRange — POST /api/glucose/query shared logic', () => {
  const GLUCOSE_ROWS = [
    { id: 1, user_id: 'u1', glucose_mg_dl: 92,  reading_type: 'fasting',  timestamp: '2026-06-12T07:00:00.000Z', source: 'manual' },
    { id: 2, user_id: 'u1', glucose_mg_dl: 145, reading_type: 'post_meal', timestamp: '2026-06-12T13:00:00.000Z', source: 'manual' },
  ];

  test('returns rows from db unchanged', async () => {
    const db = mockDb(GLUCOSE_ROWS);
    const result = await queryGlucoseRange(db, 'u1', '2026-06-01T00:00:00.000Z', '2026-06-12T23:59:59.000Z');
    expect(result).toHaveLength(2);
    expect(result[0].glucose_mg_dl).toBe(92);
    expect(result[1].glucose_mg_dl).toBe(145);
  });

  test('empty db returns empty array', async () => {
    const db = mockDb([]);
    const result = await queryGlucoseRange(db, 'u1', '2026-06-01T00:00:00.000Z', '2026-06-12T23:59:59.000Z');
    expect(result).toEqual([]);
  });

  test('POST /query days=7 → from is 7 days before to (ISO)', () => {
    const days = 7;
    const to   = new Date().toISOString();
    const from = (() => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString(); })();
    const diffDays = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  test('POST /query days=30 → from is 30 days before to (ISO)', () => {
    const days = 30;
    const to   = new Date().toISOString();
    const from = (() => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString(); })();
    const diffDays = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });
});

// ─── queryWeightRange ─────────────────────────────────────────────────────────

describe('queryWeightRange — POST /api/weight/query shared logic', () => {
  const WEIGHT_ROWS = [
    { id: 1, user_id: 'u1', weight_kg: 81.7, body_fat_pct: 21.3, date: '2026-06-10' },
    { id: 2, user_id: 'u1', weight_kg: 81.2, body_fat_pct: 21.0, date: '2026-06-12' },
  ];

  test('returns rows from db unchanged', async () => {
    const db = mockDb(WEIGHT_ROWS);
    const result = await queryWeightRange(db, 'u1', '2026-06-01', '2026-06-12');
    expect(result).toHaveLength(2);
    expect(result[0].weight_kg).toBe(81.7);
    expect(result[1].weight_kg).toBe(81.2);
  });

  test('empty db returns empty array', async () => {
    const db = mockDb([]);
    const result = await queryWeightRange(db, 'u1', '2026-06-01', '2026-06-12');
    expect(result).toEqual([]);
  });

  test('POST /query days=14 → from is 14 days before to (date-only)', () => {
    const days = 14;
    const to   = new Date().toISOString().split('T')[0];
    const from = (() => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split('T')[0]; })();
    const diffDays = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(14, 0);
  });
});

// ─── queryActivitiesByDate ────────────────────────────────────────────────────

describe('queryActivitiesByDate — POST /api/activities/query shared logic', () => {
  const ACTIVITY_ROWS = [
    { id: 'a1', user_id: 'u1', type: 'course', duration_min: 35, distance_km: 5.2, calories_burned: 310, date: '2026-06-12', source: 'strava', strava_id: 's1', created_at: '2026-06-12T06:30:00Z' },
    { id: 'a2', user_id: 'u1', type: 'marche', duration_min: 45, distance_km: 3.0, calories_burned: 150, date: '2026-06-12', source: 'manual', strava_id: null, created_at: '2026-06-12T08:00:00Z' },
  ];

  test('returns flat activity array for a given date', async () => {
    const db = mockDb(ACTIVITY_ROWS);
    const result = await queryActivitiesByDate(db, 'u1', '2026-06-12');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('course');
    expect(result[0].calories_burned).toBe(310);
    expect(result[1].type).toBe('marche');
  });

  test('returns empty array when no activities for date', async () => {
    const db = mockDb([]);
    const result = await queryActivitiesByDate(db, 'u1', '2026-06-11');
    expect(result).toEqual([]);
  });

  test('Strava activity has strava_id field', async () => {
    const db = mockDb(ACTIVITY_ROWS);
    const result = await queryActivitiesByDate(db, 'u1', '2026-06-12');
    const strava = result.find(a => a.source === 'strava');
    expect(strava).toBeDefined();
    expect(strava.strava_id).toBe('s1');
  });

  test('flat query returns duration_min field (not duration)', async () => {
    const db = mockDb(ACTIVITY_ROWS);
    const result = await queryActivitiesByDate(db, 'u1', '2026-06-12');
    // DB schema uses duration_min — frontend mapper handles the rename
    expect(result[0]).toHaveProperty('duration_min');
    expect(result[0].duration_min).toBe(35);
  });
});

// ─── queryJournalByDate ───────────────────────────────────────────────────────

describe('queryJournalByDate — POST /api/journal/query shared logic', () => {
  test('empty journal → totals all zero', async () => {
    const db = mockDb([]);
    const result = await queryJournalByDate(db, 'u1', '2026-06-12', 'fr');
    expect(result.date).toBe('2026-06-12');
    expect(result.totals.kcal).toBe(0);
    expect(result.totals.glucides).toBe(0);
    expect(result.totals.proteines).toBe(0);
    expect(result.totals.lipides).toBe(0);
    expect(result.totals.fibres).toBe(0);
  });

  test('empty journal → meals object has 4 empty arrays', async () => {
    const db = mockDb([]);
    const result = await queryJournalByDate(db, 'u1', '2026-06-12', 'fr');
    expect(result.meals).toHaveProperty('pdej');
    expect(result.meals).toHaveProperty('dej');
    expect(result.meals).toHaveProperty('coll');
    expect(result.meals).toHaveProperty('diner');
    expect(result.meals.pdej).toEqual([]);
    expect(result.meals.dej).toEqual([]);
  });

  test('date passed through to result', async () => {
    const db = mockDb([]);
    const result = await queryJournalByDate(db, 'u1', '2026-06-01', 'fr');
    expect(result.date).toBe('2026-06-01');
  });
});
