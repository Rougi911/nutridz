const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const db = require('../db');

router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'Subscription required' });

    await db.prepare(`
      INSERT OR REPLACE INTO push_subscriptions (user_id, subscription_json)
      VALUES (?, ?)
    `).run(req.userId, JSON.stringify(subscription));

    res.json({ success: true });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

router.delete('/subscribe', authMiddleware, async (req, res) => {
  try {
    await db.prepare(`
      DELETE FROM push_subscriptions WHERE user_id = ?
    `).run(req.userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

module.exports = router;
