'use strict';
const express = require('express');
const axios   = require('axios');
const auth    = require('../middleware/auth');
const { searchByName, normalize: ciqualNormalize } = require('../services/ciqual');
const { searchFood: usdaSearch } = require('../services/usda');
const { callGemini } = require('../services/foodvision');

const router = express.Router();

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL    = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

const SUPPORTED_LANGS  = ['fr', 'ar', 'en'];
const CONF_THRESHOLD   = 0.6;
const VALID_MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

// REG-05 — disclaimer tri-lingue obligatoire sur toute sortie IA données de santé
const DISCLAIMER_REG05 = {
  fr: 'Estimation indicative fournie par IA. Ces informations ne constituent pas un conseil médical, un diagnostic ou une prescription. Consultez un professionnel de santé.',
  ar: '\u062a\u0642\u062f\u064a\u0631 \u0627\u0633\u062a\u0631\u0634\u0627\u062f\u064a \u0645\u0642\u062f\u0645 \u0645\u0646 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a. \u0644\u0627 \u064a\u0639\u062f \u0646\u0635\u064a\u062d\u0629 \u0637\u0628\u064a\u0629. \u0627\u0633\u062a\u0634\u0631 \u0645\u062a\u062e\u0635\u0635\u0627\u064b \u0641\u064a \u0627\u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u0635\u062d\u064a\u0629.',
  en: 'Indicative estimate provided by AI. This information does not constitute medical advice, a diagnosis, or a prescription. Consult a healthcare professional.',
};

// ─── Termes génériques alimentaires (PROB-3) ──────────────────────────────────
const GENERIC_FOOD_TERMS = new Set([
  'fruit', 'fruits', 'legume', 'legumes', 'viande', 'viandes',
  'poisson', 'plat', 'aliment', 'aliments', 'nourriture', 'repas',
  'mets', 'produit', 'produits', 'boisson', 'boissons',
  'cereale', 'cereales', 'feculent', 'feculents',
  'food', 'foods', 'vegetable', 'vegetables', 'meat', 'meats',
  'dish', 'meal', 'beverage', 'beverages', 'item',
]);

function isGenericFoodTerm(name) {
  if (!name) return false;
  const words = ciqualNormalize(name).split(' ').filter(w => w.length > 0);
  return words.length > 0 && words.every(w => GENERIC_FOOD_TERMS.has(w));
}

// ─── Table de portions par défaut (PROB-2 repli) ─────────────────────────────
const DEFAULT_PORTION_RULES = [
  { re: /\b(pomme|poire|peche|abricot|prune|nectarine|figue|grenade)\b/,    g: 150 },
  { re: /\b(banane|mangue|kiwi|orange|citron|pamplemousse|ananas)\b/,        g: 150 },
  { re: /\b(fraise|fraises|raisin|cerise|cerises|myrtille|myrtilles)\b/,     g: 80  },
  { re: /\b(tomate|carotte|courgette|poivron|concombre|aubergine|brocoli)\b/, g: 100 },
  { re: /\b(salade|epinard|chou|haricot|laitue)\b/,                           g: 80  },
  { re: /\b(riz|pates|couscous|quinoa|semoule|boulgour)\b/,                   g: 150 },
  { re: /\b(pain|baguette|tartine|toast)\b/,                                  g: 50  },
  { re: /\b(poulet|boeuf|veau|agneau|porc|dinde|lapin)\b/,                   g: 120 },
  { re: /\b(saumon|thon|cabillaud|sardine|crevette)\b/,                       g: 120 },
  { re: /\b(oeuf|oeufs)\b/,                                                   g: 55  },
  { re: /\b(fromage|brie|camembert|gruyere|emmental)\b/,                      g: 30  },
  { re: /\b(yaourt|yogurt)\b/,                                                 g: 125 },
  { re: /\b(lait|jus|cafe|the|eau|soupe)\b/,                                  g: 250 },
  { re: /\b(beurre|huile)\b/,                                                  g: 15  },
  { re: /\b(chocolat|gateau|biscuit|cookie)\b/,                               g: 30  },
];

function defaultPortion(foodName) {
  const n = ciqualNormalize(foodName);
  for (const rule of DEFAULT_PORTION_RULES) {
    if (rule.re.test(n)) return { g: rule.g };
  }
  return { g: 100 };
}

// ─── meal_type fallback par heure du serveur (A1) ────────────────────────────
// Tranches : <11h breakfast · 11-15h lunch · 15-19h snack · >=19h dinner
function mealTypeFromHour(hour) {
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 19) return 'snack';
  return 'dinner';
}

// ─── MET table + estimation calories activité (A2 — AL-02) ───────────────────
const MET_SIMPLE = {
  course: 9.0, jogging: 9.0, running: 9.0, run: 9.0,
  marche: 3.5, walking: 3.5, randonnee: 3.5, walk: 3.5,
  velo: 7.0, cycling: 7.0, cyclisme: 7.0, bike: 7.0,
  natation: 6.0, swimming: 6.0, swim: 6.0,
  muscu: 5.0, musculation: 5.0, fitness: 5.0, gym: 5.0, haltere: 5.0,
  yoga: 2.5, pilates: 3.0, stretching: 2.5,
  football: 7.0, basketball: 7.0, tennis: 6.0, badminton: 5.5,
  sport: 5.0, exercise: 5.0, workout: 5.0, entrainement: 5.0,
};
const ACCENT_RE = new RegExp('[\\u0300-\\u036f]', 'g');

function estimateCaloriesBurned(sport, durationMin, weightKg = 70) {
  const norm = (sport || 'sport').toLowerCase().normalize('NFD').replace(ACCENT_RE, '');
  const met  = MET_SIMPLE[norm] ?? 5.0;
  return Math.round(met * weightKg * (durationMin / 60));
}

// ─── Gemini text call ─────────────────────────────────────────────────────────
async function callGeminiText(text, lang = 'fr') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY non défini');

  const langLabel = lang === 'ar' ? 'Arabic' : lang === 'en' ? 'English' : 'French';
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const systemPrompt = `You are a nutrition and activity log parser. Parse the following ${langLabel} text.
STRICTLY FORBIDDEN: Do not provide medical advice, diagnoses, prognoses, treatment recommendations, or drug interactions.
Rules:
- FOOD items (type:"food"): Be SPECIFIC with names (e.g. "Pomme", "Poulet rôti"), NEVER generic terms like "fruit", "légume", "plat", "aliment".
  Always estimate quantity_g ("une pomme"→150, "deux tranches de pain"→100, "un bol de couscous"→300). Set quantity_explicit=true ONLY for exact stated grams/kg/ml.
  Deduce meal_type from context clues: "ce matin"|"petit-déj"|"réveil"→"breakfast" | "midi"|"déjeuner"→"lunch" | "soir"|"dîner"→"dinner" | "collation"|"goûter"|"snack"→"snack" | ambiguous→null.
- ACTIVITY items (type:"activity"): any sport, exercise, or physical workout.
  sport field: "course" (running/jogging), "marche" (walking), "velo" (cycling), "natation" (swimming), "muscu" (weight training/gym), "yoga", "sport" (generic).
  Extract duration_min if stated (e.g. "30 minutes"→30, "1 heure"→60).
- WEIGHT items (type:"weight"): body weight measurements.
- GLUCOSE items (type:"glucose"): blood glucose readings.
Return ONLY valid JSON — no markdown fences, no explanations:
{"intents":[{"type":"food|activity|weight|glucose","name":"specific French name or null","sport":"course|marche|velo|natation|muscu|yoga|sport|null","duration_min":number_or_null,"quantity_g":number_or_null,"quantity_explicit":boolean,"weight_kg":number_or_null,"glucose_mg_dl":number_or_null,"meal_type":"breakfast|lunch|dinner|snack|null","confidence":0.0_to_1.0}]}`;

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
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        throw new Error('JSON invalide dans la réponse Gemini');
      }
    }
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
      type:              'food',
      name:              c.name,
      quantity_g:        (Number.isFinite(c.quantity_g) && c.quantity_g > 0) ? c.quantity_g : null,
      quantity_explicit: false,
      meal_type:         null,
      confidence:        c.value,
    }));
}

// ─── Text/voice → intents ─────────────────────────────────────────────────────
async function parseTextToIntents(text, lang = 'fr') {
  const parsed  = await callGeminiText(text, lang);
  const intents = Array.isArray(parsed?.intents) ? parsed.intents : [];
  return intents.map(i => {
    const type       = i.type || 'food';
    const confidence = typeof i.confidence === 'number' ? i.confidence : 0.5;
    if (type === 'activity') {
      return {
        type,
        name:         i.name || null,
        sport:        i.sport || null,
        duration_min: Number.isFinite(i.duration_min) && i.duration_min > 0
                        ? Math.round(i.duration_min) : null,
        confidence,
      };
    }
    return {
      type,
      name:              i.name || '',
      quantity_g:        i.quantity_g    ?? null,
      quantity_explicit: i.quantity_explicit === true,
      weight_kg:         i.weight_kg     ?? null,
      glucose_mg_dl:     i.glucose_mg_dl ?? null,
      // Reject "null" string and invalid values — only accept valid English enum
      meal_type:         VALID_MEAL_TYPES.has(i.meal_type) ? i.meal_type : null,
      confidence,
    };
  });
}

// ─── Nutrition cascade CIQUAL → USDA avec mise à l'échelle portion ───────────
async function resolveNutrition(foodName, quantity_g, quantity_explicit = false) {
  if (!foodName) return null;

  let portion, portion_source, estimated_portion;
  if (Number.isFinite(quantity_g) && quantity_g > 0) {
    portion           = quantity_g;
    portion_source    = quantity_explicit ? 'user' : 'gemini';
    estimated_portion = !quantity_explicit;
  } else {
    const def = defaultPortion(foodName);
    portion           = def.g;
    portion_source    = 'default';
    estimated_portion = true;
  }

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

  // 1. CIQUAL (scorée : forme brute avant forme transformée)
  const ciqualResults = searchByName(foodName, 1);
  if (ciqualResults.length) {
    const r = ciqualResults[0];
    return { ...scale(r), source: 'ciqual', quantity_g: portion, estimated_portion, portion_source };
  }

  // 2. USDA — ranked Foundation/SR Legacy first (P4.11)
  try {
    const usdaResults = await usdaSearch(foodName, 10);
    if (usdaResults.length) {
      const r = usdaResults[0];
      return { ...scale(r), source: 'usda', quantity_g: portion, estimated_portion, portion_source };
    }
  } catch (_) {}

  return null;
}

// ─── POST /api/interpret ──────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  const { mode, payload, lang = 'fr', mimeType, client_hour } = req.body;

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

  // M-1: prefer client_hour (avoids UTC server bias across timezones)
  const currentHour = (Number.isInteger(client_hour) && client_hour >= 0 && client_hour <= 23)
    ? client_hour
    : new Date().getHours();

  const intents = await Promise.all(rawIntents.map(async (intent) => {
    const base = {
      ...intent,
      needs_confirmation: intent.confidence < CONF_THRESHOLD,
    };

    // Activity: MET-based calorie estimation (AL-02)
    if (intent.type === 'activity') {
      const calories = intent.duration_min
        ? estimateCaloriesBurned(intent.sport, intent.duration_min)
        : null;
      return { ...base, calories_burned: calories, calories_burned_estimated: calories !== null };
    }

    // Weight / Glucose: pass through
    if (intent.type !== 'food') return base;

    // PROB-3 : terme générique → pas de valeur nutritionnelle trompeuse
    if (isGenericFoodTerm(intent.name)) {
      return { ...base, needs_confirmation: true, nutrition: null, nutrition_found: false };
    }

    // A1 : fallback meal_type par heure si Gemini n'a pas déduit
    const mealType = intent.meal_type || mealTypeFromHour(currentHour);

    const nutrition = await resolveNutrition(
      intent.name, intent.quantity_g, intent.quantity_explicit
    ).catch(() => null);

    return {
      ...base,
      meal_type:      mealType,
      nutrition:      nutrition || null,
      nutrition_found: !!nutrition,
    };
  }));

  res.json({ intents, disclaimer: DISCLAIMER_REG05 });
});

module.exports = router;
module.exports.resolveNutrition       = resolveNutrition;
module.exports.isGenericFoodTerm      = isGenericFoodTerm;
module.exports.defaultPortion         = defaultPortion;
module.exports.mealTypeFromHour       = mealTypeFromHour;
module.exports.estimateCaloriesBurned = estimateCaloriesBurned;
