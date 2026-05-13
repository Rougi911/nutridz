const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../db');

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

module.exports = router;
