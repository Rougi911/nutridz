// P1-5 — GET /api/health-score
// Score Santé hebdomadaire agrégé (adhérence, qualité additifs, micronutriments
// vs VNR, équilibre macros) + semaine précédente + historique 8 semaines + actions.
// Remplace l'heuristique 100 % client par un calcul serveur avec les vraies
// données produits (additifs EFSA) et micronutriments ANSES.

const express = require('express');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { computeHealthScore } = require('../services/healthScore');

const router = express.Router();

// Repris de routes/weight.js (BMR Harris-Benedict + facteurs) — cible calorique.
function computeProfileMetrics(p) {
  const levelFactor = { sed: 1.2, light: 1.375, mod: 1.55, actif: 1.725 };
  const paceDeficit = { doux: 250, modere: 500, rapide: 750 };
  const paceSurplus = { doux: 200, modere: 350, rapide: 500 };
  const bmr = p.sexe === 'h'
    ? 88.362 + 13.397 * p.weight + 4.799 * p.height - 5.677 * p.age
    : 447.593 + 9.247 * p.weight + 3.098 * p.height - 4.330 * p.age;
  const tdee = Math.round(bmr * (levelFactor[p.activity_level] || 1.375));
  let target = tdee;
  if (p.goal === 'perte') target = tdee - (paceDeficit[p.pace] || 500);
  else if (p.goal === 'prise') target = tdee + (paceSurplus[p.pace] || 350);
  return { tdee, target_kcal: target };
}

router.get('/', auth, async (req, res) => {
  try {
    const db = getDB();
    // 56 jours = 8 semaines d'historique (calculé en JS, cf. règle dates CLAUDE.md).
    const cutoff = new Date(Date.now() - 55 * 86400000).toISOString().slice(0, 10);

    const profile = await db.prepare(
      'SELECT age, weight, height, sexe, activity_level, goal, pace, latitude_approx FROM profiles WHERE user_id = ?'
    ).get(req.userId);

    const targetKcal = profile ? computeProfileMetrics(profile).target_kcal : 2000;

    const dailyAgg = await db.prepare(`
      SELECT date,
             COALESCE(SUM(kcal), 0)      AS kcal,
             COALESCE(SUM(glucides), 0)  AS carbs,
             COALESCE(SUM(proteines), 0) AS protein,
             COALESCE(SUM(lipides), 0)   AS fat
      FROM journal_entries
      WHERE user_id = ? AND date >= ?
      GROUP BY date
    `).all(req.userId, cutoff);

    const entries = await db.prepare(`
      SELECT je.date, je.grams, p.name, p.additifs
      FROM journal_entries je
      JOIN products p ON je.product_id = p.id
      WHERE je.user_id = ? AND je.date >= ?
    `).all(req.userId, cutoff);

    const result = computeHealthScore({
      dailyAgg: dailyAgg.map((r) => ({
        date: r.date,
        kcal: Number(r.kcal),
        carbs: Number(r.carbs),
        protein: Number(r.protein),
        fat: Number(r.fat),
      })),
      entries: entries.map((e) => ({ date: e.date, name: e.name, grams: Number(e.grams), additifs: e.additifs })),
      targetKcal,
      profile: profile ? { sexe: profile.sexe, age: profile.age, latitude_approx: profile.latitude_approx } : {},
    });

    res.json({ ...result, targetKcal });
  } catch (err) {
    console.error('[health-score] échec:', err);
    res.status(500).json({ error: 'health-score indisponible' });
  }
});

module.exports = router;
