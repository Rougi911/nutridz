const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { getAuthUrl, exchangeCode, getTodayActivities } = require('../services/strava');

const router = express.Router();

const MET = {
  marche:   { legere: 2.5, moderee: 3.5, intense: 5.0 },
  course:   { legere: 7.0, moderee: 9.0, intense: 12.0 },
  velo:     { legere: 4.0, moderee: 7.0, intense: 10.0 },
  natation: { legere: 4.0, moderee: 6.0, intense: 9.0  },
  muscu:    { legere: 3.0, moderee: 5.0, intense: 7.0  },
};

// ─── Strava OAuth ──────────────────────────────────────────────────────────────

router.get('/strava/auth', auth, (req, res) => {
  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_REDIRECT_URI) {
    return res.status(503).json({ error: 'Strava non configuré (STRAVA_CLIENT_ID manquant)' });
  }
  // state = userId so the callback can identify the user without a JWT
  const url = getAuthUrl(req.userId);
  res.json({ url });
});

// No auth middleware — Strava redirects the browser here with no JWT header
router.get('/strava/callback', async (req, res) => {
  const { code, state } = req.query;
  const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (!frontendUrl) {
    console.error('FRONTEND_URL is not set — Strava callback cannot redirect correctly');
    return res.status(500).send('Server misconfiguration: FRONTEND_URL not set');
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/bilan?strava=error&reason=missing_params`);
  }

  try {
    const tokens = await exchangeCode(code);
    const db = getDB();

    await db.prepare(`
      UPDATE profiles SET
        strava_access_token = ?,
        strava_refresh_token = ?,
        strava_athlete_id = ?,
        strava_token_expires_at = ?
      WHERE user_id = ?
    `).run(
      tokens.access_token,
      tokens.refresh_token,
      String(tokens.athlete?.id || ''),
      tokens.expires_at,
      state   // state was set to userId in getAuthUrl
    );

    res.redirect(`${frontendUrl}/bilan?strava=ok`);
  } catch (err) {
    console.error('Strava callback error:', err.message);
    res.redirect(`${frontendUrl}/bilan?strava=error&reason=exchange_failed`);
  }
});

// ─── Strava activités du jour ──────────────────────────────────────────────────

router.get('/strava/today', auth, async (req, res) => {
  try {
    const result = await getTodayActivities(req.userId);
    if (!result.connected) {
      return res.json({ connected: false, activities: [] });
    }

    const db = getDB();
    const today = new Date().toISOString().split('T')[0];

    for (const act of result.activities) {
      const exists = await db.prepare(
        'SELECT id FROM activities WHERE strava_id = ? AND user_id = ?'
      ).get(act.strava_id, req.userId);

      if (!exists) {
        await db.prepare(`
          INSERT INTO activities (id, user_id, date, type, duration_min, distance_km, calories_burned, source, strava_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'strava', ?)
        `).run(uuidv4(), req.userId, today, act.type, act.duration_min, act.distance_km, act.calories_burned, act.strava_id);
      }
    }

    res.json({ connected: true, activities: result.activities });
  } catch (err) {
    console.error('Strava today error:', err.message);
    res.status(500).json({ error: 'Erreur récupération Strava' });
  }
});

// ─── Saisie manuelle ──────────────────────────────────────────────────────────

router.post('/manual', auth, async (req, res) => {
  const { type, duration_min, distance_km = 0, intensite = 'moderee', date } = req.body;

  if (!type || !duration_min) {
    return res.status(400).json({ error: 'type et duration_min requis' });
  }

  const db = getDB();
  const profile = await db.prepare('SELECT weight FROM profiles WHERE user_id = ?').get(req.userId);
  const weight = profile?.weight || 70;

  const met = MET[type]?.[intensite] ?? MET.marche.moderee;
  const calories_burned = Math.round(met * weight * (duration_min / 60));

  const actDate = date || new Date().toISOString().split('T')[0];
  const id = uuidv4();

  await db.prepare(`
    INSERT INTO activities (id, user_id, date, type, duration_min, distance_km, calories_burned, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
  `).run(id, req.userId, actDate, type, duration_min, distance_km, calories_burned);

  const activity = await db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  res.status(201).json({ success: true, activity });
});

// ─── Bilan complet par date ────────────────────────────────────────────────────

router.get('/bilan/:date', auth, async (req, res) => {
  const { date } = req.params;
  const db = getDB();

  const [journalRow, activities, profile] = await Promise.all([
    db.prepare(`
      SELECT COALESCE(SUM(kcal), 0) as ingested_kcal
      FROM journal_entries
      WHERE user_id = ? AND date = ?
    `).get(req.userId, date),
    db.prepare(`
      SELECT * FROM activities WHERE user_id = ? AND date = ? ORDER BY created_at DESC
    `).all(req.userId, date),
    db.prepare('SELECT weight, goal FROM profiles WHERE user_id = ?').get(req.userId),
  ]);

  const ingested_kcal = Math.round(journalRow?.ingested_kcal || 0);
  const burned_kcal = Math.round(
    activities.reduce((sum, a) => sum + (a.calories_burned || 0), 0)
  );

  const weight = profile?.weight || 70;
  // Approximate TDEE for target (simplified, full calc in frontend via profile)
  const target_kcal = profile?.goal === 'perte' ? 1800
    : profile?.goal === 'prise' ? 2500
    : 2000;

  res.json({
    date,
    ingested_kcal,
    burned_kcal,
    target_kcal,
    balance: ingested_kcal - burned_kcal,
    net_remaining: target_kcal - (ingested_kcal - burned_kcal),
    activities,
  });
});

module.exports = router;
