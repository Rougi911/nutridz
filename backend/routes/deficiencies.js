'use strict';
// SL-API-04 : GET /api/stats/deficiencies — AL-07 micronutrient deficiency check
const express = require('express');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { calcDeficiencies } = require('../services/micronutrientsService');

const router = express.Router();

// REG-04/05 — disclaimer tri-lingue obligatoire dans chaque réponse (fr/ar/en)
const DISCLAIMER = {
  fr: 'Estimation indicative basée sur votre journal alimentaire des 14 derniers jours. Ces informations ne constituent pas un diagnostic médical et ne remplacent pas l\'avis d\'un professionnel de santé.',
  ar: '\u062a\u0642\u062f\u064a\u0631 \u0627\u0633\u062a\u0631\u0634\u0627\u062f\u064a \u0645\u0633\u062a\u0646\u062f \u0625\u0644\u0649 \u0633\u062c\u0644 \u0627\u0644\u062a\u063a\u0630\u064a\u0629 \u0644\u0622\u062e\u0631 14 \u064a\u0648\u0645\u0627\u064b. \u0644\u0627 \u064a\u0634\u0643\u0644 \u062a\u0634\u062e\u064a\u0635\u0627\u064b \u0637\u0628\u064a\u0627\u064b \u0648\u0644\u0627 \u064a\u063a\u0646\u064a \u0639\u0646 \u0627\u0633\u062a\u0634\u0627\u0631\u0629 \u0645\u062a\u062e\u0635\u0635.',
  en: 'Indicative estimate based on your food journal for the last 14 days. Does not constitute a medical diagnosis and does not replace the advice of a healthcare professional.',
};

// GET /api/stats/deficiencies (mounted at /api/stats)
router.get('/deficiencies', auth, async (req, res) => {
  const db = getDB();

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const sinceStr = since.toISOString().slice(0, 10);

  // Check minimum data (>= 3 distinct days)
  const countRow = await db.prepare(
    `SELECT COUNT(DISTINCT date) AS cnt FROM journal_entries WHERE user_id = ? AND date >= ?`
  ).get(req.userId, sinceStr);

  if (!countRow || countRow.cnt < 3) {
    return res.status(204).end();
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

  // REG-04: disclaimer always present; REG-05: no clinical terms (status labels checked in service)
  res.json({
    period_days: 14,
    days_with_data: countRow.cnt,
    disclaimer: DISCLAIMER,
    deficiencies,
  });
});

module.exports = router;
