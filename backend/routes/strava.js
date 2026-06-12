'use strict';
// SL-API-05 : Strava webhook routes (no JWT auth — called by Strava servers)
// GET  /api/strava/webhook — hub challenge validation
// POST /api/strava/webhook — activity event handler
const express  = require('express');
const { getDB } = require('../db');
const { getValidToken, mapStravaType } = require('../services/strava');
const stravaService = require('../services/strava');

const router = express.Router();

// AL-02 modérée MET values (COR-04)
const MET_MODERATE = { course: 9.0, velo: 7.0, marche: 3.5, natation: 6.0, muscu: 5.0 };

function calcKcal(activity, weight) {
  if (activity.kilojoules) return Math.round(activity.kilojoules * 0.239);
  if (activity.calories)   return Math.round(activity.calories);
  const type    = mapStravaType(activity.sport_type || activity.type);
  const met     = MET_MODERATE[type] || 3.5;
  const hours   = (activity.moving_time || 0) / 3600;
  return Math.round(met * (weight || 70) * hours);
}

// ─── GET /api/strava/webhook — Strava hub challenge ─────────────────────────

router.get('/webhook', (req, res) => {
  const verifyToken = process.env.STRAVA_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error('[Strava webhook] STRAVA_VERIFY_TOKEN non défini');
    return res.status(403).json({ error: 'STRAVA_VERIFY_TOKEN non configuré' });
  }

  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode !== 'subscribe' || token !== verifyToken) {
    return res.status(403).json({ error: 'Validation webhook Strava échouée' });
  }

  res.json({ 'hub.challenge': challenge });
});

// ─── POST /api/strava/webhook — activity event ───────────────────────────────

router.post('/webhook', async (req, res) => {
  // COR-05: STRAVA_VERIFY_TOKEN obligatoire sans condition
  const verifyToken = process.env.STRAVA_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error('[Strava webhook POST] STRAVA_VERIFY_TOKEN non défini');
    return res.status(403).json({ error: 'STRAVA_VERIFY_TOKEN non configuré' });
  }

  const bodyToken = req.body?.verify_token;
  if (!bodyToken || bodyToken !== verifyToken) {
    return res.status(403).json({ error: 'Token invalide' });
  }

  // Respond 200 immediately — Strava expects fast response
  res.status(200).json({ ok: true });

  // Process asynchronously after response
  setImmediate(async () => {
    try {
      const { object_type, aspect_type, object_id, owner_id } = req.body;

      if (object_type !== 'activity' || aspect_type !== 'create') return;
      if (!object_id || !owner_id) return;

      const db = getDB();
      const profile = await db.prepare(
        `SELECT user_id, weight FROM profiles WHERE strava_athlete_id = ?`
      ).get(String(owner_id));

      if (!profile) return;

      const userId = profile.user_id;
      const token  = await getValidToken(userId);
      if (!token) return;

      const activity = await stravaService.getActivityById(object_id, token);
      if (!activity) return;

      const kcal    = calcKcal(activity, profile.weight);
      const type    = mapStravaType(activity.sport_type || activity.type);
      const durMin  = Math.round((activity.moving_time || 0) / 60);
      const distKm  = activity.distance ? parseFloat((activity.distance / 1000).toFixed(2)) : 0;
      const date    = (activity.start_date_local || new Date().toISOString()).slice(0, 10);

      const { v4: uuidv4 } = require('uuid');
      await db.prepare(`
        INSERT OR IGNORE INTO activities (id, user_id, date, type, duration_min, distance_km, calories_burned, name, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'strava')
      `).run(uuidv4(), userId, date, type, durMin, distKm, kcal, activity.name || type);

    } catch (err) {
      console.error('[Strava webhook POST] Erreur traitement:', err.message);
    }
  });
});

module.exports = router;
module.exports.calcKcal = calcKcal;
