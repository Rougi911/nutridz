'use strict';
// SL-API-05 : Strava — OAuth + sync + webhook
// GET    /api/strava/connect    (auth) — URL OAuth (state signé anti-CSRF)
// GET    /api/strava/callback           — exchangeCode → stocke les tokens → redirige app
// GET    /api/strava/status     (auth) — { connected, athleteName }
// POST   /api/strava/sync       (auth) — importe les activités du jour (dédup par strava_id)
// DELETE /api/strava/disconnect (auth) — efface les tokens
// GET    /api/strava/webhook            — hub challenge validation (no JWT — Strava servers)
// POST   /api/strava/webhook            — activity event handler
const express  = require('express');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const {
  getAuthUrl, exchangeCode, getValidToken, getTodayActivities, mapStravaType,
} = require('../services/strava');
const stravaService = require('../services/strava');

const router = express.Router();

// REG-05 / anti-CSRF : le state OAuth est un JWT court (10 min) liant le flux à l'utilisateur.
// Un attaquant ne peut pas forger un state valide → empêche l'injection d'un code dans la
// session d'un autre user. Les tokens Strava restent backend-only.
const STATE_TTL = '10m';
const STATE_TYPE = 'strava_oauth';

function signState(userId) {
  return jwt.sign({ uid: userId, t: STATE_TYPE }, process.env.JWT_SECRET, { expiresIn: STATE_TTL });
}

function verifyState(state) {
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    if (decoded.t !== STATE_TYPE || !decoded.uid) return null;
    return decoded.uid;
  } catch {
    return null;
  }
}

// ─── GET /api/strava/connect — URL OAuth (auth) ──────────────────────────────

router.get('/connect', auth, (req, res) => {
  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_REDIRECT_URI) {
    return res.status(503).json({ error: 'Strava non configuré (STRAVA_CLIENT_ID manquant)' });
  }
  const url = getAuthUrl(signState(req.userId));
  res.json({ url });
});

// ─── GET /api/strava/callback — échange du code (no auth, redirection navigateur) ──

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (!frontendUrl) {
    console.error('[Strava callback] FRONTEND_URL non défini — redirection impossible');
    return res.status(500).send('Server misconfiguration: FRONTEND_URL not set');
  }
  const redirectErr = (reason) => res.redirect(`${frontendUrl}/reglages?strava=error&reason=${reason}`);

  if (!code || !state) return redirectErr('missing_params');

  const userId = verifyState(state);
  if (!userId) return redirectErr('invalid_state'); // anti-CSRF : state forgé/expiré rejeté

  try {
    const tokens = await exchangeCode(code);
    const athleteName = [tokens.athlete?.firstname, tokens.athlete?.lastname]
      .filter(Boolean).join(' ') || 'Athlète Strava';

    await getDB().prepare(`
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
      userId,
    );

    res.redirect(`${frontendUrl}/reglages?strava=ok&athlete=${encodeURIComponent(athleteName)}`);
  } catch (err) {
    console.error('[Strava callback] échec échange:', err.message);
    redirectErr('exchange_failed');
  }
});

// ─── GET /api/strava/status — état de connexion (auth) ───────────────────────

router.get('/status', auth, async (req, res) => {
  try {
    const profile = await getDB().prepare(
      'SELECT strava_access_token, strava_athlete_name FROM profiles WHERE user_id = ?'
    ).get(req.userId);
    res.json({
      connected: !!profile?.strava_access_token,
      athleteName: profile?.strava_athlete_name || null,
    });
  } catch (err) {
    console.error('[Strava status] erreur:', err.message);
    res.status(500).json({ error: 'Erreur état Strava' });
  }
});

// ─── POST /api/strava/sync — import des activités du jour (auth) ─────────────

router.post('/sync', auth, async (req, res) => {
  try {
    const result = await getTodayActivities(req.userId);
    if (!result.connected) {
      return res.json({ connected: false, imported: 0, activities: [] });
    }

    const db = getDB();
    const today = new Date().toISOString().split('T')[0];
    let imported = 0;

    for (const act of result.activities) {
      // dédup par strava_id (par utilisateur)
      const exists = await db.prepare(
        'SELECT id FROM activities WHERE strava_id = ? AND user_id = ?'
      ).get(act.strava_id, req.userId);
      if (exists) continue;

      await db.prepare(`
        INSERT INTO activities (id, user_id, date, type, duration_min, distance_km, calories_burned, source, strava_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'strava', ?)
      `).run(uuidv4(), req.userId, today, act.type, act.duration_min, act.distance_km, act.calories_burned, act.strava_id);
      imported++;
    }

    res.json({ connected: true, imported, activities: result.activities });
  } catch (err) {
    console.error('[Strava sync] erreur:', err.message);
    res.status(500).json({ error: 'Erreur synchronisation Strava' });
  }
});

// ─── DELETE /api/strava/disconnect — efface les tokens (auth) ────────────────

router.delete('/disconnect', auth, async (req, res) => {
  try {
    await getDB().prepare(`
      UPDATE profiles SET
        strava_access_token = NULL,
        strava_refresh_token = NULL,
        strava_athlete_id = NULL,
        strava_token_expires_at = NULL,
        strava_athlete_name = NULL
      WHERE user_id = ?
    `).run(req.userId);
    res.json({ connected: false });
  } catch (err) {
    console.error('[Strava disconnect] erreur:', err.message);
    res.status(500).json({ error: 'Erreur déconnexion Strava' });
  }
});

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
