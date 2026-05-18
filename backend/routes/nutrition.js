const express = require('express');
const auth    = require('../middleware/auth');
const { searchByName, getStats: ciqualStats } = require('../services/ciqual');
const { searchFood: usdaSearch, cacheInProducts, getStats: usdaStats } = require('../services/usda');
const { getDB } = require('../db');
const translations = require('../data/translations.json');

const router = express.Router();

// Translate EN label → FR for CIQUAL search
function translateToFr(query) {
  const lower = query.toLowerCase().trim();
  return translations.en_to_fr[lower] || query;
}

// GET /api/nutrition/search?q=tomate&sources=local,ciqual,usda
router.get('/search', auth, async (req, res) => {
  const q = (req.query.q || '').trim();
  const sources = (req.query.sources || 'local,ciqual,usda').split(',');

  if (!q) return res.json([]);

  const results = [];
  const seen = new Set();

  const add = (items) => {
    for (const item of items) {
      const key = `${item.source}:${(item.nom_fr || '').toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    }
  };

  // 1. Local products DB
  if (sources.includes('local')) {
    try {
      const db = getDB();
      const rows = await db.prepare(
        `SELECT id, name, brand, emoji, kcal_per100, glucides, proteines, lipides, fibres, source
         FROM products WHERE name LIKE ? ORDER BY name LIMIT 10`
      ).all(`%${q}%`);
      add(rows.map(r => ({
        source:    r.source || 'local',
        product_id: r.id,
        nom_fr:    r.name,
        nom_en:    r.name,
        brand:     r.brand,
        emoji:     r.emoji,
        kcal:      r.kcal_per100,
        glucides:  r.glucides,
        proteines: r.proteines,
        lipides:   r.lipides,
        fibres:    r.fibres,
        sel:       0,
      })));
    } catch (_) {}
  }

  // 2. CIQUAL
  if (sources.includes('ciqual')) {
    const frQuery = translateToFr(q);
    const ciqualResults = searchByName(frQuery, 5);
    if (frQuery !== q) {
      // also search original
      const orig = searchByName(q, 3);
      add([...ciqualResults, ...orig]);
    } else {
      add(ciqualResults);
    }
  }

  // 3. USDA
  if (sources.includes('usda') && results.length < 8) {
    const usdaResults = await usdaSearch(q, 5);
    add(usdaResults);
    // Cache results
    for (const r of usdaResults.slice(0, 2)) {
      cacheInProducts(r.nom_fr, r).catch(() => {});
    }
  }

  res.json(results.slice(0, 15));
});

// GET /api/nutrition/stats — source coverage dashboard
router.get('/stats', auth, async (req, res) => {
  const db = getDB();
  try {
    const local = await db.prepare(
      "SELECT COUNT(*) as cnt FROM products WHERE source IS NULL OR source NOT IN ('usda','ciqual')"
    ).get();
    const ciqual = ciqualStats();
    const usda   = await usdaStats();

    res.json({
      local:  { count: local?.cnt || 0,  source: 'local',  label: 'NutriVita DB' },
      ciqual: { count: ciqual.count,      source: 'ciqual', label: 'CIQUAL ANSES' },
      usda:   { count: usda.count,        source: 'usda',   label: 'USDA FoodData' },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
