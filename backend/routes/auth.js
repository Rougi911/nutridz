const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'nutridz_secret_key';

// POST /api/auth/register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password, name } = req.body;
  const db = getDB();

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = uuidv4();

  await db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(userId, email, passwordHash, name);
  await db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(userId);

  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, user: { id: userId, email, name } });
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  const db = getDB();

  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

// GET /api/user/export — RGPD data portability
router.get('/export', auth, async (req, res) => {
  const db = getDB();
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const since = twoYearsAgo.toISOString().split('T')[0];

  const [user, profile, journal, activities, dishAnalyses, weightHistory] = await Promise.all([
    db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(req.userId),
    db.prepare('SELECT age, weight, height, sexe, activity_level, sport, goal, pace, strava_athlete_name FROM profiles WHERE user_id = ?').get(req.userId),
    db.prepare('SELECT date, meal_type, grams, kcal, glucides, proteines, lipides, logged_at FROM journal_entries WHERE user_id = ? AND date >= ? ORDER BY date DESC').all(req.userId, since),
    db.prepare('SELECT date, type, duration_min, distance_km, calories_burned, source, created_at FROM activities WHERE user_id = ? AND date >= ? ORDER BY date DESC').all(req.userId, since),
    db.prepare('SELECT plat_identifie, kcal, created_at FROM dish_analyses WHERE user_id = ? ORDER BY created_at DESC').all(req.userId),
    db.prepare('SELECT weight, date FROM weight_history WHERE user_id = ? ORDER BY date DESC').all(req.userId),
  ]);

  const payload = {
    export_date: new Date().toISOString(),
    retention_period: '2 years',
    user,
    profile,
    journal_entries: journal,
    activities,
    dish_analyses: dishAnalyses,
    weight_history: weightHistory,
  };

  res.setHeader('Content-Disposition', `attachment; filename="nutrivita-data-${req.userId.slice(0, 8)}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(payload);
});

// DELETE /api/user/account — RGPD right to erasure
router.delete('/account', auth, async (req, res) => {
  const db = getDB();
  const userId = req.userId;

  // Explicit cascade since SQLite foreign_keys may not be enabled
  await db.prepare('DELETE FROM journal_entries WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM activities WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM dish_analyses WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM weight_history WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM profiles WHERE user_id = ?').run(userId);
  await db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  console.log(`[RGPD] Account deleted for userId=${userId}`);
  res.json({ success: true, message: 'Compte et données supprimés définitivement.' });
});

module.exports = router;
