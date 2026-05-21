const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const favorites = await db.prepare(`
      SELECT f.dish_id, f.created_at,
             d.name, d.name_fr, d.name_ar, d.name_en,
             d.cuisine, d.emoji, d.kcal_per_portion as kcal
      FROM favorites f
      JOIN dishes d ON f.dish_id = d.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `).all(req.userId);
    res.json(favorites);
  } catch (error) {
    console.error('Favorites fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { dish_id } = req.body;
    await db.prepare(
      'INSERT OR IGNORE INTO favorites (user_id, dish_id) VALUES (?, ?)'
    ).run(req.userId, dish_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

router.delete('/:dish_id', authMiddleware, async (req, res) => {
  try {
    await db.prepare(
      'DELETE FROM favorites WHERE user_id = ? AND dish_id = ?'
    ).run(req.userId, req.params.dish_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

module.exports = router;
