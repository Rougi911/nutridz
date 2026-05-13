const express = require('express');
const { getDB } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/products?q=&category=&page=1
router.get('/', async (req, res) => {
  const { q = '', category = '', page = 1, limit = 20 } = req.query;
  const db = getDB();
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (q) { query += ' AND (name LIKE ? OR brand LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (category) { query += ' AND category = ?'; params.push(category); }
  query += ' ORDER BY score ASC, name ASC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const products = await db.prepare(query).all(...params);

  const countSql = 'SELECT COUNT(*) as n FROM products WHERE 1=1'
    + (q ? ' AND (name LIKE ? OR brand LIKE ?)' : '')
    + (category ? ' AND category = ?' : '');
  const totalRow = await db.prepare(countSql).get(...params.slice(0, -2));
  const total = totalRow.n;

  res.json({ products: products.map(formatProduct), total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

// GET /api/products/categories
router.get('/categories', async (req, res) => {
  const db = getDB();
  const rows = await db.prepare('SELECT category, COUNT(*) as count FROM products GROUP BY category ORDER BY count DESC').all();
  res.json(rows);
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  const db = getDB();
  const product = await db.prepare('SELECT * FROM products WHERE id = ? OR barcode = ?').get(req.params.id, req.params.id);
  if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
  res.json(formatProduct(product));
});

// POST /api/products (admin - ajouter un produit)
router.post('/', auth, async (req, res) => {
  const db = getDB();
  const { name, brand, emoji, score, kcal_per100, glucides, proteines, lipides, fibres, sel, additifs, comment, category, barcode } = req.body;

  if (!name || !brand || !kcal_per100) return res.status(400).json({ error: 'Champs obligatoires manquants' });

  const result = await db.prepare(`
    INSERT INTO products (name, brand, emoji, score, kcal_per100, glucides, proteines, lipides, fibres, sel, additifs, comment, category, barcode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, brand, emoji || '🍽️', score || 'B', kcal_per100, glucides || 0, proteines || 0, lipides || 0, fibres || 0, sel || 0, JSON.stringify(additifs || []), comment || '', category || 'divers', barcode || null);

  const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(formatProduct(product));
});

function formatProduct(p) {
  return {
    ...p,
    additifs: typeof p.additifs === 'string' ? JSON.parse(p.additifs) : p.additifs,
    per100: { glucides: p.glucides, proteines: p.proteines, lipides: p.lipides, fibres: p.fibres, sel: p.sel }
  };
}

module.exports = router;
