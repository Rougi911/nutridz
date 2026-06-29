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

    const athleteName = [tokens.athlete?.firstname, tokens.athlete?.lastname]
      .filter(Boolean).join(' ') || 'Athlète Strava';

    const uid = `${String(state).substring(0, 4)}…`;
    console.log(`[Strava callback] uid=${uid} athlete="${athleteName}" expires_at=${tokens.expires_at}`);

    await db.prepare(`
      UPDATE profiles SET
        strava_access_token = ?,
        strava_refresh_token = ?,
        strava_athlete_id = ?,
        strava_token_expires_at = ?,
        strava_athlete_name = ?
      WHERE user_id = ?
    `).run(
      tokens.access_token,
      tokens.refresh_token,
      String(tokens.athlete?.id || ''),
      tokens.expires_at,
      athleteName,
      state   // state was set to userId in getAuthUrl
    );

    console.log(`[Strava callback] Token saved successfully for uid=${uid}`);
    res.redirect(`${frontendUrl}/bilan?strava=ok&athlete=${encodeURIComponent(athleteName)}`);
  } catch (err) {
    console.error('[Strava callback] Error:', err.message);
    res.redirect(`${frontendUrl}/bilan?strava=error&reason=exchange_failed`);
  }
});

// ─── Strava activités du jour ──────────────────────────────────────────────────

router.get('/strava/today', auth, async (req, res) => {
  try {
    const uid = `${String(req.userId).substring(0, 4)}…`;
    console.log(`[Strava today] Fetching activities for uid=${uid}`);
    const result = await getTodayActivities(req.userId);
    if (!result.connected) {
      console.log(`[Strava today] uid=${uid} — not connected (no token)`);
      return res.json({ connected: false, activities: [] });
    }
    console.log(`[Strava today] uid=${uid} — ${result.activities.length} activitie(s) from Strava`);

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

// ─── POST /query — liste plate d'activités par date (contrat frontend P4) ─────

async function queryActivitiesByDate(db, userId, date) {
  return db.prepare(
    'SELECT * FROM activities WHERE user_id = ? AND date = ? ORDER BY created_at DESC'
  ).all(userId, date);
}

router.post('/query', auth, async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const db = getDB();
    res.json(await queryActivitiesByDate(db, req.userId, date));
  } catch (err) {
    console.error('[activity/query] error:', err.message);
    res.status(500).json({ error: 'Erreur interne' });
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

// ─── S25 — Éditer / supprimer une activité ───────────────────────────────────────

// PATCH /api/activities/:id — modifier une activité MANUELLE (recalcul kcal). IDOR-guard (userId).
// Les activités importées de Strava ne sont pas modifiables (source de vérité = Strava).
router.patch('/:id', auth, async (req, res) => {
  const db = getDB();
  const existing = await db.prepare('SELECT * FROM activities WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Activité non trouvée' });
  if (existing.source === 'strava') return res.status(409).json({ error: 'Activité Strava non modifiable' });

  const type         = req.body.type ?? existing.type;
  const duration_min = req.body.duration_min ?? existing.duration_min;
  const distance_km  = req.body.distance_km ?? existing.distance_km;
  const intensite    = req.body.intensite || 'moderee'; // non persistée → défaut modérée au recalcul
  if (!type || duration_min == null || isNaN(duration_min) || duration_min <= 0) {
    return res.status(400).json({ error: 'type et duration_min (>0) requis' });
  }

  const profile = await db.prepare('SELECT weight FROM profiles WHERE user_id = ?').get(req.userId);
  const weight = profile?.weight || 70;
  const met = MET[type]?.[intensite] ?? MET.marche.moderee;
  const calories_burned = Math.round(met * weight * (duration_min / 60));

  await db.prepare(`
    UPDATE activities SET type = ?, duration_min = ?, distance_km = ?, calories_burned = ?
    WHERE id = ? AND user_id = ?
  `).run(type, duration_min, distance_km, calories_burned, req.params.id, req.userId);

  const activity = await db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  res.json({ success: true, activity });
});

// DELETE /api/activities/:id — supprimer une activité (manuelle ou Strava). IDOR-guard (userId).
router.delete('/:id', auth, async (req, res) => {
  const db = getDB();
  const result = await db.prepare('DELETE FROM activities WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Activité non trouvée' });
  res.json({ success: true });
});

// ─── Bilan complet par date ────────────────────────────────────────────────────

router.get('/bilan/:date', auth, async (req, res) => {
  const { date } = req.params;
  const db = getDB();

  const [journalRow, activities, profile] = await Promise.all([
    db.prepare(`
      SELECT
        COALESCE(SUM(kcal), 0)      as ingested_kcal,
        COALESCE(SUM(glucides), 0)  as glucides,
        COALESCE(SUM(proteines), 0) as proteines,
        COALESCE(SUM(lipides), 0)   as lipides
      FROM journal_entries
      WHERE user_id = ? AND date = ?
    `).get(req.userId, date),
    db.prepare(`
      SELECT * FROM activities WHERE user_id = ? AND date = ? ORDER BY created_at DESC
    `).all(req.userId, date),
    db.prepare('SELECT weight, goal, strava_access_token, strava_athlete_name FROM profiles WHERE user_id = ?').get(req.userId),
  ]);

  const ingested_kcal = Math.round(journalRow?.ingested_kcal || 0);
  // AL-03: cap activity credit at 1000 kcal/day to avoid unrealistic deficits
  const burned_kcal = Math.min(
    Math.round(activities.reduce((sum, a) => sum + (a.calories_burned || 0), 0)),
    1000
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
    glucides: Math.round(journalRow?.glucides || 0),
    proteines: Math.round(journalRow?.proteines || 0),
    lipides: Math.round(journalRow?.lipides || 0),
    activities,
    strava_connected: !!profile?.strava_access_token,
    strava_athlete_name: profile?.strava_athlete_name || null,
  });
});

// ─── Statistiques hebdomadaires ────────────────────────────────────────────────

router.get('/stats/weekly', auth, async (req, res) => {
  const db = getDB();

  // Build array of last 7 dates (oldest → today)
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  const oldest = dates[0];

  const [journalRows, activityRows, profile] = await Promise.all([
    db.prepare(`
      SELECT date,
        COALESCE(SUM(kcal), 0)      as calories_in,
        COALESCE(SUM(glucides), 0)  as carbs,
        COALESCE(SUM(proteines), 0) as protein,
        COALESCE(SUM(lipides), 0)   as fat
      FROM journal_entries
      WHERE user_id = ? AND date >= ?
      GROUP BY date
    `).all(req.userId, oldest),
    db.prepare(`
      SELECT date, COALESCE(SUM(calories_burned), 0) as calories_out
      FROM activities
      WHERE user_id = ? AND date >= ?
      GROUP BY date
    `).all(req.userId, oldest),
    db.prepare('SELECT weight, goal FROM profiles WHERE user_id = ?').get(req.userId),
  ]);

  const target_kcal = profile?.goal === 'perte' ? 1800
    : profile?.goal === 'prise' ? 2500
    : 2000;
  const weight = profile?.weight || 70;

  // Merge into a day-by-day map
  const dayMap = {};
  for (const date of dates) {
    dayMap[date] = { date, calories_in: 0, calories_out: 0, carbs: 0, protein: 0, fat: 0 };
  }
  for (const r of journalRows) {
    if (dayMap[r.date]) Object.assign(dayMap[r.date], r);
  }
  for (const r of activityRows) {
    if (dayMap[r.date]) dayMap[r.date].calories_out = Math.round(r.calories_out);
  }

  const days = Object.values(dayMap); // 7 entries
  const activeDays = days.filter(d => d.calories_in > 0);
  const n = activeDays.length || 1;

  const avg_calories_in  = Math.round(activeDays.reduce((s, d) => s + d.calories_in,  0) / n);
  const avg_calories_out = Math.round(activeDays.reduce((s, d) => s + d.calories_out, 0) / n);
  const avg_balance      = avg_calories_in - avg_calories_out;

  const days_on_target = activeDays.filter(d =>
    Math.abs(d.calories_in - target_kcal) <= 200
  ).length;

  const weekly_protein_avg = Math.round(activeDays.reduce((s, d) => s + d.protein, 0) / n);
  const weekly_carbs_avg   = Math.round(activeDays.reduce((s, d) => s + d.carbs,   0) / n);
  const weekly_fat_avg     = Math.round(activeDays.reduce((s, d) => s + d.fat,     0) / n);

  // Best day = closest balance to 0, worst = farthest
  const sortedByBalance = [...activeDays].sort((a, b) =>
    Math.abs(a.calories_in - target_kcal) - Math.abs(b.calories_in - target_kcal)
  );
  const best_day  = sortedByBalance[0]?.date || null;
  const worst_day = sortedByBalance[sortedByBalance.length - 1]?.date || null;

  // Projected weekly weight change: avg_balance * 7 / 3500 (fat) or / 2800 (muscle)
  const projected_weight_change = parseFloat((avg_balance * 7 / 3500).toFixed(2));

  res.json({
    days,
    target_kcal,
    avg_calories_in,
    avg_calories_out,
    avg_balance,
    days_on_target,
    active_days: activeDays.length,
    best_day,
    worst_day,
    weekly_protein_avg,
    weekly_carbs_avg,
    weekly_fat_avg,
    projected_weight_change,
    weight,
    goal: profile?.goal || 'maintien',
  });
});

// ─── Statistiques mensuelles ───────────────────────────────────────────────────

router.get('/stats/monthly', auth, async (req, res) => {
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
  const db = getDB();

  const pad = n => String(n).padStart(2, '0');
  const startDate = `${year}-${pad(month)}-01`;
  const lastDay   = new Date(year, month, 0).getDate();
  const endDate   = `${year}-${pad(month)}-${pad(lastDay)}`;

  const [journalRows, activityRows, profile] = await Promise.all([
    db.prepare(`
      SELECT date, COALESCE(SUM(kcal), 0) as calories_in
      FROM journal_entries
      WHERE user_id = ? AND date >= ? AND date <= ?
      GROUP BY date
    `).all(req.userId, startDate, endDate),
    db.prepare(`
      SELECT date, COALESCE(SUM(calories_burned), 0) as calories_out
      FROM activities
      WHERE user_id = ? AND date >= ? AND date <= ?
      GROUP BY date
    `).all(req.userId, startDate, endDate),
    db.prepare('SELECT weight, goal FROM profiles WHERE user_id = ?').get(req.userId),
  ]);

  const target_kcal = profile?.goal === 'perte' ? 1800
    : profile?.goal === 'prise' ? 2500
    : 2000;
  const goal = profile?.goal || 'maintien';

  const journalMap  = Object.fromEntries(journalRows.map(r => [r.date, Math.round(r.calories_in)]));
  const activityMap = Object.fromEntries(activityRows.map(r => [r.date, Math.round(r.calories_out)]));

  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    const date         = `${year}-${pad(month)}-${pad(d)}`;
    const calories_in  = journalMap[date]  || 0;
    const calories_out = activityMap[date] || 0;
    const has_data     = calories_in > 0;
    const balance      = Math.round(calories_in - calories_out);
    const deviation    = Math.round(balance - target_kcal);
    const on_target    = has_data && Math.abs(deviation) <= 150;
    days.push({ date, day: d, calories_in, calories_out, balance, deviation, on_target, has_data });
  }

  const tracked = days.filter(d => d.has_data);
  const days_on_target = tracked.filter(d => d.on_target).length;
  const avg_balance    = tracked.length
    ? Math.round(tracked.reduce((s, d) => s + d.balance, 0) / tracked.length)
    : 0;

  const sorted    = [...tracked].sort((a, b) => Math.abs(a.deviation) - Math.abs(b.deviation));
  const best_day  = sorted[0]?.date || null;
  const worst_day = sorted[sorted.length - 1]?.date || null;

  const projected_weight_change = parseFloat((avg_balance * lastDay / 3500).toFixed(2));

  res.json({
    year, month, days, target_kcal, goal,
    days_on_target, total_tracked: tracked.length,
    best_day, worst_day, avg_balance, projected_weight_change,
  });
});

module.exports = router;
module.exports.queryActivitiesByDate = queryActivitiesByDate;
