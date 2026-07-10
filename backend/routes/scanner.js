const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { lookupBarcode, searchByName } = require('../services/openfoodfacts');
const { extractNutritionFromImage, extractFromIngredientsText } = require('../services/ocr');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptées'));
  }
});

// ─── 1. Lookup code-barres ────────────────────────────────────────────────────
router.get('/barcode/:code', auth, async (req, res) => {
  const { code } = req.params;
  // L (ultrareview) : valider le code-barres (4 à 14 chiffres) avant tout lookup —
  // empêche l'injection de segments d'URL arbitraires vers OpenFoodFacts.
  if (!/^\d{4,14}$/.test(code)) {
    return res.status(400).json({ error: 'Code-barres invalide' });
  }
  const db = getDB();

  const local = await db.prepare('SELECT * FROM products WHERE barcode = ?').get(code);
  if (local) {
    return res.json({ source: 'local', found: true, product: formatProduct(local) });
  }

  const offProduct = await lookupBarcode(code);
  if (offProduct) {
    const saved = await saveProductToDB(db, offProduct);
    return res.json({ source: 'openfoodfacts', found: true, product: saved });
  }

  return res.json({
    source: null, found: false, barcode: code,
    message: 'Produit inconnu. Scannez les valeurs nutritionnelles ou recherchez par nom.',
    next_steps: ['ocr', 'search']
  });
});

// ─── 2. OCR étiquette nutritionnelle (Tesseract.js — gratuit, 100% local) ────
router.post('/ocr', auth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image manquante' });

  const barcode = req.body.barcode || null;

  // On passe le Buffer directement à Tesseract (pas besoin de base64)
  const result = await extractNutritionFromImage(req.file.buffer, req.file.mimetype);
  if (!result.success) return res.status(422).json({ error: result.error, raw_text: result.raw_text });

  const data = result.data;

  if (data.kcal_per100 > 0 && data.name) {
    const db = getDB();
    const product = await saveProductToDB(db, { ...data, barcode: barcode || null });
    return res.json({
      source: 'ocr_tesseract', found: true,
      confidence: data.confiance || 'moyenne',
      product, raw_ocr: data
    });
  }

  return res.json({
    source: 'ocr_tesseract', found: false, confidence: 'faible',
    partial_data: data,
    message: 'Données partielles extraites. Vous pouvez compléter manuellement.'
  });
});

// ─── 3. OCR ingrédients texte brut ───────────────────────────────────────────
router.post('/ingredients', auth, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Texte des ingrédients manquant' });

  const result = await extractFromIngredientsText(text);
  if (!result.success) return res.status(422).json({ error: result.error });

  res.json(result.data);
});

// ─── 4. Sauvegarde manuelle d'un produit scanné ───────────────────────────────
router.post('/save', auth, async (req, res) => {
  const db = getDB();
  const data = req.body;

  if (!data.name || !data.kcal_per100) {
    return res.status(400).json({ error: 'Nom et calories obligatoires' });
  }

  const product = await saveProductToDB(db, data);
  res.status(201).json({ success: true, product });
});

// ─── 5. Recherche par nom ─────────────────────────────────────────────────────
router.get('/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Terme de recherche manquant' });

  const db = getDB();
  const local = await db.prepare('SELECT * FROM products WHERE name LIKE ? OR brand LIKE ? LIMIT 5').all(`%${q}%`, `%${q}%`);

  if (local.length >= 3) {
    return res.json({ source: 'local', results: local.map(formatProduct) });
  }

  const offResults = await searchByName(q, 8);
  const saved = await Promise.all(offResults.map(p => saveProductToDB(db, p)));

  res.json({ source: 'openfoodfacts', results: [...local.map(formatProduct), ...saved] });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function saveProductToDB(db, data) {
  if (data.barcode) {
    const existing = await db.prepare('SELECT * FROM products WHERE barcode = ?').get(data.barcode);
    if (existing) return formatProduct(existing);
  }

  try {
    const result = await db.prepare(`
      INSERT INTO products (name, brand, emoji, score, kcal_per100, glucides, proteines, lipides, fibres, sel, additifs, comment, category, barcode, image_url)
      VALUES (@name, @brand, @emoji, @score, @kcal_per100, @glucides, @proteines, @lipides, @fibres, @sel, @additifs, @comment, @category, @barcode, @image_url)
    `).run({
      name: data.name || 'Produit inconnu',
      brand: data.brand || '',
      emoji: data.emoji || '🍽️',
      score: data.score || 'B',
      kcal_per100: data.kcal_per100 || 0,
      glucides: data.glucides || 0,
      proteines: data.proteines || 0,
      lipides: data.lipides || 0,
      fibres: data.fibres || 0,
      sel: data.sel || 0,
      additifs: typeof data.additifs === 'string' ? data.additifs : JSON.stringify(data.additifs || []),
      comment: data.comment || '',
      category: data.category || 'divers',
      barcode: data.barcode || null,
      image_url: data.image_url || null
    });

    const saved = await db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    return formatProduct(saved);
  } catch (err) {
    if (data.barcode) {
      const existing = await db.prepare('SELECT * FROM products WHERE barcode = ?').get(data.barcode);
      if (existing) return formatProduct(existing);
    }
    throw err;
  }
}

function formatProduct(p) {
  return {
    ...p,
    additifs: typeof p.additifs === 'string' ? JSON.parse(p.additifs) : (p.additifs || []),
    per100: { glucides: p.glucides, proteines: p.proteines, lipides: p.lipides, fibres: p.fibres, sel: p.sel }
  };
}

module.exports = router;
