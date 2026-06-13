const express = require('express');
const axios   = require('axios');
const auth    = require('../middleware/auth');
const { searchByName } = require('../services/ciqual');
const { searchFood: usdaSearch } = require('../services/usda');
const { callGemini } = require('../services/foodvision');

const router = express.Router();

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL    = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

const SUPPORTED_LANGS = ['fr', 'ar', 'en'];
const CONF_THRESHOLD  = 0.6;

// ─── Gemini text call ─────────────────────────────────────────────────────────
async function callGeminiText(text, lang = 'fr') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY non défini');

  const langLabel = lang === 'ar' ? 'Arabic' : lang === 'en' ? 'English' : 'French';
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const systemPrompt = `You are a nutrition log parser. Parse the following ${langLabel} text and extract food items, weight measurements, and glucose readings.
STRICTLY FORBIDDEN: Do not provide medical advice, diagnoses, prognoses, treatment recommendations, or drug interactions.
Return ONLY valid JSON — no markdown fences, no explanations. Schema:
{
  "intents": [
    {
      "type": "food|weight|glucose",
      "name": "standardized name in French",
      "quantity_g": number or null,
      "weight_kg": number or null,
      "glucose_mg_dl": number or null,
      "meal_type": "petit_dejeuner|dejeuner|diner|collation" or null,
      "confidence": 0.0 to 1.0
    }
  ]
}`;

  const body = {
    contents: [{ parts: [{ text: `${systemPrompt}\n\nText to parse: "${text}"` }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
  };

  const res = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
  });

  const raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{"intents":[]}';
  return parseGeminiJSON(raw);
}

// ─── Defensive JSON parser ────────────────────────────────────────────────────
function parseGeminiJSON(raw) {
  const cleaned = (raw || '')
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract first JSON object/array
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) return JSON.parse(match[0]);
    throw new Error('JSON invalide dans la réponse Gemini');
  }
}

// ─── Photo → intents ──────────────────────────────────────────────────────────
async function parsePhotoToIntents(base64Image, mimeType = 'image/jpeg', lang = 'fr') {
  // CIQUAL searches alim_nom_fr / alim_nom_en — Arabic names won't match; use fr instead
  const visionLang = lang === 'ar' ? 'fr' : lang;
  const concepts = await callGemini(base64Image, mimeType, visionLang);
  return concepts
    .filter(c => c.value >= 0.3)
    .map(c => ({
      type: 'food',
      name: c.name,
      quantity_g: null,
      meal_type: null,
      confidence: c.value,
    }));
}

// ─── Text/voice → intents ─────────────────────────────────────────────────────
async function parseTextToIntents(text, lang = 'fr') {
  const parsed = await callGeminiText(text, lang);
  const intents = Array.isArray(parsed?.intents) ? parsed.intents : [];
  return intents.map(i => ({
    type: i.type || 'food',
    name: i.name || '',
    quantity_g:    i.quantity_g    ?? null,
    weight_kg:     i.weight_kg     ?? null,
    glucose_mg_dl: i.glucose_mg_dl ?? null,
    meal_type:     i.meal_type     ?? null,
    confidence:    typeof i.confidence === 'number' ? i.confidence : 0.5,
  }));
}

// ─── Nutrition cascade CIQUAL → USDA avec mise à l'échelle portion ───────────
async function resolveNutrition(foodName, quantity_g) {
  if (!foodName) return null;
  const portion = (Number.isFinite(quantity_g) && quantity_g > 0) ? quantity_g : 100;
  const estimated_portion = !(Number.isFinite(quantity_g) && quantity_g > 0);

  function scale(per100) {
    const s = portion / 100;
    return {
      kcal:      Math.round(per100.kcal      * s),
      glucides:  Math.round(per100.glucides  * s * 10) / 10,
      proteines: Math.round(per100.proteines * s * 10) / 10,
      lipides:   Math.round(per100.lipides   * s * 10) / 10,
      fibres:    Math.round(per100.fibres    * s * 10) / 10,
      sel:       Math.round((per100.sel || 0) * s * 100) / 100,
    };
  }

  // 1. CIQUAL
  const ciqualResults = searchByName(foodName, 1);
  if (ciqualResults.length) {
    const r = ciqualResults[0];
    return { ...scale(r), source: 'ciqual', quantity_g: portion, estimated_portion };
  }

  // 2. USDA — ranked Foundation/SR Legacy first (BUG-1 fix)
  try {
    const usdaResults = await usdaSearch(foodName, 10);
    if (usdaResults.length) {
      const r = usdaResults[0];
      return { ...scale(r), source: 'usda', quantity_g: portion, estimated_portion };
    }
  } catch (_) {}

  return null; // nutrition_found: false — never fall back to LLM values
}

// ─── POST /api/interpret ──────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  const { mode, payload, lang = 'fr', mimeType } = req.body;

  if (!['photo', 'voice', 'text'].includes(mode)) {
    return res.status(422).json({ error: 'mode invalide : valeurs acceptées photo|voice|text' });
  }
  if (!payload) {
    return res.status(422).json({ error: 'payload requis' });
  }
  const validLang = SUPPORTED_LANGS.includes(lang) ? lang : 'fr';

  let rawIntents;
  try {
    if (mode === 'photo') {
      rawIntents = await parsePhotoToIntents(payload, mimeType || 'image/jpeg', validLang);
    } else {
      rawIntents = await parseTextToIntents(payload, validLang);
    }
  } catch (err) {
    const status = err.response?.status;
    console.error('[interpret] Gemini error:', status, err.message);
    if (!status || status >= 500 || err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED') {
      return res.status(502).json({ error: 'Service IA temporairement indisponible' });
    }
    return res.status(422).json({ error: 'Impossible de parser le contenu fourni' });
  }

  // Resolve nutrition for food intents (cascade CIQUAL → USDA, never LLM)
  const intents = await Promise.all(rawIntents.map(async (intent) => {
    const base = {
      ...intent,
      needs_confirmation: intent.confidence < CONF_THRESHOLD,
    };
    if (intent.type !== 'food') return base;

    const nutrition = await resolveNutrition(intent.name, intent.quantity_g).catch(() => null);
    return {
      ...base,
      nutrition: nutrition || null,
      nutrition_found: !!nutrition,
    };
  }));

  res.json({ intents });
});

module.exports = router;
module.exports.resolveNutrition = resolveNutrition;
