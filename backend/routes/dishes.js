const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { findById } = require('../data/dishModifiers');

const router = express.Router();

const SUPPORTED_LANGS = ['fr', 'ar', 'en'];

function getLang(req) {
  const q = req.query.lang;
  if (q && SUPPORTED_LANGS.includes(q)) return q;
  const al = (req.headers['accept-language'] || '').slice(0, 2).toLowerCase();
  return SUPPORTED_LANGS.includes(al) ? al : 'fr';
}

function localizeDish(dish, lang) {
  return {
    ...dish,
    name: dish[`name_${lang}`] || dish.name_fr || dish.name,
    description: dish[`description_${lang}`] || dish.description_fr || dish.description,
    _translations: { fr: dish.name_fr, ar: dish.name_ar, en: dish.name_en },
  };
}

const CUISINE_FLAGS = {
  française: '🇫🇷', italienne: '🇮🇹', maghrébine: '🇩🇿',
  'moyen-orient': '🇸🇦', asiatique: '🇨🇳', américaine: '🇺🇸',
  turque: '🇹🇷', indienne: '🇮🇳', mexicaine: '🇲🇽', japonaise: '🇯🇵', divers: '🌍',
};

// GET /api/dishes?q=&cuisine=&category=
router.get('/', auth, async (req, res) => {
  const { q = '', cuisine = '', category = '' } = req.query;
  const db = getDB();

  let sql = `SELECT id,name,name_ar,name_en,emoji,cuisine,category,description,
    default_portion_g,kcal_per_portion,glucides,proteines,lipides,fibres,
    difficulty,prep_time_min,cook_time_min,is_user_created,created_by_user_id
    FROM dishes WHERE 1=1`;
  const params = [];

  if (q) {
    sql += ' AND (name LIKE ? OR name_ar LIKE ? OR name_en LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (cuisine) { sql += ' AND cuisine = ?'; params.push(cuisine); }
  if (category) { sql += ' AND category = ?'; params.push(category); }

  sql += ' ORDER BY (created_by_user_id = ?) DESC, cuisine, name';
  params.push(req.userId);

  const lang = getLang(req);
  const dishes = await db.prepare(sql).all(...params);
  res.json(dishes.map(d => ({ ...localizeDish(d, lang), flag: CUISINE_FLAGS[d.cuisine] || '🌍' })));
});

// GET /api/dishes/cuisines  — must be before /:id
router.get('/cuisines', auth, async (req, res) => {
  const db = getDB();
  const rows = await db.prepare(
    'SELECT cuisine, COUNT(*) as count FROM dishes GROUP BY cuisine ORDER BY count DESC'
  ).all();
  res.json(rows.map(r => ({ ...r, flag: CUISINE_FLAGS[r.cuisine] || '🌍' })));
});

// GET /api/dishes/:id
router.get('/:id', auth, async (req, res) => {
  const db = getDB();
  const dish = await db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
  if (!dish) return res.status(404).json({ error: 'Plat non trouvé' });
  const lang = getLang(req);
  res.json({ ...localizeDish(dish, lang), ingredients: JSON.parse(dish.ingredients_json || '[]'), flag: CUISINE_FLAGS[dish.cuisine] || '🌍' });
});

// POST /api/dishes — create custom dish (ingredients from products table)
router.post('/', auth, async (req, res) => {
  const { name, emoji, cuisine, category, description, ingredients, prep_time_min, cook_time_min, difficulty } = req.body;
  if (!name || !ingredients?.length) return res.status(400).json({ error: 'Nom et ingrédients requis' });

  const db = getDB();
  let total_kcal = 0, total_glucides = 0, total_proteines = 0, total_lipides = 0, total_fibres = 0, total_g = 0;

  for (const ing of ingredients) {
    if (!ing.grams || ing.grams <= 0) continue;
    const r = ing.grams / 100;

    if (ing.product_id) {
      // Local products table
      const p = await db.prepare('SELECT * FROM products WHERE id = ?').get(ing.product_id);
      if (p) {
        total_kcal      += (p.kcal_per100 || 0) * r;
        total_glucides  += (p.glucides    || 0) * r;
        total_proteines += (p.proteines   || 0) * r;
        total_lipides   += (p.lipides     || 0) * r;
        total_fibres    += (p.fibres      || 0) * r;
        total_g         += ing.grams;
      }
    } else if (ing.kcal_per100 != null || ing.kcal != null) {
      // Inline nutritional data (from CIQUAL / USDA) — accept both kcal_per100 and kcal (all per 100g)
      const kcal100 = ing.kcal_per100 ?? ing.kcal ?? 0;
      total_kcal      += kcal100 * r;
      total_glucides  += (ing.glucides     || 0) * r;
      total_proteines += (ing.proteines    || 0) * r;
      total_lipides   += (ing.lipides      || 0) * r;
      total_fibres    += (ing.fibres       || 0) * r;
      total_g         += ing.grams;
    }
  }

  const result = await db.prepare(`
    INSERT INTO dishes (name, name_fr, emoji, cuisine, category, description, description_fr, default_portion_g,
      kcal_per_portion, glucides, proteines, lipides, fibres, ingredients_json,
      difficulty, prep_time_min, cook_time_min, is_user_created, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    name, name, emoji || '🍽️', cuisine || 'divers', category || 'plat', description || '', description || '',
    Math.round(total_g) || 300, Math.round(total_kcal),
    Math.round(total_glucides * 10) / 10, Math.round(total_proteines * 10) / 10,
    Math.round(total_lipides * 10) / 10, Math.round(total_fibres * 10) / 10,
    JSON.stringify(ingredients), difficulty || 'moyen',
    prep_time_min || 0, cook_time_min || 0, req.userId
  );

  const dish = await db.prepare('SELECT * FROM dishes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...dish, ingredients, flag: CUISINE_FLAGS[dish.cuisine] || '🌍' });
});

// POST /api/dishes/:id/log — add dish to journal at given portion
router.post('/:id/log', auth, async (req, res) => {
  const { meal_type, portion_g, date, modifiers = [] } = req.body;
  if (!meal_type) return res.status(400).json({ error: 'meal_type requis' });

  const db = getDB();
  const dish = await db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
  if (!dish) return res.status(404).json({ error: 'Plat non trouvé' });

  const defaultPortion = dish.default_portion_g || 300;
  const portion = portion_g || defaultPortion;
  const ratio = portion / defaultPortion;
  const today = date || new Date().toISOString().split('T')[0];

  let kcal      = (dish.kcal_per_portion || 0) * ratio;
  let glucides  = (dish.glucides  || 0) * ratio;
  let proteines = (dish.proteines || 0) * ratio;
  let lipides   = (dish.lipides   || 0) * ratio;
  let fibres    = (dish.fibres    || 0) * ratio;

  const validModifiers = [];
  for (const m of modifiers) {
    const mod = findById(m.id);
    if (!mod || !m.amount_g || m.amount_g <= 0) continue;
    const factor = m.amount_g / 100;
    kcal      += mod.kcal_per_100g * factor;
    glucides  += mod.glucides      * factor;
    proteines += mod.proteines     * factor;
    lipides   += mod.lipides       * factor;
    fibres    += (mod.fibres || 0) * factor;
    validModifiers.push({ id: m.id, amount_g: m.amount_g });
  }

  // Reuse or create a product entry for this dish so journal_entries FK is satisfied
  let product = await db.prepare('SELECT * FROM products WHERE name = ? AND brand = ?').get(dish.name, 'Plat NutriVita');
  if (!product) {
    const per100 = defaultPortion > 0 ? 100 / defaultPortion : 1;
    const ins = await db.prepare(`
      INSERT INTO products (name, brand, emoji, score, kcal_per100, glucides, proteines, lipides, fibres, category, is_algerian)
      VALUES (?, 'Plat NutriVita', ?, 'B', ?, ?, ?, ?, ?, ?, 0)
    `).run(
      dish.name, dish.emoji || '🍽️',
      Math.round(dish.kcal_per_portion * per100),
      Math.round(dish.glucides  * per100 * 10) / 10,
      Math.round(dish.proteines * per100 * 10) / 10,
      Math.round(dish.lipides   * per100 * 10) / 10,
      Math.round(dish.fibres    * per100 * 10) / 10,
      dish.category || 'divers'
    );
    product = await db.prepare('SELECT * FROM products WHERE id = ?').get(ins.lastInsertRowid);
  }

  const entry = {
    id: uuidv4(), user_id: req.userId, date: today, meal_type,
    product_id: product.id, grams: portion,
    kcal:          Math.round(kcal),
    glucides:      Math.round(glucides  * 10) / 10,
    proteines:     Math.round(proteines * 10) / 10,
    lipides:       Math.round(lipides   * 10) / 10,
    fibres:        Math.round(fibres    * 10) / 10,
    modifiers_json: JSON.stringify(validModifiers),
  };

  await db.prepare(`
    INSERT INTO journal_entries (id, user_id, date, meal_type, product_id, grams, kcal, glucides, proteines, lipides, fibres, modifiers_json)
    VALUES (@id, @user_id, @date, @meal_type, @product_id, @grams, @kcal, @glucides, @proteines, @lipides, @fibres, @modifiers_json)
  `).run(entry);

  res.status(201).json({ success: true, kcal: entry.kcal, dish: dish.name });
});

module.exports = router;
