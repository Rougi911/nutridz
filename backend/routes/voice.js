const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { parseFoodInput, parseWeightInput, parseGlucoseInput } = require('../services/voiceParser');
const { searchByName } = require('../services/ciqual');
const { getDB } = require('../db');
const authMiddleware = require('../middleware/auth');

router.post('/parse', authMiddleware, async (req, res) => {
  try {
    const { text, context = 'food', lang = 'fr' } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    let result;

    switch (context) {
      case 'food':
        result = parseFoodInput(text, lang);
        break;
      case 'weight': {
        const weight = parseWeightInput(text, lang);
        result = weight !== null
          ? { weight_kg: weight, raw: text }
          : { error: 'Could not parse weight', raw: text };
        break;
      }
      case 'glucose': {
        const glucose = parseGlucoseInput(text, lang);
        result = glucose !== null
          ? { ...glucose, raw: text }
          : { error: 'Could not parse glucose', raw: text };
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid context' });
    }

    res.json(result);
  } catch (error) {
    console.error('Voice parse error:', error);
    res.status(500).json({ error: 'Parse failed' });
  }
});

// POST /api/voice/add-to-journal
router.post('/add-to-journal', authMiddleware, async (req, res) => {
  const { items, meal_type, date } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'items required' });
  if (!meal_type)
    return res.status(400).json({ error: 'meal_type required' });

  const db = getDB();
  const today = date || new Date().toISOString().split('T')[0];
  const added = [];

  for (const item of items) {
    const { name, amount_g = 100, product_id: givenProductId, kcal_per100, glucides, proteines, lipides, fibres } = item;
    if (!name && !givenProductId) continue;

    let product = null;

    // 1. Use provided product_id
    if (givenProductId) {
      product = await db.prepare('SELECT * FROM products WHERE id = ?').get(givenProductId);
    }

    // 2. Search local products by name
    if (!product && name) {
      product = await db.prepare(
        `SELECT * FROM products WHERE LOWER(name) LIKE LOWER(?) LIMIT 1`
      ).get(`%${name}%`);
    }

    // 3. CIQUAL search
    if (!product && name) {
      const ciqualResults = searchByName(name, 1);
      if (ciqualResults.length > 0) {
        const c = ciqualResults[0];
        const existing = await db.prepare(
          `SELECT * FROM products WHERE name = ? AND source = 'ciqual' LIMIT 1`
        ).get(c.nom_fr);
        if (existing) {
          product = existing;
        } else {
          const ins = await db.prepare(
            `INSERT INTO products (name, brand, emoji, kcal_per100, glucides, proteines, lipides, fibres, source, score, is_algerian)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(c.nom_fr, 'CIQUAL', '🥗', c.kcal || 100, c.glucides || 0, c.proteines || 0, c.lipides || 0, c.fibres || 0, 'ciqual', 'B', 0);
          product = await db.prepare('SELECT * FROM products WHERE id = ?').get(ins.lastInsertRowid);
        }
      }
    }

    // 4. If frontend provided nutrition data, create voice product
    if (!product && name && kcal_per100 != null) {
      const existing = await db.prepare(
        `SELECT * FROM products WHERE name = ? AND source = 'voice' LIMIT 1`
      ).get(name);
      if (existing) {
        product = existing;
      } else {
        const ins = await db.prepare(
          `INSERT INTO products (name, brand, emoji, kcal_per100, glucides, proteines, lipides, fibres, source, score, is_algerian)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(name, 'Voice', '🎤', kcal_per100, glucides || 0, proteines || 0, lipides || 0, fibres || 0, 'voice', 'C', 0);
        product = await db.prepare('SELECT * FROM products WHERE id = ?').get(ins.lastInsertRowid);
      }
    }

    // 5. Last resort: generic voice product
    if (!product && name) {
      const existing = await db.prepare(
        `SELECT * FROM products WHERE name = ? AND source = 'voice' LIMIT 1`
      ).get(name);
      if (existing) {
        product = existing;
      } else {
        const ins = await db.prepare(
          `INSERT INTO products (name, brand, emoji, kcal_per100, glucides, proteines, lipides, fibres, source, score, is_algerian)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(name, 'Voice', '🎤', 150, 20, 5, 5, 1, 'voice', 'C', 0);
        product = await db.prepare('SELECT * FROM products WHERE id = ?').get(ins.lastInsertRowid);
      }
    }

    if (!product) continue;

    const grams = amount_g;
    const ratio = grams / 100;
    const entry = {
      id: uuidv4(),
      user_id: req.userId,
      date: today,
      meal_type,
      product_id: product.id,
      grams,
      kcal:      Math.round(product.kcal_per100 * ratio),
      glucides:  Math.round(product.glucides  * ratio * 10) / 10,
      proteines: Math.round(product.proteines * ratio * 10) / 10,
      lipides:   Math.round(product.lipides   * ratio * 10) / 10,
      fibres:    Math.round((product.fibres || 0) * ratio * 10) / 10,
      modifiers_json: '[]',
    };

    await db.prepare(`
      INSERT INTO journal_entries
        (id, user_id, date, meal_type, product_id, grams, kcal, glucides, proteines, lipides, fibres, modifiers_json)
      VALUES
        (@id, @user_id, @date, @meal_type, @product_id, @grams, @kcal, @glucides, @proteines, @lipides, @fibres, @modifiers_json)
    `).run(entry);

    added.push({ id: entry.id, name: product.name, grams, kcal: entry.kcal });
  }

  res.json({ added, count: added.length });
});

module.exports = router;
