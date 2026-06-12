'use strict';
// SL-API-04 : GET /api/stats/deficiencies — AL-07 micronutrient deficiency check
const express = require('express');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { calcDeficiencies } = require('../services/micronutrientsService');

const router = express.Router();

// REG-04 — disclaimer non vide obligatoire dans chaque réponse
const DISCLAIMER = 'Estimation indicative basée sur votre journal alimentaire des 14 derniers jours. '
  + 'Ces informations ne constituent pas un diagnostic médical et ne remplacent pas l\'avis d\'un professionnel de santé.';

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
