require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDB } = require('./db');

const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const journalRoutes = require('./routes/journal');
const profileRoutes = require('./routes/profile');
const scannerRoutes = require('./routes/scanner');

const app = express();
const PORT = process.env.PORT || 3001;

// Sécurité
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/scanner', scannerRoutes);
const visionRoutes = require('./routes/vision');
app.use('/api/vision', visionRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// Gestion d'erreurs globale
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Init DB puis démarrage
initDB();
app.listen(PORT, () => console.log(`NutriDZ API démarrée sur le port ${PORT}`));

module.exports = app;
