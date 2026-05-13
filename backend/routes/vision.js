const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { analyzeDishPhoto, analyzeMultiplePhotos, refineAnalysis } = require('../services/foodvision');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Image requise'));
  }
});

// ─── POST /api/vision/analyze ─────────────────────────────────────────────────
// Analyse une photo de plat
router.post('/analyze', auth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image manquante' });

  // Récupérer le profil pour personnaliser les conseils
  const db = getDB();
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.userId);

  const base64 = req.file.buffer.toString('base64');
  const context = {
    weight: profile?.weight || 70,
    goal: profile?.goal || 'maintien',
    mealType: req.body.meal_type || null
  };

  const result = await analyzeDishPhoto(base64, req.file.mimetype, context);

  if (!result.success) {
    return res.status(422).json({ error: result.error, conseil: result.conseil });
  }

  // Sauvegarder l'analyse dans l'historique
  const analysisId = uuidv4();
  db.prepare(`
    INSERT OR IGNORE INTO dish_analyses
    (id, user_id, plat_identifie, kcal, data, created_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    analysisId,
    req.userId,
    result.data.plat_identifie,
    result.data.totaux.kcal,
    JSON.stringify(result.data)
  );

  res.json({ id: analysisId, ...result.data });
});

// ─── POST /api/vision/analyze-multi ──────────────────────────────────────────
// Analyse plusieurs photos du même plat
router.post('/analyze-multi', auth, upload.array('images', 3), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Images manquantes' });

  const db = getDB();
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.userId);

  const images = req.files.map(f => ({
    base64: f.buffer.toString('base64'),
    mediaType: f.mimetype
  }));

  const result = await analyzeMultiplePhotos(images, { weight: profile?.weight || 70 });

  if (!result.success) return res.status(422).json({ error: result.error });

  res.json(result.data);
});

// ─── POST /api/vision/refine ──────────────────────────────────────────────────
// Affiner une analyse avec une correction textuelle
router.post('/refine', auth, async (req, res) => {
  const { analysis_id, correction } = req.body;
  if (!analysis_id || !correction) return res.status(400).json({ error: 'Paramètres manquants' });

  const db = getDB();
  const row = db.prepare('SELECT * FROM dish_analyses WHERE id = ? AND user_id = ?').get(analysis_id, req.userId);
  if (!row) return res.status(404).json({ error: 'Analyse non trouvée' });

  const previousAnalysis = JSON.parse(row.data);
  const result = await refineAnalysis(previousAnalysis, correction);

  if (!result.success) return res.status(422).json({ error: result.error });

  // Mettre à jour l'analyse
  db.prepare('UPDATE dish_analyses SET data = ?, kcal = ? WHERE id = ?').run(
    JSON.stringify(result.data),
    result.data.totaux?.kcal || row.kcal,
    analysis_id
  );

  res.json({ id: analysis_id, ...result.data });
});

// ─── POST /api/vision/add-to-journal ─────────────────────────────────────────
// Ajoute tous les aliments d'une analyse au journal
router.post('/add-to-journal', auth, async (req, res) => {
  const { analysis_id, meal_type, date, selected_items } = req.body;
  if (!analysis_id || !meal_type) return res.status(400).json({ error: 'Paramètres manquants' });

  const db = getDB();
  const row = db.prepare('SELECT * FROM dish_analyses WHERE id = ? AND user_id = ?').get(analysis_id, req.userId);
  if (!row) return res.status(404).json({ error: 'Analyse non trouvée' });

  const analysis = JSON.parse(row.data);
  const today = date || new Date().toISOString().split('T')[0];

  // Créer ou trouver les produits pour chaque aliment détecté
  const added = [];
  const aliments = selected_items
    ? analysis.aliments.filter((_, i) => selected_items.includes(i))
    : analysis.aliments;

  for (const aliment of aliments) {
    // Chercher si le produit existe déjà
    let product = db.prepare('SELECT * FROM products WHERE name LIKE ? LIMIT 1').get(`%${aliment.nom}%`);

    // Sinon le créer à la volée
    if (!product) {
      const result = db.prepare(`
        INSERT INTO products (name, brand, emoji, score, kcal_per100, glucides, proteines, lipides, fibres, sel, additifs, comment, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        aliment.nom, 'Estimé par IA', aliment.emoji || '🍽️', 'B',
        aliment.quantite_g > 0 ? Math.round(aliment.kcal / aliment.quantite_g * 100) : 0,
        aliment.quantite_g > 0 ? Math.round(aliment.glucides / aliment.quantite_g * 100) : 0,
        aliment.quantite_g > 0 ? Math.round(aliment.proteines / aliment.quantite_g * 100) : 0,
        aliment.quantite_g > 0 ? Math.round(aliment.lipides / aliment.quantite_g * 100) : 0,
        aliment.quantite_g > 0 ? Math.round(aliment.fibres / aliment.quantite_g * 100) : 0,
        0, '[]', `Estimé par analyse IA — ${analysis.plat_identifie}`, 'divers'
      );
      product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    }

    const ratio = aliment.quantite_g / 100;
    const entry = {
      id: uuidv4(),
      user_id: req.userId,
      date: today,
      meal_type,
      product_id: product.id,
      grams: aliment.quantite_g,
      kcal: aliment.kcal || Math.round(product.kcal_per100 * ratio),
      glucides: aliment.glucides || Math.round(product.glucides * ratio * 10) / 10,
      proteines: aliment.proteines || Math.round(product.proteines * ratio * 10) / 10,
      lipides: aliment.lipides || Math.round(product.lipides * ratio * 10) / 10,
      fibres: aliment.fibres || Math.round(product.fibres * ratio * 10) / 10
    };

    db.prepare(`
      INSERT INTO journal_entries (id, user_id, date, meal_type, product_id, grams, kcal, glucides, proteines, lipides, fibres)
      VALUES (@id, @user_id, @date, @meal_type, @product_id, @grams, @kcal, @glucides, @proteines, @lipides, @fibres)
    `).run(entry);

    added.push({ ...entry, name: aliment.nom, emoji: aliment.emoji });
  }

  res.json({
    success: true,
    added_count: added.length,
    total_kcal: added.reduce((s, e) => s + e.kcal, 0),
    entries: added
  });
});

// ─── GET /api/vision/history ──────────────────────────────────────────────────
router.get('/history', auth, (req, res) => {
  const db = getDB();
  const rows = db.prepare(
    'SELECT id, plat_identifie, kcal, created_at FROM dish_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(req.userId);
  res.json(rows);
});

// ─── GET /api/vision/:id ──────────────────────────────────────────────────────
router.get('/:id', auth, (req, res) => {
  const db = getDB();
  const row = db.prepare('SELECT * FROM dish_analyses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Non trouvé' });
  res.json({ id: row.id, ...JSON.parse(row.data), created_at: row.created_at });
});

module.exports = router;
