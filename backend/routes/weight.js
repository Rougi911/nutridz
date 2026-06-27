const express = require('express');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { estimateBodyFatPct, periodEstimation } = require('../services/bodyComposition');

const router = express.Router();

const RESISTANCE_TYPES = new Set(['muscu', 'musculation', 'crossfit', 'weighttraining', 'strength', 'gym', 'resistance']);

function computeProfileMetrics(p) {
  const levelFactor = { sed: 1.2, light: 1.375, mod: 1.55, actif: 1.725 };
  const paceDeficit = { doux: 250, modere: 500, rapide: 750 };
  const paceSurplus = { doux: 200, modere: 350, rapide: 500 };
  const bmr = p.sexe === 'h'
    ? 88.362 + 13.397 * p.weight + 4.799 * p.height - 5.677 * p.age
    : 447.593 + 9.247 * p.weight + 3.098 * p.height - 4.330 * p.age;
  const tdee = Math.round(bmr * (levelFactor[p.activity_level] || 1.375));
  let target = tdee;
  if (p.goal === 'perte') target = tdee - (paceDeficit[p.pace] || 500);
  else if (p.goal === 'prise') target = tdee + (paceSurplus[p.pace] || 350);
  return { bmr: Math.round(bmr), tdee, target_kcal: target };
}

// POST /api/weight
router.post('/', auth, async (req, res) => {
  const { weight_kg, body_fat_pct, date, notes } = req.body;
  if (!weight_kg || weight_kg < 20 || weight_kg > 300)
    return res.status(400).json({ error: 'weight_kg invalide (20–300)' });

  const db = getDB();
  const today = date || new Date().toISOString().split('T')[0];

  await db.prepare(`
    INSERT INTO weight_entries (user_id, weight_kg, body_fat_pct, date, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (user_id, date) DO UPDATE SET
      weight_kg = excluded.weight_kg,
      body_fat_pct = excluded.body_fat_pct,
      notes = excluded.notes
  `).run(req.userId, weight_kg, body_fat_pct ?? null, today, notes ?? null);

  const entry = await db.prepare(
    'SELECT * FROM weight_entries WHERE user_id = ? AND date = ?'
  ).get(req.userId, today);

  res.status(201).json(entry);
});

// Shared logic for GET / and POST /query
async function queryWeightRange(db, userId, from, to) {
  return db.prepare(
    'SELECT * FROM weight_entries WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC'
  ).all(userId, from, to);
}

// GET /api/weight
router.get('/', auth, async (req, res) => {
  const db = getDB();
  const to   = req.query.to   || new Date().toISOString().split('T')[0];
  const from = req.query.from || (() => {
    const d = new Date(to); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  })();
  res.json(await queryWeightRange(db, req.userId, from, to));
});

// POST /api/weight/query — même logique, days dans le body (contrat frontend P4)
router.post('/query', auth, async (req, res) => {
  try {
    const db = getDB();
    const days = Math.min(365, parseInt(req.body.days) || 30);
    const to   = new Date().toISOString().split('T')[0];
    const from = (() => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split('T')[0]; })();
    res.json(await queryWeightRange(db, req.userId, from, to));
  } catch (err) {
    console.error('[weight/query] error:', err.message);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// GET /api/weight/latest
router.get('/latest', auth, async (req, res) => {
  const db = getDB();
  const entry = await db.prepare(
    'SELECT * FROM weight_entries WHERE user_id = ? ORDER BY date DESC LIMIT 1'
  ).get(req.userId);
  res.json(entry || null);
});

// GET /api/weight/evolution?days=N
router.get('/evolution', auth, async (req, res) => {
  const days = Math.min(365, parseInt(req.query.days) || 30);
  const db = getDB();

  const today = new Date().toISOString().split('T')[0];
  const fromDate = (() => {
    const d = new Date(today); d.setDate(d.getDate() - days + 1); return d.toISOString().split('T')[0];
  })();

  // Weight entries
  const weight_entries = await db.prepare(
    'SELECT * FROM weight_entries WHERE user_id = ? AND date >= ? ORDER BY date ASC'
  ).all(req.userId, fromDate);

  // Profile for TDEE + BF estimation
  const profile = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.userId);
  const metrics = profile ? computeProfileMetrics(profile) : { tdee: 2000, target_kcal: 2000 };
  const tdee = metrics.tdee;

  const sex = profile?.sexe === 'h' ? 'male' : profile?.sexe === 'f' ? 'female' : 'other';
  const current_bf_pct = estimateBodyFatPct({
    weight_kg: profile?.weight,
    height_cm: profile?.height,
    age: profile?.age,
    sex,
  }) ?? 20;

  // Journal kcal consumed per day
  const journalRows = await db.prepare(`
    SELECT date, SUM(kcal) as kcal_consumed
    FROM journal_entries
    WHERE user_id = ? AND date >= ?
    GROUP BY date
  `).all(req.userId, fromDate);
  const journalMap = Object.fromEntries(journalRows.map(r => [r.date, r.kcal_consumed]));

  // Activity kcal burned per day (check table exists via PRAGMA)
  let activityMap = {};
  let activitiesExist = false;
  try {
    const cols = await db.prepare(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'activities'`
    ).all();
    activitiesExist = cols.length > 0;
    if (activitiesExist) {
      const actRows = await db.prepare(`
        SELECT date, SUM(calories_burned) as activity_kcal, string_agg(type, ',') as types
        FROM activities
        WHERE user_id = ? AND date >= ?
        GROUP BY date
      `).all(req.userId, fromDate);
      activityMap = Object.fromEntries(actRows.map(r => [r.date, {
        kcal: r.activity_kcal || 0,
        resistance_today: (r.types || '').split(',').some(t => RESISTANCE_TYPES.has(t.toLowerCase().trim())),
      }]));
    }
  } catch (_) {}

  // Build nets array for each day in range
  const nets = [];
  const d = new Date(fromDate);
  const end = new Date(today);
  while (d <= end) {
    const dateStr = d.toISOString().split('T')[0];
    const kcal_consumed = journalMap[dateStr] || 0;
    const act = activityMap[dateStr] || { kcal: 0, resistance_today: false };
    // net = consumed - (tdee + extra activity burn)
    const net_kcal = kcal_consumed - tdee - act.kcal;
    nets.push({ date: dateStr, net_kcal, resistance_today: act.resistance_today });
    d.setDate(d.getDate() + 1);
  }

  const period = periodEstimation({ nets, baseline_bf_pct: current_bf_pct });

  res.json({
    weight_entries,
    period,
    current_bf_pct,
    tdee,
    activities_tracked: activitiesExist,
  });
});

// DELETE /api/weight/:id
router.delete('/:id', auth, async (req, res) => {
  const db = getDB();
  const result = await db.prepare(
    'DELETE FROM weight_entries WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Entrée non trouvée' });
  res.json({ success: true });
});

// DELETE /api/weight/all
router.delete('/all', auth, async (req, res) => {
  const db = getDB();
  try {
    const result = await db.prepare('DELETE FROM weight_entries WHERE user_id = ?').run(req.userId);
    res.json({ deleted: result.changes });
  } catch (err) {
    console.error('[weight/delete-all] error:', err.message);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
module.exports.queryWeightRange = queryWeightRange;
