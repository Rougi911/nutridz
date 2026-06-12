'use strict';
// SL-API-02 : POST /api/scan  — product scan + AL-08 score
// SL-API-03 : GET  /api/groceries/summary — AL-09 monthly/weekly grocery check
const express = require('express');
const axios   = require('axios');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { calcMonthlyAGSTarget } = require('../services/agsUtils');
const ADDITIVES = require('../data/additives.json');

const router = express.Router();
const OFF_BASE = 'https://world.openfoodfacts.org/api/v0/product';

// ─── AL-08 helpers ──────────────────────────────────────────────────────────

function normalizeAdditive(tag) {
  const m = String(tag).match(/[eE](\d{3,4}[a-zA-Z]?)$/);
  return m ? `E${m[1].toLowerCase()}` : null;
}

function calcProductScore(nutriScore, additiveTags) {
  const BASE = { a: 90, b: 75, c: 55, d: 35, e: 15 };
  let score = BASE[(nutriScore || '').toLowerCase()] ?? 50;

  for (const tag of (additiveTags || [])) {
    const code = normalizeAdditive(tag);
    if (!code) continue;
    if (ADDITIVES.high_risk[code])     score -= 30;
    else if (ADDITIVES.moderate_risk[code]) score -= 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreToVerdict(score) {
  if (score >= 65) return 'Excellent';
  if (score >= 35) return 'Médiocre';
  return 'Mauvais';
}

// ─── TDEE calculation (Mifflin-St Jeor) ─────────────────────────────────────

function calcTDEE(profile) {
  const weight = profile.weight   || 70;
  const height = profile.height   || 170;
  const age    = profile.age      || 30;
  const sexe   = (profile.sexe    || 'h').toLowerCase();
  const level  = profile.activity_level || 'light';
  const bmr = sexe === 'f'
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;
  const mult = { sédentaire: 1.2, light: 1.375, modéré: 1.55, intense: 1.725 };
  return Math.round(bmr * (mult[level] || 1.375));
}

// ─── AL-09 pure calculation (exported for tests) ────────────────────────────

function calcGrocerySummary(rows, periodDays, tdee) {
  let totalSugars = 0, totalSalt = 0, totalSatFat = 0;
  for (const r of rows) {
    const n = r.times_this_month || 1;
    totalSugars += (r.sugars_g  || 0) * n;
    totalSalt   += (r.salt_g    || 0) * n;
    totalSatFat += (r.sat_fat_g || 0) * n;
  }

  const refSugars = 50 * periodDays;
  const refSalt   = 5  * periodDays;
  const agsResult = calcMonthlyAGSTarget({ tdee });
  // scale monthly AGS target to period
  const refAGS    = agsResult.target_g * (periodDays / 30);

  const pctSugars = refSugars > 0 ? Math.round((totalSugars / refSugars) * 100) : 0;
  const pctSalt   = refSalt   > 0 ? Math.round((totalSalt   / refSalt)   * 100) : 0;
  const pctAGS    = refAGS    > 0 ? Math.round((totalSatFat / refAGS)    * 100) : 0;

  function color(pct) {
    if (pct <= 80)  return 'teal';
    if (pct <= 110) return 'amber';
    return 'red';
  }

  const riskAdditives = [];
  const seen = new Set();
  for (const r of rows) {
    try {
      const tags = JSON.parse(r.additives_json || '[]');
      for (const tag of tags) {
        const code = normalizeAdditive(tag);
        if (!code || seen.has(code)) continue;
        if (ADDITIVES.high_risk[code]) {
          seen.add(code);
          riskAdditives.push({ code, name: ADDITIVES.high_risk[code].name, risk: 'high' });
        } else if (ADDITIVES.moderate_risk[code]) {
          seen.add(code);
          riskAdditives.push({ code, name: ADDITIVES.moderate_risk[code].name, risk: 'moderate' });
        }
      }
    } catch (_) { /* malformed json ignored */ }
  }

  return {
    sugars:  { total_g: Math.round(totalSugars * 10) / 10, reference_g: refSugars, pct: pctSugars, color: color(pctSugars) },
    salt:    { total_g: Math.round(totalSalt   * 10) / 10, reference_g: refSalt,   pct: pctSalt,   color: color(pctSalt)   },
    sat_fat: { total_g: Math.round(totalSatFat * 10) / 10, reference_g: Math.round(refAGS * 10) / 10, pct: pctAGS, color: color(pctAGS) },
    ags_oms_source: agsResult.default_used ? 'fallback_2000' : 'profile_tdee',
    risk_additives: riskAdditives,
  };
}

// ─── POST /api/scan ──────────────────────────────────────────────────────────

router.post('/', auth, async (req, res) => {
  const { barcode } = req.body;
  if (!barcode || !/^\d{4,14}$/.test(String(barcode))) {
    return res.status(400).json({ error: 'Code-barres invalide (4–14 chiffres requis)' });
  }

  let product;
  try {
    const { data } = await axios.get(`${OFF_BASE}/${barcode}.json`, { timeout: 10000 });
    if (!data.status || !data.product) {
      return res.status(404).json({ error: 'Produit non trouvé dans OpenFoodFacts' });
    }
    product = data.product;
  } catch (err) {
    return res.status(502).json({ error: 'OpenFoodFacts indisponible', details: err.message });
  }

  const name        = product.product_name || product.product_name_fr || 'Produit inconnu';
  const nutriScore  = product.nutriscore_grade || null;
  const nova        = product.nova_group || null;
  const additiveTags = (product.additives_tags || []);
  const nut         = product.nutriments || {};

  const sugars  = parseFloat(nut['sugars_100g']        || 0);
  const salt    = parseFloat(nut['salt_100g']          || 0);
  const satFat  = parseFloat(nut['saturated-fat_100g'] || 0);

  const score   = calcProductScore(nutriScore, additiveTags);
  const verdict = scoreToVerdict(score);

  const db = getDB();
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM

  // COR-09: application-level upsert — no SQL UNIQUE constraint
  const existing = await db.prepare(
    `SELECT id, times_this_month FROM scanned_products WHERE user_id = ? AND barcode = ? AND strftime('%Y-%m', scanned_at) = ?`
  ).get(req.userId, String(barcode), month);

  if (existing) {
    await db.prepare(
      `UPDATE scanned_products SET times_this_month = ?, scanned_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(existing.times_this_month + 1, existing.id);
  } else {
    await db.prepare(`
      INSERT INTO scanned_products (user_id, barcode, product_name, score, verdict, additives_json, nutri_score, nova, sugars_g, salt_g, sat_fat_g)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.userId, String(barcode), name, score, verdict, JSON.stringify(additiveTags), nutriScore, nova, sugars, salt, satFat);
  }

  res.json({ barcode, name, score, verdict, nutri_score: nutriScore, nova, additives_count: additiveTags.length });
});

// ─── GET /api/groceries/summary ─────────────────────────────────────────────

router.get('/summary', auth, async (req, res) => {
  const period = (req.query.period || 'month') === 'week' ? 'week' : 'month';
  const periodDays = period === 'week' ? 7 : 30;
  const db = getDB();

  const filter = period === 'week'
    ? `date(scanned_at) >= date('now', '-7 days')`
    : `strftime('%Y-%m', scanned_at) = strftime('%Y-%m', 'now')`;

  const rows = await db.prepare(
    `SELECT sugars_g, salt_g, sat_fat_g, times_this_month, additives_json FROM scanned_products WHERE user_id = ? AND ${filter}`
  ).all(req.userId);

  const profile = await db.prepare(
    `SELECT weight, height, age, sexe, activity_level FROM profiles WHERE user_id = ?`
  ).get(req.userId);

  const tdee = profile ? calcTDEE(profile) : 2000;

  const summary = calcGrocerySummary(rows, periodDays, tdee);
  const year    = new Date().getFullYear();
  const month   = new Date().getMonth() + 1;

  res.json({ period, year, month, products_scanned: rows.length, ...summary });
});

module.exports = router;
module.exports.calcProductScore  = calcProductScore;
module.exports.calcGrocerySummary = calcGrocerySummary;
module.exports.normalizeAdditive  = normalizeAdditive;
