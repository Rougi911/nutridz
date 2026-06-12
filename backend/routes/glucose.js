const express = require('express');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { calculatePeriodMetrics, parseLibreViewCSV } = require('../services/glucoseMetrics');

const router = express.Router();

const VALID_TYPES = new Set(['fasting', 'pre_meal', 'post_meal', 'bedtime', 'random', 'cgm']);

// POST /api/glucose — manual reading
router.post('/', auth, async (req, res) => {
  const { glucose_mg_dl, reading_type, timestamp, notes } = req.body;
  if (!glucose_mg_dl || glucose_mg_dl < 20 || glucose_mg_dl > 600)
    return res.status(400).json({ error: 'glucose_mg_dl invalide (20–600)' });
  if (!reading_type || !VALID_TYPES.has(reading_type))
    return res.status(400).json({ error: `reading_type invalide (${[...VALID_TYPES].join(', ')})` });

  const db = getDB();
  const ts = timestamp || new Date().toISOString();

  const result = await db.prepare(`
    INSERT INTO glucose_readings (user_id, glucose_mg_dl, reading_type, timestamp, notes, source)
    VALUES (?, ?, ?, ?, ?, 'manual')
  `).run(req.userId, glucose_mg_dl, reading_type, ts, notes ?? null);

  const entry = await db.prepare('SELECT * FROM glucose_readings WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

// POST /api/glucose/import-csv — LibreView CSV bulk import
router.post('/import-csv', auth, async (req, res) => {
  const { csv_text } = req.body;
  if (!csv_text) return res.status(400).json({ error: 'csv_text requis' });

  let parsed;
  try {
    parsed = parseLibreViewCSV(csv_text);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (parsed.length === 0) return res.json({ imported_count: 0, skipped_count: 0 });

  const db = getDB();
  let imported_count = 0;
  let skipped_count = 0;

  for (const r of parsed) {
    try {
      await db.prepare(`
        INSERT INTO glucose_readings (user_id, glucose_mg_dl, reading_type, timestamp, source)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.userId, r.glucose_mg_dl, r.reading_type, r.timestamp, r.source);
      imported_count++;
    } catch {
      skipped_count++;
    }
  }

  res.json({ imported_count, skipped_count });
});

// GET /api/glucose — range query
router.get('/', auth, async (req, res) => {
  const db = getDB();
  const to   = req.query.to   || new Date().toISOString();
  const from = req.query.from || (() => {
    const d = new Date(to); d.setDate(d.getDate() - 30); return d.toISOString();
  })();

  const rows = await db.prepare(
    'SELECT * FROM glucose_readings WHERE user_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC'
  ).all(req.userId, from, to);
  res.json(rows);
});

// GET /api/glucose/latest
router.get('/latest', auth, async (req, res) => {
  const db = getDB();
  const entry = await db.prepare(
    'SELECT * FROM glucose_readings WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1'
  ).get(req.userId);
  res.json(entry || null);
});

// GET /api/glucose/metrics?days=N
// DEF-09: uses personalized TIR targets from profiles (glucose_target_min/max_mg_dl)
router.get('/metrics', auth, async (req, res) => {
  const days = Math.min(365, parseInt(req.query.days) || 14);
  const db = getDB();
  const from = new Date();
  from.setDate(from.getDate() - days);

  const [readings, profile] = await Promise.all([
    db.prepare(
      'SELECT * FROM glucose_readings WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp ASC'
    ).all(req.userId, from.toISOString()),
    db.prepare('SELECT glucose_target_min_mg_dl, glucose_target_max_mg_dl FROM profiles WHERE user_id = ?').get(req.userId),
  ]);

  const targetMin = profile?.glucose_target_min_mg_dl || 70;
  const targetMax = profile?.glucose_target_max_mg_dl || 180;

  res.json(calculatePeriodMetrics(readings, targetMin, targetMax));
});

// DELETE /api/glucose/:id
router.delete('/:id', auth, async (req, res) => {
  const db = getDB();
  const result = await db.prepare(
    'DELETE FROM glucose_readings WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Lecture non trouvée' });
  res.json({ success: true });
});

// DELETE /api/glucose/all
router.delete('/all', auth, async (req, res) => {
  const db = getDB();
  try {
    const result = await db.prepare('DELETE FROM glucose_readings WHERE user_id = ?').run(req.userId);
    res.json({ deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
