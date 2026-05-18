const axios = require('axios');
const { getDB } = require('../db');

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const API_KEY  = process.env.USDA_API_KEY || 'DEMO_KEY';

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

async function searchFood(query, pageSize = 5) {
  if (!query) return [];
  try {
    const url = `${BASE_URL}/foods/search`;
    const res = await axios.get(url, {
      params: { api_key: API_KEY, query, pageSize, dataType: 'SR Legacy,Foundation,Branded' },
      timeout: 8000,
    });
    const foods = res.data?.foods || [];
    return foods.map(f => ({
      source:    'usda',
      fdcId:     f.fdcId,
      nom_fr:    f.description,
      nom_en:    f.description,
      brand:     f.brandOwner || f.brandName || null,
      group:     f.foodCategory || null,
      ...parseNutrients(f.foodNutrients),
    }));
  } catch (err) {
    if (err.response?.status === 403) {
      console.warn('[USDA] Clé API invalide ou quota dépassé');
    } else {
      console.warn('[USDA] Erreur recherche:', err.message);
    }
    return [];
  }
}

async function getFood(fdcId) {
  try {
    const url = `${BASE_URL}/food/${fdcId}`;
    const res = await axios.get(url, { params: { api_key: API_KEY }, timeout: 8000 });
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
    console.warn('[USDA] Erreur getFood:', err.message);
    return null;
  }
}

// Cache a USDA result in the products table so future lookups hit local DB first
async function cacheInProducts(name, data) {
  if (!data || data.kcal === 0) return null;
  const db = getDB();
  try {
    // Don't duplicate
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

module.exports = { searchFood, getFood, cacheInProducts, getStats };
