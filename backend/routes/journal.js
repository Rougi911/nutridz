const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { findById, localizeModifier } = require('../data/dishModifiers');

const router = express.Router();

const SUPPORTED_LANGS = ['fr', 'ar', 'en'];

function getLang(req) {
  const q = req.query.lang;
  if (q && SUPPORTED_LANGS.includes(q)) return q;
  const al = (req.headers['accept-language'] || '').slice(0, 2).toLowerCase();
  return SUPPORTED_LANGS.includes(al) ? al : 'fr';
}

// GET /api/journal?date=2025-01-15
router.get('/', auth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const lang = getLang(req);
  const db = getDB();

  const entries = await db.prepare(`
    SELECT je.*, p.name, p.brand, p.emoji, p.score, p.kcal_per100,
           p.glucides as p_glucides, p.proteines as p_proteines, p.lipides as p_lipides, p.fibres as p_fibres, p.additifs
    FROM journal_entries je
    JOIN products p ON je.product_id = p.id
    WHERE je.user_id = ? AND je.date = ?
    ORDER BY je.logged_at ASC
  `).all(req.userId, date);

  const byMeal = { pdej: [], dej: [], coll: [], diner: [] };
  let totals = { kcal: 0, glucides: 0, proteines: 0, lipides: 0, fibres: 0 };

  entries.forEach(e => {
    const entry = formatEntry(e, lang);
    if (byMeal[e.meal_type]) byMeal[e.meal_type].push(entry);
    totals.kcal += e.kcal;
    totals.glucides += e.glucides;
    totals.proteines += e.proteines;
    totals.lipides += e.lipides;
    totals.fibres += e.fibres;
  });

  Object.keys(totals).forEach(k => totals[k] = Math.round(totals[k] * 10) / 10);
  res.json({ date, meals: byMeal, totals });
});

// POST /api/journal — ajouter une entrée
router.post('/', auth, async (req, res) => {
  const { product_id, grams, meal_type, date, modifiers = [] } = req.body;
  if (!product_id || !grams || !meal_type) return res.status(400).json({ error: 'Champs manquants' });

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
  };

  await db.prepare(`
    INSERT INTO journal_entries (id, user_id, date, meal_type, product_id, grams, kcal, glucides, proteines, lipides, fibres, modifiers_json)
    VALUES (@id, @user_id, @date, @meal_type, @product_id, @grams, @kcal, @glucides, @proteines, @lipides, @fibres, @modifiers_json)
  `).run(entry);

  res.status(201).json(entry);
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
    WHERE user_id = ? AND date >= date('now', '-${days} days')
    GROUP BY date ORDER BY date ASC
  `).all(req.userId);

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
