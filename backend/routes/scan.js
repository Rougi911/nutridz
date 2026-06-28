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
const { classifyAdditive } = require('../services/additiveClassify'); // DEF-7
const { resolveAdditiveName } = require('../services/additiveResolver');
const { computeNutriScoreGrade, detectBeverage, detectSweeteners, detectRedMeat } = require('../services/nutriScore');
const { buildComposition } = require('../services/compositionParser');
const offCache = require('../services/offCache');

const router = express.Router();
const OFF_BASE         = 'https://world.openfoodfacts.org/api/v0/product';
// P1-8 : ne demander à OFF que les champs utiles (payload ÷10, parsing plus rapide).
// categories_tags est requis pour la détection boisson/eau (P1-7).
const OFF_FIELDS = [
  'product_name', 'product_name_fr', 'nutriscore_grade', 'nova_group',
  'additives_tags', 'categories_tags', 'image_front_small_url',
  'image_front_url', 'image_url', 'nutriments',
].join(',');

// P1-8 : récupération OFF avec cache mémoire (clé = barcode) + repli sur entrée périmée.
// Retourne le produit, `null` si OFF déclare le produit introuvable, lève si réseau KO sans cache.
async function fetchOffProduct(barcode) {
  const fresh = await offCache.getFresh(barcode);
  if (fresh) return fresh;
  try {
    const { data } = await axios.get(`${OFF_BASE}/${barcode}.json?fields=${OFF_FIELDS}`, { timeout: 10000 });
    if (!data.status || !data.product) return null;
    offCache.set(barcode, data.product);
    return data.product;
  } catch (err) {
    const stale = await offCache.getStale(barcode); // OFF indisponible → on sert le cache même périmé
    if (stale) return stale;
    throw err;
  }
}
const GEMINI_API_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL     = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

// ─── AL-08 helpers ──────────────────────────────────────────────────────────

// S10b : regex élargie à 0-3 lettres pour couvrir E500ii, E500iii, etc.
function normalizeAdditive(tag) {
  const m = String(tag).match(/[eE](\d{3,4}[a-z]{0,3})$/i);
  return m ? `E${m[1].toLowerCase()}` : null;
}

const NUTRISCORE_BASE = { a: 90, b: 75, c: 55, d: 35, e: 15 };

// P1-7 : plus de fallback `?? 50`. Grade inconnu → null (laissé "non noté" en amont).
function calcProductScore(nutriScore, additiveTags) {
  const base = NUTRISCORE_BASE[(nutriScore || '').toLowerCase()];
  if (base === undefined) return null;
  let score = base;

  for (const tag of (additiveTags || [])) {
    const code = normalizeAdditive(tag);
    if (!code) continue;
    const r = classifyAdditive(code)?.risk; // DEF-7 : sous-variantes héritent du parent
    if (r === 'high')          score -= 30;
    else if (r === 'moderate') score -= 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreToVerdict(score) {
  if (score === null || score === undefined) return null; // non noté
  if (score >= 65) return 'Excellent';
  if (score >= 35) return 'Médiocre';
  return 'Mauvais';
}

/**
 * P1-7 — Résolution complète du score produit avec source.
 * Priorité : grade OFF → grade recalculé (Nutri-Score officiel) → non noté.
 * @returns {{score:number|null, grade:string|null, verdict:string|null, source:'nutriscore_off'|'nutriscore_calcule'|'non_note'}}
 */
function resolveProductScore({ nutriScore, additiveTags, nutriments, categoriesTags, name }) {
  let grade = (nutriScore || '').toLowerCase();
  let source;

  if (NUTRISCORE_BASE[grade] !== undefined) {
    source = 'nutriscore_off';
  } else {
    // Repli : recalcul Nutri-Score 2023 (P1-7c) à partir des nutriments.
    const { isBeverage, isWater } = detectBeverage(categoriesTags, name);
    const hasSweeteners = detectSweeteners(additiveTags);
    const isRedMeat = detectRedMeat(categoriesTags);
    grade = computeNutriScoreGrade(nutriments, { isBeverage, isWater, hasSweeteners, isRedMeat });
    if (!grade) return { score: null, grade: null, verdict: null, source: 'non_note' };
    source = 'nutriscore_calcule';
  }

  const score = calcProductScore(grade, additiveTags);
  return { score, grade, verdict: scoreToVerdict(score), source };
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
        const cl = classifyAdditive(code); // DEF-7 : sous-variantes héritent du parent
        if (cl?.risk === 'high') {
          seen.add(code);
          riskAdditives.push({ code, name: cl.name, risk: 'high' });
        } else if (cl?.risk === 'moderate') {
          seen.add(code);
          riskAdditives.push({ code, name: cl.name, risk: 'moderate' });
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

// P1-8 — Upsert applicatif du scan (par utilisateur, par mois). Appelé en tâche de fond.
async function persistScan({ userId, barcode, name, score, verdict, additiveTags, nutriScore, nova, sugars, salt, satFat, imageUrl, source }) {
  const db = getDB();
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  // S7b : upsert atomique par (user, barcode, mois) via index unique scan_month
  // (remplace l'upsert applicatif racy + le strftime SQLite-only).
  await db.prepare(`
    INSERT INTO scanned_products
      (user_id, barcode, product_name, score, verdict, additives_json, nutri_score, nova,
       sugars_g, salt_g, sat_fat_g, image_url, nutriscore_source, scan_month, times_this_month, scanned_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, now())
    ON CONFLICT (user_id, barcode, scan_month) DO UPDATE SET
      times_this_month = scanned_products.times_this_month + 1,
      scanned_at = now()
  `).run(userId, barcode, name, score, verdict, JSON.stringify(additiveTags), nutriScore, nova, sugars, salt, satFat, imageUrl, source, month);
}

// ─── POST /api/scan ──────────────────────────────────────────────────────────

router.post('/', auth, async (req, res) => {
  const { barcode } = req.body;
  if (!barcode || !/^\d{4,14}$/.test(String(barcode))) {
    return res.status(400).json({ error: 'Code-barres invalide (4–14 chiffres requis)' });
  }

  let product;
  try {
    product = await fetchOffProduct(barcode);
  } catch (err) {
    console.error('[scan] OFF error:', err.response?.status, err.code);
    return res.status(502).json({ error: 'OpenFoodFacts indisponible' });
  }
  if (!product) {
    return res.status(404).json({ error: 'Produit non trouvé dans OpenFoodFacts', status: 'not_found' });
  }

  const name        = product.product_name || product.product_name_fr || 'Produit inconnu';
  const nutriScore  = product.nutriscore_grade || null;
  const nova        = product.nova_group || null;
  const additiveTags = (product.additives_tags || []);
  const imageUrl    = product.image_front_small_url || product.image_front_url || product.image_url || null;
  const nut         = product.nutriments || {};

  const sugars  = parseFloat(nut['sugars_100g']        || 0);
  const salt    = parseFloat(nut['salt_100g']          || 0);
  const satFat  = parseFloat(nut['saturated-fat_100g'] || 0);

  // P1-7 : grade OFF → grade recalculé (Nutri-Score officiel) → "non noté" (jamais 50/unknown)
  const { score, verdict, grade, source } = resolveProductScore({
    nutriScore,
    additiveTags,
    nutriments: nut,
    categoriesTags: product.categories_tags,
    name,
  });

  const additives = additiveTags.map(tag => {
    const codeDisplay = tag.replace(/^[a-z]{2}:/, '').toUpperCase(); // "en:e150d" → "E150D"
    const codeNorm    = normalizeAdditive(tag);                       // → "E150d" for dict key
    const classif     = codeNorm ? classifyAdditive(codeNorm) : null; // DEF-7 : repli parent
    const risk        = classif ? classif.risk : 'unknown'; // S10b : toujours 'unknown', jamais null
    const name        = codeNorm ? resolveAdditiveName(codeNorm) : codeDisplay;
    return { code: codeDisplay, name, risk };
  });

  res.json({
    barcode, name, score, verdict,
    nutri_score: nutriScore,              // grade OFF brut (null si absent) — rétro-compat
    nutriscore_grade: grade,              // grade effectif (OFF ou recalculé)
    nutriscore_source: source,            // nutriscore_off | nutriscore_calcule | non_note
    nova,
    additives_count: additiveTags.length, additives, image_url: imageUrl,
  });

  // P1-8 : persistance en tâche de fond — la réponse est déjà partie, on ne bloque pas
  // sur les requêtes SQLite. Une erreur d'écriture est loguée sans casser la réponse.
  // "Non noté" (score null) non persisté : score est NOT NULL en base.
  if (score !== null) {
    persistScan({
      userId: req.userId, barcode: String(barcode), name, score, verdict,
      additiveTags, nutriScore, nova, sugars, salt, satFat, imageUrl, source,
    }).catch(err => console.error('[scan] persist error:', err.message));
  }
});

// ─── GET /api/groceries/summary ─────────────────────────────────────────────

router.get('/summary', auth, async (req, res) => {
  const period = (req.query.period || 'month') === 'week' ? 'week' : 'month';
  const periodDays = period === 'week' ? 7 : 30;
  const db = getDB();

  // S7c : filtres date portés en Postgres. Mois courant via la colonne indexée scan_month.
  const rows = period === 'week'
    ? await db.prepare(
        `SELECT sugars_g, salt_g, sat_fat_g, times_this_month, additives_json FROM scanned_products
         WHERE user_id = ? AND scanned_at::date >= (now() - interval '7 days')::date`
      ).all(req.userId)
    : await db.prepare(
        `SELECT sugars_g, salt_g, sat_fat_g, times_this_month, additives_json FROM scanned_products
         WHERE user_id = ? AND scan_month = ?`
      ).all(req.userId, new Date().toISOString().slice(0, 7));

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
The image shows a product nutrition label and ingredient list. Extract the nutritional values per 100g (or per 100ml for liquids), the ingredient list, and any additives.
Return ONLY valid JSON — no markdown fences, no explanations:
{"product_name":string_or_null,"per_100g":{"kcal":number,"glucides":number,"dont_sucres":number,"proteines":number,"lipides":number,"dont_satures":number,"fibres":number,"sel":number},"ingredients_text":string_or_null,"additives":[string],"serving_g":number_or_null,"confidence":0.0_to_1.0}
"ingredients_text": the ingredient list exactly as written. "additives": E-codes or additive names found. If a value is not visible, use null (do not invent). All numbers in grams unless noted (kcal in kcal). "sel" in grams.`;

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

// ─── POST /api/scan/composition — photo étiquette → nutriments + additifs (S5) ─
// Mêmes validations que /label. Le JSON brut Gemini est durci par buildComposition.
router.post('/composition', auth, async (req, res) => {
  const { image, mimeType = 'image/jpeg' } = req.body;

  if (typeof image !== 'string' || image.length === 0) {
    return res.status(422).json({ error: 'Champ image (base64) requis' });
  }
  if (image.length > 20 * 1024 * 1024) {
    return res.status(413).json({ error: 'Image trop volumineuse (limite 15 Mo)' });
  }
  const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  if (typeof mimeType !== 'string' || !SUPPORTED_TYPES.includes(mimeType)) {
    return res.status(422).json({ error: 'mimeType non supporté (jpeg|png|webp)' });
  }

  let raw;
  try {
    raw = await callGeminiLabel(image, mimeType);
  } catch (err) {
    const status = err.response?.status;
    console.error('[scan/composition] Gemini error:', status, err.message);
    if (!status || status >= 500 || err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED') {
      return res.status(502).json({ error: 'Service IA temporairement indisponible' });
    }
    return res.status(422).json({ error: 'Impossible de lire l\'étiquette nutritionnelle' });
  }

  const comp = buildComposition(raw); // parser durci (S5)
  res.json({
    source:             'gemini_label',
    product_name:       comp.product_name,
    per_100g:           comp.per_100g,
    additives:          comp.additives,         // [{code,name,risk}]
    serving_g:          raw.serving_g || null,
    confidence:         comp.confidence,
    needs_confirmation: comp.needs_confirmation,
    warnings:           comp.warnings,
    disclaimer:         DISCLAIMER_LABEL,
  });
});

module.exports = router;
module.exports.buildComposition   = buildComposition;
module.exports.calcProductScore   = calcProductScore;
module.exports.resolveProductScore = resolveProductScore;
module.exports.scoreToVerdict     = scoreToVerdict;
module.exports.calcGrocerySummary = calcGrocerySummary;
module.exports.normalizeAdditive  = normalizeAdditive;
module.exports.callGeminiLabel    = callGeminiLabel;
