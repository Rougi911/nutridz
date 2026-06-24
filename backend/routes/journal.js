const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { findById, localizeModifier } = require('../data/dishModifiers');
const { searchByName: ciqualSearch } = require('../services/ciqual');

const router = express.Router();

const SUPPORTED_LANGS = ['fr', 'ar', 'en'];

function getLang(req) {
  const q = req.query.lang;
  if (q && SUPPORTED_LANGS.includes(q)) return q;
  const al = (req.headers['accept-language'] || '').slice(0, 2).toLowerCase();
  return SUPPORTED_LANGS.includes(al) ? al : 'fr';
}

// Mapping interne ↔ contrat frontend (P4.16 — SL-API)
const MEAL_TYPE_TO_API   = { pdej: 'breakfast', dej: 'lunch', coll: 'snack', diner: 'dinner' };
const MEAL_TYPE_FROM_API = { breakfast: 'pdej', lunch: 'dej', snack: 'coll', dinner: 'diner' };

// Shared logic extracted for GET / and POST /query
async function queryJournalByDate(db, userId, date, lang) {
  const entries = await db.prepare(`
    SELECT je.*, p.name, p.brand, p.emoji, p.score, p.kcal_per100,
           p.glucides as p_glucides, p.proteines as p_proteines, p.lipides as p_lipides, p.fibres as p_fibres, p.additifs
    FROM journal_entries je
    JOIN products p ON je.product_id = p.id
    WHERE je.user_id = ? AND je.date = ?
    ORDER BY je.logged_at ASC
  `).all(userId, date);

  const byMeal = { pdej: [], dej: [], coll: [], diner: [] };
  let totals = { kcal: 0, glucides: 0, proteines: 0, lipides: 0, fibres: 0 };

  // Tableau plat ApiMealEntry pour le frontend (P4.16)
  const flatEntries = [];

  entries.forEach(e => {
    const entry = formatEntry(e, lang);
    if (byMeal[e.meal_type]) byMeal[e.meal_type].push(entry);
    totals.kcal      += e.kcal;
    totals.glucides  += e.glucides;
    totals.proteines += e.proteines;
    totals.lipides   += e.lipides;
    totals.fibres    += e.fibres;

    // Micronutriments CIQUAL si disponible (lookup par nom de produit)
    let micronutrients = null;
    if (e.name) {
      const ciqualHits = ciqualSearch(e.name, 1);
      if (ciqualHits.length > 0) {
        const c = ciqualHits[0];
        micronutrients = {
          vitaminC:   c.vitaminC,
          vitaminD:   c.vitaminD,
          vitaminB9:  c.vitaminB9,
          vitaminB12: c.vitaminB12,
          iron:       c.iron,
          calcium:    c.calcium,
          magnesium:  c.magnesium,
          zinc:       c.zinc,
        };
      }
    }

    // Format ApiMealEntry : food.calories = kcal_per100 (par 100g, pas par portion)
    flatEntries.push({
      id: e.id,
      food_id: String(e.product_id),
      food: {
        id: String(e.product_id),
        name: e.name,
        calories: e.kcal_per100,
        protein:  e.p_proteines ?? 0,
        carbs:    e.p_glucides  ?? 0,
        fat:      e.p_lipides   ?? 0,
        fiber:    e.p_fibres    ?? 0,
        source:   'nutrivita',
        ...(micronutrients && { micronutrients }),
      },
      amount: e.grams,
      meal_type: MEAL_TYPE_TO_API[e.meal_type] || e.meal_type,
      date: e.date,
      created_at: e.logged_at || e.date,
    });
  });

  Object.keys(totals).forEach(k => totals[k] = Math.round(totals[k] * 10) / 10);
  // entries : tableau plat (contrat P4.16 frontend) ; meals : regroupement legacy
  return { date, entries: flatEntries, meals: byMeal, totals };
}

// GET /api/journal?date=2025-01-15
router.get('/', auth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const lang = getLang(req);
  const db = getDB();
  res.json(await queryJournalByDate(db, req.userId, date, lang));
});

// POST /api/journal/query — même logique, date dans le body (contrat frontend P4)
router.post('/query', auth, async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const lang = getLang(req);
    const db = getDB();
    res.json(await queryJournalByDate(db, req.userId, date, lang));
  } catch (err) {
    console.error('[journal/query] error:', err.message);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// POST /api/journal — ajouter une entrée
// Accepte product_id|food_id et grams|amount (contrat P4.16 — SL-API)
router.post('/', auth, async (req, res) => {
  // Aliases : food_id ← product_id, amount ← grams, meal_type anglais ← interne
  const product_id_raw = req.body.product_id ?? req.body.food_id;
  const grams          = req.body.grams ?? req.body.amount;
  const meal_type_raw  = req.body.meal_type;
  const date           = req.body.date;
  const modifiers      = req.body.modifiers || [];
  // S15 — entrée liée (ex : sauce rattachée à un aliment du même repas)
  const parent_entry_id = req.body.parent_entry_id || null;

  const meal_type = MEAL_TYPE_FROM_API[meal_type_raw] || meal_type_raw;

  if (!product_id_raw || !grams || !meal_type) return res.status(400).json({ error: 'Champs manquants' });

  // Convertir en entier (products.id est INTEGER AUTOINCREMENT)
  const product_id = parseInt(product_id_raw, 10);
  if (isNaN(product_id)) return res.status(400).json({ error: 'food_id invalide' });

  const db = getDB();
  const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Produit non trouvé' });

  const ratio = grams / 100;
  let kcal      = product.kcal_per100  * ratio;
  let glucides  = product.glucides     * ratio;
  let proteines = product.proteines    * ratio;
  let lipides   = product.lipides      * ratio;
  let fibres    = product.fibres       * ratio;

  const validModifiers = [];
  for (const mod of modifiers) {
    const def = findById(mod.id);
    if (!def || !mod.amount_g || mod.amount_g <= 0) continue;
    const r = mod.amount_g / 100;
    kcal      += def.kcal_per_100g * r;
    glucides  += def.glucides      * r;
    proteines += def.proteines     * r;
    lipides   += def.lipides       * r;
    fibres    += def.fibres        * r;
    validModifiers.push({ id: mod.id, amount_g: mod.amount_g });
  }

  const entry = {
    id: uuidv4(),
    user_id: req.userId,
    date: date || new Date().toISOString().split('T')[0],
    meal_type,
    product_id,
    grams,
    kcal:      Math.round(kcal),
    glucides:  Math.round(glucides  * 10) / 10,
    proteines: Math.round(proteines * 10) / 10,
    lipides:   Math.round(lipides   * 10) / 10,
    fibres:    Math.round(fibres    * 10) / 10,
    modifiers_json: JSON.stringify(validModifiers),
    parent_entry_id,
  };

  await db.prepare(`
    INSERT INTO journal_entries (id, user_id, date, meal_type, product_id, grams, kcal, glucides, proteines, lipides, fibres, modifiers_json, parent_entry_id)
    VALUES (@id, @user_id, @date, @meal_type, @product_id, @grams, @kcal, @glucides, @proteines, @lipides, @fibres, @modifiers_json, @parent_entry_id)
  `).run(entry);

  res.status(201).json(entry);
});

// DELETE /api/journal/all — supprimer tout le journal de l'user
router.delete('/all', auth, async (req, res) => {
  const db = getDB();
  try {
    const result = await db.prepare('DELETE FROM journal_entries WHERE user_id = ?').run(req.userId);
    res.json({ deleted: result.changes });
  } catch (err) {
    console.error('[journal/delete-all] error:', err.message);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// PATCH /api/journal/:id — modifier la quantité (recalcul proportionnel kcal/macros)
// IDOR-guard : ne touche que les entrées de req.userId.
router.patch('/:id', auth, async (req, res) => {
  const grams = req.body.grams ?? req.body.amount;
  if (grams === undefined || grams === null || isNaN(grams) || grams <= 0) {
    return res.status(400).json({ error: 'Quantité invalide' });
  }

  const db = getDB();
  const entry = await db.prepare(
    'SELECT * FROM journal_entries WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);
  if (!entry) return res.status(404).json({ error: 'Entrée non trouvée' });

  const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(entry.product_id);
  if (!product) return res.status(404).json({ error: 'Produit non trouvé' });

  const ratio = grams / 100;
  let kcal      = (product.kcal_per100 || 0) * ratio;
  let glucides  = (product.glucides    || 0) * ratio;
  let proteines = (product.proteines   || 0) * ratio;
  let lipides   = (product.lipides     || 0) * ratio;
  let fibres    = (product.fibres      || 0) * ratio;

  // Les modifiers ont leur propre quantité (indépendante de l'aliment) → réappliqués tels quels.
  try {
    for (const mod of JSON.parse(entry.modifiers_json || '[]')) {
      const def = findById(mod.id);
      if (!def || !mod.amount_g) continue;
      const r = mod.amount_g / 100;
      kcal      += def.kcal_per_100g * r;
      glucides  += def.glucides      * r;
      proteines += def.proteines     * r;
      lipides   += def.lipides       * r;
      fibres    += def.fibres        * r;
    }
  } catch (_) {}

  const updated = {
    grams,
    kcal:      Math.round(kcal),
    glucides:  Math.round(glucides  * 10) / 10,
    proteines: Math.round(proteines * 10) / 10,
    lipides:   Math.round(lipides   * 10) / 10,
    fibres:    Math.round(fibres    * 10) / 10,
  };

  await db.prepare(`
    UPDATE journal_entries SET grams = ?, kcal = ?, glucides = ?, proteines = ?, lipides = ?, fibres = ?
    WHERE id = ? AND user_id = ?
  `).run(updated.grams, updated.kcal, updated.glucides, updated.proteines, updated.lipides, updated.fibres, req.params.id, req.userId);

  res.json({ id: req.params.id, ...updated });
});

// DELETE /api/journal/:id
router.delete('/:id', auth, async (req, res) => {
  const db = getDB();
  const result = await db.prepare('DELETE FROM journal_entries WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Entrée non trouvée' });
  res.json({ success: true });
});

// GET /api/journal/history?days=7
router.get('/history', auth, async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const db = getDB();

  const rows = await db.prepare(`
    SELECT date, SUM(kcal) as kcal, SUM(glucides) as glucides,
           SUM(proteines) as proteines, SUM(lipides) as lipides
    FROM journal_entries
    WHERE user_id = ? AND date >= date('now', ?)
    GROUP BY date ORDER BY date ASC
  `).all(req.userId, `-${days} days`);

  res.json(rows);
});

function formatEntry(e, lang = 'fr') {
  let parsedModifiers = [];
  try {
    const raw = JSON.parse(e.modifiers_json || '[]');
    parsedModifiers = raw.map(({ id, amount_g }) => {
      const def = findById(id);
      if (!def) return null;
      const loc = localizeModifier(def, lang);
      return { id, name: loc.name, emoji: loc.emoji, amount_g, kcal: Math.round(def.kcal_per_100g * amount_g / 100) };
    }).filter(Boolean);
  } catch {}

  return {
    id: e.id, meal_type: e.meal_type, grams: e.grams, kcal: e.kcal,
    glucides: e.glucides, proteines: e.proteines, lipides: e.lipides, fibres: e.fibres,
    modifiers: parsedModifiers,
    product: {
      id: e.product_id, name: e.name, brand: e.brand, emoji: e.emoji,
      score: e.score, kcal_per100: e.kcal_per100,
      additifs: typeof e.additifs === 'string' ? JSON.parse(e.additifs) : e.additifs
    }
  };
}

module.exports = router;
module.exports.queryJournalByDate = queryJournalByDate;
