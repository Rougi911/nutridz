const axios = require('axios');
const { getDB } = require('../db');

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const API_KEY  = process.env.USDA_API_KEY || 'DEMO_KEY';

// Log key status once at startup
const keyLabel = API_KEY === 'DEMO_KEY' ? 'DEMO_KEY (limited to ~30 req/day)' : `custom key (${API_KEY.slice(0,4)}...)`;
console.log(`[USDA] API key: ${keyLabel}`);

// Nutrient IDs used by USDA FoodData Central
const NUTRIENT_IDS = {
  kcal:      1008,
  proteines: 1003,
  lipides:   1004,
  glucides:  1005,
  fibres:    1079,
  sodium:    1093,  // mg → divide by 400 to get approximate sel (g NaCl)
};

function parseNutrients(foodNutrients) {
  const map = {};
  for (const n of (foodNutrients || [])) {
    const id = n.nutrientId || n.nutrient?.id;
    const val = n.value ?? n.amount ?? 0;
    map[id] = val;
  }
  return {
    kcal:      Math.round(map[NUTRIENT_IDS.kcal]      || 0),
    proteines: Math.round((map[NUTRIENT_IDS.proteines] || 0) * 10) / 10,
    lipides:   Math.round((map[NUTRIENT_IDS.lipides]   || 0) * 10) / 10,
    glucides:  Math.round((map[NUTRIENT_IDS.glucides]  || 0) * 10) / 10,
    fibres:    Math.round((map[NUTRIENT_IDS.fibres]    || 0) * 10) / 10,
    sel:       Math.round((map[NUTRIENT_IDS.sodium]    || 0) / 400 * 100) / 100,
  };
}

// Re-rank USDA results: Foundation (1) > SR Legacy (2) > Survey FNDDS (3) > unknown (10) > Branded (99)
// Prevents branded candy from appearing first for generic queries like "apple"
const DATA_TYPE_PRIORITY = { 'Foundation': 1, 'SR Legacy': 2, 'Survey (FNDDS)': 3 };
function rankByDataType(foods) {
  return [...foods].sort((a, b) => {
    const pa = DATA_TYPE_PRIORITY[a.dataType] ?? (a.dataType === 'Branded' ? 99 : 10);
    const pb = DATA_TYPE_PRIORITY[b.dataType] ?? (b.dataType === 'Branded' ? 99 : 10);
    return pa - pb;
  });
}

async function searchFood(query, pageSize = 10) {
  if (!query) return [];
  const url = `${BASE_URL}/foods/search`;
  // Query not logged (RGPD minimisation — can contain user health-context terms);
  try {
    const res = await axios.get(url, {
      params: { api_key: API_KEY, query, pageSize, dataType: 'Foundation,SR Legacy,Survey (FNDDS),Branded' },
      timeout: 10000,
    });
    const foods = res.data?.foods || [];
    console.log(`[USDA] → ${res.data?.totalHits ?? '?'} hits, returning ${foods.length} results`);
    const mapped = foods.map(f => ({
      source:    'usda',
      fdcId:     f.fdcId,
      dataType:  f.dataType,
      nom_fr:    f.description,
      nom_en:    f.description,
      brand:     f.brandOwner || f.brandName || null,
      group:     f.foodCategory || null,
      ...parseNutrients(f.foodNutrients),
    }));
    return rankByDataType(mapped);
  } catch (err) {
    const status = err.response?.status;
    const body   = JSON.stringify(err.response?.data || {}).slice(0, 200);
    if (status === 403) {
      console.error('[USDA] ❌ 403 Forbidden — clé API invalide ou quota DEMO_KEY dépassé');
    } else if (status === 429) {
      console.error('[USDA] ❌ 429 Too Many Requests — quota dépassé');
    } else {
      console.error(`[USDA] ❌ Erreur ${status || 'réseau'}: ${err.message} | body: ${body}`);
    }
    return [];
  }
}

async function getFood(fdcId) {
  try {
    const url = `${BASE_URL}/food/${fdcId}`;
    const res = await axios.get(url, { params: { api_key: API_KEY }, timeout: 10000 });
    const f = res.data;
    return {
      source:    'usda',
      fdcId:     f.fdcId,
      nom_fr:    f.description,
      nom_en:    f.description,
      brand:     f.brandOwner || null,
      group:     f.foodCategory?.description || null,
      ...parseNutrients(f.foodNutrients),
    };
  } catch (err) {
    console.error(`[USDA] ❌ getFood(${fdcId}): ${err.response?.status || err.message}`);
    return null;
  }
}

// Cache a USDA result in the products table so future lookups hit local DB first
async function cacheInProducts(name, data) {
  if (!data || data.kcal === 0) return null;
  const db = getDB();
  try {
    const existing = await db.prepare(
      "SELECT id FROM products WHERE name = ? AND brand = 'USDA'"
    ).get(name);
    if (existing) return existing.id;

    const res = await db.prepare(`
      INSERT INTO products (name, brand, emoji, score, kcal_per100, glucides, proteines, lipides, fibres, category, is_algerian, source)
      VALUES (?, 'USDA', '🌍', 'B', ?, ?, ?, ?, ?, 'divers', 0, 'usda')
    `).run(name, data.kcal, data.glucides, data.proteines, data.lipides, data.fibres);
    return res.lastInsertRowid;
  } catch (_) { return null; }
}

async function getStats() {
  try {
    const db = getDB();
    const row = await db.prepare("SELECT COUNT(*) as cnt FROM products WHERE source='usda'").get();
    return { count: row?.cnt || 0, source: 'usda' };
  } catch (_) { return { count: 0, source: 'usda' }; }
}

module.exports = { searchFood, getFood, cacheInProducts, getStats, rankByDataType };
