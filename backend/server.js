require('dotenv').config();

// DEF-12: refuse to start without JWT_SECRET — no insecure fallback
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET non défini. Définir la variable d\'environnement.');
  process.exit(1);
}

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
app.set('trust proxy', 1); // Render/Heroku proxy — needed for express-rate-limit

const allowedOrigins = [
  'https://nutridz-web.onrender.com',
  'https://nutrivita-v0.onrender.com', // production frontend (Phase 4)
  'http://localhost:3000',
  'http://localhost:19006',
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate limiting — mounted BEFORE body parsers so the counter runs before large payloads
// are buffered in memory (prevents memory-based DoS on unauthenticated requests).
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// Route-specific large body limit for /api/interpret (base64 image in JSON payload).
// Must be mounted BEFORE the global express.json() so body-parser picks up this limit first.
// /api/vision uses multer (multipart) — unaffected by express.json limits.
// Global limit stays at 1 MB to limit DoS surface on all other routes (login, search, etc.).
app.use('/api/interpret', express.json({ limit: '15mb' }));
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', authRoutes); // /export and /account (RGPD)
app.use('/api/products', productsRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/scanner', scannerRoutes);
const visionRoutes = require('./routes/vision');
app.use('/api/vision', visionRoutes);
const activityRoutes = require('./routes/activity');
app.use('/api/activity', activityRoutes);
app.use('/api/activities', activityRoutes); // alias pluriel — contrat frontend P4
const dishesRoutes = require('./routes/dishes');
app.use('/api/dishes', dishesRoutes);
const nutritionRoutes = require('./routes/nutrition');
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/modifiers', require('./routes/modifiers'));
app.use('/api/weight', require('./routes/weight'));
app.use('/api/glucose', require('./routes/glucose'));
app.use('/api/voice', require('./routes/voice'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/interpret', require('./routes/interpret'));
app.use('/api/scan',    require('./routes/scan'));
app.use('/api/groceries', require('./routes/scan'));
app.use('/api/strava',  require('./routes/strava'));
app.use('/api/stats',   require('./routes/deficiencies'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// Global error handler — MUST remain after all routes.
// Re-applies CORS headers so error responses (413, 400, 500) are readable by the browser.
// Without this, body-parser errors escape CORS middleware and become opaque network errors.
app.use((err, req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Credentials', 'true');
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Image trop volumineuse (limite 15 Mo)' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corps JSON invalide' });
  }

  console.error('[server] unhandled error:', err.stack || err.message);
  res.status(err.status || 500).json({ error: 'Erreur interne du serveur' });
});

// Init DB puis démarrage
initDB()
  .then(() => app.listen(PORT, () => {
    console.log(`NutriDZ API v2 démarrée sur le port ${PORT}`);
    console.log(`CORS origines autorisées : ${allowedOrigins.join(', ')}`);
  }))
  .catch(err => { console.error('Échec init DB:', err); process.exit(1); });

module.exports = app;
