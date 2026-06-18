'use strict';
// SL-API-05 : GET /api/stats/additives — AL-S4 exposition additifs par période
const express = require('express');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { ADDITIVES_CLASSIFICATION } = require('../data/additives');

const router = express.Router();

// REG-05 — disclaimer tri-lingue, vocabulaire non clinique, pas de dose
const DISCLAIMER = {
  fr: 'Comptage d\'expositions (portions contenant l\'additif) basé sur votre journal alimentaire. Aucune dose (mg) n\'est calculée. La fiabilité dépend de la rigueur de saisie. Ces informations ne constituent pas un avis médical.',
  ar: 'عد التعرضات (الحصص التي تحتوي على المضاف الغذائي) بناءً على سجل تغذيتك. لا تُحسب أي جرعة (ملغ). الموثوقية تعتمد على دقة الإدخال. لا تُشكّل هذه المعلومات نصيحة طبية.',
  en: 'Exposure count (servings containing the additive) based on your food journal. No dose (mg) is calculated. Reliability depends on logging accuracy. This does not constitute medical advice.',
};

const VALID_DAYS = new Set([1, 7, 30, 365]);

// Normalise un tag additif vers la clé de ADDITIVES_CLASSIFICATION.
// Gère les formats : OFF "en:e150d", display "E150D", clé directe "E150d".
function normalizeCode(tag) {
  const m = String(tag).match(/[eE](\d{3,4}[a-zA-Z]?)$/);
  return m ? `E${m[1].toLowerCase()}` : null;
}

// Pure function — testable sans DB
function calcAdditivesStats(entries) {
  const counts = { high: 0, moderate: 0, low: 0 };
  const itemMap = {};
  let entriesWithAdditives = 0;

  for (const entry of entries) {
    let tags = [];
    try { tags = JSON.parse(entry.additifs || '[]'); } catch (_) {}
    if (!Array.isArray(tags) || tags.length === 0) continue;

    entriesWithAdditives++;

    for (const tag of tags) {
      const code = normalizeCode(tag);
      if (!code) continue;
      const classif = ADDITIVES_CLASSIFICATION[code];
      if (!classif) continue; // code inconnu → ignoré

      counts[classif.risk]++;

      if (!itemMap[code]) {
        itemMap[code] = {
          code: code.toUpperCase(), // "E150d" → "E150D" pour affichage
          name: classif.name,
          risk: classif.risk,
          count: 0,
        };
      }
      itemMap[code].count++;
    }
  }

  const riskOrder = { high: 0, moderate: 1, low: 2 };
  const items = Object.values(itemMap).sort((a, b) => {
    const rd = riskOrder[a.risk] - riskOrder[b.risk];
    return rd !== 0 ? rd : b.count - a.count;
  });

  return {
    entries_with_additives: entriesWithAdditives,
    total_entries: entries.length,
    counts,
    items,
  };
}

// GET /api/stats/additives?days=N (N ∈ {1, 7, 30, 365}, défaut 7)
router.get('/additives', auth, async (req, res) => {
  const rawDays = parseInt(req.query.days, 10);
  const days = VALID_DAYS.has(rawDays) ? rawDays : 7;

  // Fenêtre [aujourd'hui-(days-1) ; aujourd'hui] → days jours inclusifs
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = since.toISOString().slice(0, 10); // YYYY-MM-DD

  const db = getDB();
  const entries = await db.prepare(`
    SELECT je.id, p.additifs
    FROM journal_entries je
    JOIN products p ON je.product_id = p.id
    WHERE je.user_id = ? AND je.date >= ?
  `).all(req.userId, sinceStr);

  const stats = calcAdditivesStats(entries);

  res.json({
    days,
    ...stats,
    disclaimer: DISCLAIMER,
  });
});

module.exports = router;
module.exports.calcAdditivesStats = calcAdditivesStats;
