const express = require('express');
const auth    = require('../middleware/auth');
const { searchByName } = require('../services/ciqual');
const { searchFood: usdaSearch, cacheInProducts } = require('../services/usda');
const { getDB } = require('../db');
const translations = require('../data/translations.json');

const router = express.Router();

// Translate EN label → FR for CIQUAL search (shared with nutrition.js)
function translateToFr(query) {
  const lower = query.toLowerCase().trim();
  return translations.en_to_fr[lower] || query;
}

// Upsert a food item to products table and return its integer id.
// Idempotent: if name+source already exists, returns existing id.
async function upsertToProducts(db, { name, kcal = 0, glucides = 0, proteines = 0, lipides = 0, fibres = 0, sel = 0, source }) {
  const existing = await db.prepare(
    'SELECT id FROM products WHERE name = ? AND source = ?'
  ).get(name, source);
  if (existing) return existing.id;

  const result = await db.prepare(
    `INSERT INTO products (name, brand, kcal_per100, glucides, proteines, lipides, fibres, sel, source)
     VALUES (?, '', ?, ?, ?, ?, ?, ?, ?)`
  ).run(name, kcal, glucides, proteines, lipides, fibres, sel, source);

  // If row already existed under a different lookup (race), fetch it
  if (!result.lastInsertRowid) {
    const found = await db.prepare('SELECT id FROM products WHERE name = ? AND source = ?').get(name, source);
    return found?.id ?? null;
  }
  return result.lastInsertRowid;
}

// GET /api/foods/search?q= — contrat ApiFoodSearchResult pour le frontend (P4.16)
// Renvoie des aliments avec des product_id réels (DB) pour que addJournalEntry fonctionne.
router.get('/search', auth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const db = getDB();
  const results = [];
  const seen = new Set(); // dedup par nom normalisé

  // 1. Local products DB — priorité car déjà indexé
  try {
    const rows = await db.prepare(
      `SELECT id, name, kcal_per100, glucides, proteines, lipides, fibres, source
       FROM products WHERE name LIKE ? ORDER BY name LIMIT 8`
    ).all(`%${q}%`);
    for (const r of rows) {
      const key = r.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          id: String(r.id),
          name: r.name,
          calories: r.kcal_per100,
          protein: r.proteines ?? 0,
          carbs: r.glucides ?? 0,
          fat: r.lipides ?? 0,
          fiber: r.fibres ?? undefined,
          source: r.source || 'nutrivita',
          cuisine: 'International',
        });
      }
    }
  } catch (_) {}

  // 2. CIQUAL (base ANSES française)
  const frQuery = translateToFr(q);
  const ciqualItems = searchByName(frQuery, 5);
  if (frQuery !== q) {
    ciqualItems.push(...searchByName(q, 3));
  }
  for (const item of ciqualItems) {
    const key = (item.nom_fr || '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const pid = await upsertToProducts(db, {
        name: item.nom_fr,
        kcal: item.kcal,
        glucides: item.glucides,
        proteines: item.proteines,
        lipides: item.lipides,
        fibres: item.fibres,
        sel: item.sel,
        source: 'ciqual',
      });
      if (!pid) continue;
      results.push({
        id: String(pid),
        name: item.nom_fr,
        name_en: item.nom_en || undefined,
        calories: item.kcal,
        protein: item.proteines,
        carbs: item.glucides,
        fat: item.lipides,
        fiber: item.fibres || undefined,
        source: 'ciqual',
        cuisine: 'International',
      });
    } catch (err) {
      console.error('[foods/search] CIQUAL upsert:', err.message);
    }
  }

  // 3. USDA — repli si pas assez de résultats locaux+CIQUAL
  if (results.length < 8) {
    try {
      const usdaItems = await usdaSearch(q, 5);
      for (const item of usdaItems) {
        const name = item.nom_fr || item.nom_en;
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        // cacheInProducts from usda.js uses brand='USDA'
        const pid = await cacheInProducts(name, item);
        if (!pid) continue;
        results.push({
          id: String(pid),
          name,
          name_en: item.nom_en || undefined,
          calories: item.kcal,
          protein: item.proteines,
          carbs: item.glucides,
          fat: item.lipides,
          fiber: item.fibres || undefined,
          source: 'usda',
          cuisine: 'International',
        });
      }
    } catch (err) {
      console.error('[foods/search] USDA error:', err.message);
    }
  }

  res.json(results.slice(0, 15));
});

module.exports = router;
