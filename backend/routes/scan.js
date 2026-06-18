'use strict';
// SL-API-02 : POST /api/scan         — product scan + AL-08 score
// SL-API-03 : GET  /api/groceries/summary — AL-09 monthly/weekly grocery check
// P4.13 A3 : POST /api/scan/label    — photo étiquette → valeurs nutritionnelles
const express = require('express');
const axios   = require('axios');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { calcMonthlyAGSTarget } = require('../services/agsUtils');
const ADDITIVES = require('../data/additives.js');

const router = express.Router();
const OFF_BASE         = 'https://world.openfoodfacts.org/api/v0/product';
const GEMINI_API_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL     = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

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
  const mult = { sedentaire: 1.2, light: 1.375, modere: 1.55, intense: 1.725 };
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
      return res.status(404).json({ error: 'Produit non trouvé dans OpenFoodFacts', status: 'not_found' });
    }
    product = data.product;
  } catch (err) {
    console.error('[scan] OFF error:', err.response?.status, err.code);
    return res.status(502).json({ error: 'OpenFoodFacts indisponible' });
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

  const additives = additiveTags.map(tag => {
    const codeDisplay = tag.replace(/^[a-z]{2}:/, '').toUpperCase(); // "en:e150d" → "E150D"
    const codeNorm    = normalizeAdditive(tag);                       // → "E150d" for dict key
    const entry       = codeNorm
      ? (ADDITIVES.high_risk[codeNorm] || ADDITIVES.moderate_risk[codeNorm])
      : null;
    return { code: codeDisplay, name: entry?.name || codeDisplay };
  });

  res.json({ barcode, name, score, verdict, nutri_score: nutriScore, nova, additives_count: additiveTags.length, additives });
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

// ─── REG-05 : disclaimer tri-lingue pour sorties IA (scan/label) ─────────────
const DISCLAIMER_LABEL = {
  fr: 'Valeurs nutritionnelles extraites par IA à titre indicatif. Vérifiez l’étiquette du produit. Ces informations ne constituent pas un conseil médical.',
  ar: '\u0642\u064a\u0645 \u063a\u0630\u0627\u0626\u064a\u0629 \u0645\u0633\u062a\u062e\u0644\u0635\u0629 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0628\u0635\u0641\u0629 \u0627\u0633\u062a\u0631\u0634\u0627\u062f\u064a\u0629. \u0627\u0644\u0631\u062c\u0627\u0621 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0645\u0646\u062a\u062c. \u0644\u0627 \u062a\u0645\u062b\u0644 \u0646\u0635\u064a\u062d\u0629 \u0637\u0628\u064a\u0629.',
  en: 'Nutritional values extracted by AI for indicative purposes. Please verify on the product label. This does not constitute medical advice.',
};

// ─── POST /api/scan/label — photo étiquette → valeurs pour 100 g (A3) ────────

async function callGeminiLabel(base64Image, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY non défini');

  const prompt = `You are a nutritional label parser.
STRICTLY FORBIDDEN: Do not provide medical advice, diagnoses, prognoses, treatment recommendations, or drug interactions.
The image shows a product nutrition label. Extract the nutritional values per 100g (or per 100ml for liquids).
Return ONLY valid JSON — no markdown fences, no explanations:
{"product_name":string_or_null,"per_100g":{"kcal":number,"glucides":number,"dont_sucres":number,"proteines":number,"lipides":number,"dont_satures":number,"fibres":number,"sel":number},"serving_g":number_or_null,"confidence":0.0_to_1.0}
If a value is not visible, use null. All numbers in grams unless noted (kcal in kcal). "sel" in grams.`;

  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{
      parts: [
        { inlineData: { mimeType, data: base64Image } },
        { text: prompt },
      ],
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
  };

  const res = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
  });

  const raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /**/ }
    }
    throw new Error('JSON invalide dans la réponse Gemini Vision');
  }
}

router.post('/label', auth, async (req, res) => {
  const { image, mimeType = 'image/jpeg' } = req.body;

  // B-2: validate image field type + size
  if (typeof image !== 'string' || image.length === 0) {
    return res.status(422).json({ error: 'Champ image (base64) requis' });
  }
  if (image.length > 20 * 1024 * 1024) {
    return res.status(413).json({ error: 'Image trop volumineuse (limite 15 Mo)' });
  }

  // M-3: validate mimeType is a string before Set lookup
  const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  if (typeof mimeType !== 'string' || !SUPPORTED_TYPES.includes(mimeType)) {
    return res.status(422).json({ error: 'mimeType non supporté (jpeg|png|webp)' });
  }

  let result;
  try {
    result = await callGeminiLabel(image, mimeType);
  } catch (err) {
    const status = err.response?.status;
    console.error('[scan/label] Gemini error:', status, err.message);
    if (!status || status >= 500 || err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED') {
      return res.status(502).json({ error: 'Service IA temporairement indisponible' });
    }
    return res.status(422).json({ error: 'Impossible de lire l\'étiquette nutritionnelle' });
  }

  const per100      = result.per_100g || {};
  const confidence  = result.confidence ?? null;
  res.json({
    source:              'gemini_label',
    product_name:        result.product_name || null,
    per_100g: {
      kcal:           per100.kcal          ?? null,
      glucides:       per100.glucides      ?? null,
      dont_sucres:    per100.dont_sucres   ?? null,
      proteines:      per100.proteines     ?? null,
      lipides:        per100.lipides       ?? null,
      dont_satures:   per100.dont_satures  ?? null,
      fibres:         per100.fibres        ?? null,
      sel:            per100.sel           ?? null,
    },
    serving_g:           result.serving_g  || null,
    confidence,
    needs_confirmation:  confidence !== null && confidence < 0.7,
    disclaimer:          DISCLAIMER_LABEL,
  });
});

module.exports = router;
module.exports.calcProductScore   = calcProductScore;
module.exports.calcGrocerySummary = calcGrocerySummary;
module.exports.normalizeAdditive  = normalizeAdditive;
module.exports.callGeminiLabel    = callGeminiLabel;
