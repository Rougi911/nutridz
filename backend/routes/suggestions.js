'use strict';
// S27 — GET /api/suggestions/deficiencies : aliments naturels & de saison pour combler
// les carences identifiées (réutilise la logique AL-07 de micronutrientsService).
const express = require('express');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { calcDeficiencies, STATUS_OK } = require('../services/micronutrientsService');
const { suggestSeasonalFoods } = require('../services/seasonalFoods');

const router = express.Router();

// REG-05 — non clinique, indicatif (fr/ar/en)
const DISCLAIMER = {
  fr: 'Suggestions indicatives d\'aliments naturels et de saison pour varier vos apports, basées sur votre journal des 14 derniers jours. Ne constitue pas un avis médical.',
  ar: 'اقتراحات استرشادية لأغذية طبيعية وموسمية لتنويع مدخولاتك، بناءً على سجلك لآخر 14 يومًا. لا يشكل نصيحة طبية.',
  en: 'Indicative suggestions of natural, in-season foods to diversify your intake, based on your last 14 days of logging. Not medical advice.',
};

// GET /api/suggestions/deficiencies (monté sur /api/suggestions)
router.get('/deficiencies', auth, async (req, res) => {
  try {
    const db = getDB();
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const sinceStr = since.toISOString().slice(0, 10);

    const countRow = await db.prepare(
      `SELECT COUNT(DISTINCT date) AS cnt FROM journal_entries WHERE user_id = ? AND date >= ?`
    ).get(req.userId, sinceStr);

    if (!countRow || countRow.cnt < 3) {
      return res.status(204).end(); // pas assez de données (cohérent avec /stats/deficiencies)
    }

    const entries = await db.prepare(`
      SELECT je.grams, je.date, p.name
      FROM journal_entries je
      LEFT JOIN products p ON je.product_id = p.id
      WHERE je.user_id = ? AND je.date >= ?
    `).all(req.userId, sinceStr);

    const profile = await db.prepare(
      `SELECT sexe, age, latitude_approx FROM profiles WHERE user_id = ?`
    ).get(req.userId);

    const month = new Date().getMonth() + 1;
    const deficiencies = calcDeficiencies(entries, countRow.cnt, profile, month);
    const deficient = deficiencies.filter((d) => d.status !== STATUS_OK);
    const suggestions = suggestSeasonalFoods(deficient, month);

    res.json({ month, period_days: 14, days_with_data: countRow.cnt, disclaimer: DISCLAIMER, suggestions });
  } catch (err) {
    console.error('[suggestions/deficiencies] error:', err.message);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
