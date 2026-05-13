const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { lookupBarcode, searchByName } = require('../services/openfoodfacts');
const { extractNutritionFromImage, extractFromIngredientsText } = require('../services/ocr');

const router = express.Router();

// Multer en mémoire (pas de fichier sur disque)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptées'));
  }
});

// ─── 1. Lookup code-barres ────────────────────────────────────────────────────
// GET /api/scanner/barcode/:code
router.get('/barcode/:code', auth, async (req, res) => {
  const { code } = req.params;
  const db = getDB();

  // 1. Chercher dans notre base locale d'abord
  const local = db.prepare('SELECT * FROM products WHERE barcode = ?').get(code);
  if (local) {
    return res.json({
      source: 'local',
      found: true,
      product: formatProduct(local)
    });
  }

  // 2. Chercher sur OpenFoodFacts
  const offProduct = await lookupBarcode(code);
  if (offProduct) {
    // Sauvegarder dans notre base pour les prochaines fois
    const saved = saveProductToDB(db, offProduct);
    return res.json({
      source: 'openfoodfacts',
      found: true,
      product: saved
    });
  }

  // 3. Produit inconnu — demander un scan OCR
  return res.json({
    source: null,
    found: false,
    barcode: code,
    message: 'Produit inconnu. Scannez la liste des ingrédients ou les valeurs nutritionnelles.',
    next_step: 'ocr'
  });
});

// ─── 2. OCR étiquette nutritionnelle ─────────────────────────────────────────
// POST /api/scanner/ocr
router.post('/ocr', auth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image manquante' });

  const base64 = req.file.buffer.toString('base64');
  const mediaType = req.file.mimetype;
  const barcode = req.body.barcode || null;

  const result = await extractNutritionFromImage(base64, mediaType);

  if (!result.success) {
    return res.status(422).json({ error: result.error });
  }

  const data = result.data;

  // Sauvegarder le produit si les données sont suffisantes
  if (data.kcal_per100 > 0 && data.name) {
    const db = getDB();
    const product = saveProductToDB(db, {
      ...data,
      barcode: barcode || null
    });

    return res.json({
      source: 'ocr_claude',
      found: true,
      confidence: data.confiance || 'moyenne',
      product,
      raw_ocr: data
    });
  }

  // Données insuffisantes — renvoyer quand même pour correction manuelle
  return res.json({
    source: 'ocr_claude',
    found: false,
    confidence: 'faible',
    partial_data: data,
    message: 'Données partielles extraites. Vous pouvez compléter manuellement.'
  });
});

// ─── 3. OCR ingrédients texte brut ───────────────────────────────────────────
// POST /api/scanner/ingredients
router.post('/ingredients', auth, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Texte des ingrédients manquant' });

  const result = await extractFromIngredientsText(text);
  if (!result.success) return res.status(422).json({ error: result.error });

  res.json(result.data);
});

// ─── 4. Sauvegarde manuelle d'un produit scanné ───────────────────────────────
// POST /api/scanner/save
router.post('/save', auth, async (req, res) => {
  const db = getDB();
  const data = req.body;

  if (!data.name || !data.kcal_per100) {
    return res.status(400).json({ error: 'Nom et calories obligatoires' });
  }

  const product = saveProductToDB(db, data);
  res.status(201).json({ success: true, product });
});

// ─── 5. Recherche par nom (si barcode inconnu et pas d'image) ─────────────────
// GET /api/scanner/search?q=couscous
router.get('/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Terme de recherche manquant' });

  // D'abord dans notre base
  const db = getDB();
  const local = db.prepare('SELECT * FROM products WHERE name LIKE ? OR brand LIKE ? LIMIT 5').all(`%${q}%`, `%${q}%`);

  if (local.length >= 3) {
    return res.json({ source: 'local', results: local.map(formatProduct) });
  }

  // Ensuite OpenFoodFacts
  const offResults = await searchByName(q, 8);
  const saved = offResults.map(p => saveProductToDB(db, p));

  res.json({ source: 'openfoodfacts', results: [...local.map(formatProduct), ...saved] });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saveProductToDB(db, data) {
  // Vérifier si le produit existe déjà (par barcode)
  if (data.barcode) {
    const existing = db.prepare('SELECT * FROM products WHERE barcode = ?').get(data.barcode);
    if (existing) return formatProduct(existing);
  }

  try {
    const result = db.prepare(`
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

    const saved = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    return formatProduct(saved);
  } catch (err) {
    // En cas de conflit de barcode, récupérer l'existant
    if (data.barcode) {
      const existing = db.prepare('SELECT * FROM products WHERE barcode = ?').get(data.barcode);
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
