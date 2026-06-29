const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getDB } = require('../db');

router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'Subscription required' });

    await getDB().prepare(`
      INSERT INTO push_subscriptions (user_id, subscription_json)
      VALUES (?, ?)
      ON CONFLICT (user_id) DO UPDATE SET subscription_json = excluded.subscription_json
    `).run(req.userId, JSON.stringify(subscription));

    res.json({ success: true });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

router.delete('/subscribe', authMiddleware, async (req, res) => {
  try {
    await getDB().prepare(`
      DELETE FROM push_subscriptions WHERE user_id = ?
    `).run(req.userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// ─── S26 — Préférences de rappels (activation + heure par type) ──────────────────
const DEFAULT_PREFS = {
  journal_enabled: false, journal_time: '20:00',
  glucose_enabled: false, glucose_time: '08:00',
  hydration_enabled: false, deficiency_enabled: false, geo_consent: false,
};

// GET /api/notifications/prefs — défauts si jamais enregistrées.
router.get('/prefs', authMiddleware, async (req, res) => {
  try {
    const row = await getDB().prepare('SELECT * FROM notification_prefs WHERE user_id = ?').get(req.userId);
    res.json(row || { user_id: req.userId, ...DEFAULT_PREFS });
  } catch (error) {
    console.error('Prefs get error:', error);
    res.status(500).json({ error: 'Failed to load prefs' });
  }
});

// PUT /api/notifications/prefs — maj des préférences (booléens + heures HH:MM bornés).
router.put('/prefs', authMiddleware, async (req, res) => {
  const b = req.body || {};
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  const time = (v, d) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : d);
  const p = {
    journal_enabled:    bool(b.journal_enabled, false),
    journal_time:       time(b.journal_time, '20:00'),
    glucose_enabled:    bool(b.glucose_enabled, false),
    glucose_time:       time(b.glucose_time, '08:00'),
    hydration_enabled:  bool(b.hydration_enabled, false),
    deficiency_enabled: bool(b.deficiency_enabled, false),
    geo_consent:        bool(b.geo_consent, false),
  };
  try {
    await getDB().prepare(`
      INSERT INTO notification_prefs
        (user_id, journal_enabled, journal_time, glucose_enabled, glucose_time, hydration_enabled, deficiency_enabled, geo_consent, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, now())
      ON CONFLICT (user_id) DO UPDATE SET
        journal_enabled = excluded.journal_enabled,
        journal_time = excluded.journal_time,
        glucose_enabled = excluded.glucose_enabled,
        glucose_time = excluded.glucose_time,
        hydration_enabled = excluded.hydration_enabled,
        deficiency_enabled = excluded.deficiency_enabled,
        geo_consent = excluded.geo_consent,
        updated_at = now()
    `).run(req.userId, p.journal_enabled, p.journal_time, p.glucose_enabled, p.glucose_time, p.hydration_enabled, p.deficiency_enabled, p.geo_consent);
    res.json({ success: true, prefs: { user_id: req.userId, ...p } });
  } catch (error) {
    console.error('Prefs put error:', error);
    res.status(500).json({ error: 'Failed to save prefs' });
  }
});

module.exports = router;
