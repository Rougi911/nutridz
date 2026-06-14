const express = require('express');
const { getDB } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/profile
router.get('/', auth, async (req, res) => {
  const db = getDB();
  const profile = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.userId);
  const user = await db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(req.userId);
  if (!profile) return res.status(404).json({ error: 'Profil non trouvé' });

  const computed = computeMetrics(profile);
  res.json({ ...profile, ...computed, user });
});

// PUT /api/profile
router.put('/', auth, async (req, res) => {
  const db = getDB();
  const { age, weight, height, sexe, activity_level, sport, goal, pace } = req.body;

  await db.prepare(`
    UPDATE profiles SET age=COALESCE(?,age), weight=COALESCE(?,weight), height=COALESCE(?,height),
    sexe=COALESCE(?,sexe), activity_level=COALESCE(?,activity_level), sport=COALESCE(?,sport),
    goal=COALESCE(?,goal), pace=COALESCE(?,pace), updated_at=CURRENT_TIMESTAMP
    WHERE user_id=?
  `).run(age, weight, height, sexe, activity_level, sport, goal, pace, req.userId);

  const profile = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.userId);
  res.json({ ...profile, ...computeMetrics(profile) });
});

// POST /api/profile/weight — enregistrer le poids du jour
router.post('/weight', auth, async (req, res) => {
  const { weight, date } = req.body;
  if (!weight) return res.status(400).json({ error: 'Poids manquant' });
  const db = getDB();
  const today = date || new Date().toISOString().split('T')[0];

  await db.prepare('INSERT OR REPLACE INTO weight_history (user_id, weight, date) VALUES (?, ?, ?)').run(req.userId, weight, today);
  await db.prepare('UPDATE profiles SET weight=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(weight, req.userId);
  res.json({ success: true, weight, date: today });
});

// GET /api/profile/weight/history
router.get('/weight/history', auth, async (req, res) => {
  const db = getDB();
  const rows = await db.prepare('SELECT * FROM weight_history WHERE user_id=? ORDER BY date DESC LIMIT 30').all(req.userId);
  res.json(rows);
});

function computeMetrics(p) {
  const levelFactor = { sed: 1.2, light: 1.375, mod: 1.55, actif: 1.725 };
  const paceDeficit = { doux: 250, modere: 500, rapide: 750 };
  const paceSurplus = { doux: 200, modere: 350, rapide: 500 };

  const bmr = p.sexe === 'h'
    ? Math.round(88.362 + 13.397 * p.weight + 4.799 * p.height - 5.677 * p.age)
    : Math.round(447.593 + 9.247 * p.weight + 3.098 * p.height - 4.330 * p.age);

  const tdee = Math.round(bmr * (levelFactor[p.activity_level] || 1.375));

  let target = tdee;
  if (p.goal === 'perte') target = tdee - (paceDeficit[p.pace] || 500);
  else if (p.goal === 'prise') target = tdee + (paceSurplus[p.pace] || 350);

  const imc = parseFloat((p.weight / (p.height / 100) ** 2).toFixed(1));
  const imcStatus = imc < 18.5 ? 'Insuffisant' : imc < 25 ? 'Normal' : imc < 30 ? 'Surpoids' : 'Obésité';

  return { bmr, tdee, target_kcal: target, imc, imc_status: imcStatus };
}

// DELETE /api/profile/reset-data — tout supprimer sauf le compte
router.delete('/reset-data', auth, async (req, res) => {
  const db = getDB();
  try {
    await db.prepare('DELETE FROM journal_entries WHERE user_id = ?').run(req.userId);
    await db.prepare('DELETE FROM weight_entries WHERE user_id = ?').run(req.userId);
    await db.prepare('DELETE FROM glucose_readings WHERE user_id = ?').run(req.userId);
    await db.prepare('DELETE FROM favorites WHERE user_id = ?').run(req.userId);
    res.json({ success: true, message: 'All user data deleted' });
  } catch (err) {
    console.error('[profile] reset-data error:', err.message);
    res.status(500).json({ error: 'Erreur interne lors de la suppression des données' });
  }
});

module.exports = router;
