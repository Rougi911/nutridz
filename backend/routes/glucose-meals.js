// P1-4 — GET /api/glucose-meals?date=YYYY-MM-DD
// Corrélation glycémie × repas : timeline du jour (défaut : aujourd'hui),
// delta post-prandial par repas, TIR du jour et détection de pattern sur 14 j.
// REG-04 : indicateur de tendance, ne remplace pas un avis médical (disclaimer).

const express = require('express');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { aggregateMeals, buildDayTimeline, detectPattern } = require('../services/glucoseMeals');

const router = express.Router();

const DISCLAIMER = {
  fr: 'Indicateur de tendance — ne remplace pas un avis médical.',
  en: 'Trend indicator — not a substitute for medical advice.',
  ar: 'مؤشر اتجاه — لا يغني عن استشارة طبية.',
};

router.get('/', auth, async (req, res) => {
  try {
    const db = getDB();
    const today = new Date().toISOString().slice(0, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : today;

    // Fenêtre 14 j (calculée en JS, cf. règle dates CLAUDE.md).
    const cutoffDate = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
    const cutoffIso = new Date(Date.now() - 13 * 86400000).toISOString();

    const [readings, meals, profile] = await Promise.all([
      db.prepare(
        'SELECT glucose_mg_dl, timestamp FROM glucose_readings WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp ASC'
      ).all(req.userId, cutoffIso),
      db.prepare(`
        SELECT je.date, je.meal_type, je.logged_at, je.kcal, je.glucides, p.name
        FROM journal_entries je
        JOIN products p ON je.product_id = p.id
        WHERE je.user_id = ? AND je.date >= ?
        ORDER BY je.logged_at ASC
      `).all(req.userId, cutoffDate),
      db.prepare(
        'SELECT glucose_target_min_mg_dl, glucose_target_max_mg_dl FROM profiles WHERE user_id = ?'
      ).get(req.userId),
    ]);

    const target = {
      low: (profile && profile.glucose_target_min_mg_dl) || 70,
      high: (profile && profile.glucose_target_max_mg_dl) || 180,
    };

    const mealsByDate = aggregateMeals(meals);
    const timeline = buildDayTimeline(date, readings, mealsByDate, target);
    const pattern = detectPattern(mealsByDate, readings);

    res.json({ date, timeline, pattern, disclaimer: DISCLAIMER });
  } catch (err) {
    console.error('[glucose-meals] échec:', err);
    res.status(500).json({ error: 'glucose-meals indisponible' });
  }
});

module.exports = router;
