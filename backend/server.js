require('dotenv').config();

// DEF-12: refuse to start without JWT_SECRET — no insecure fallback
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET non défini. Définir la variable d\'environnement.');
  process.exit(1);
}

// S20 — Observabilité : initialiser Sentry au plus tôt (no-op si SENTRY_DSN absent,
// aucun crash). Région EU + scrubbing PII/glycémie gérés dans le module.
const { initSentry, setupErrorHandler } = require('./observability/sentry');
initSentry();

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

// Origines autorisées : localhost UNIQUEMENT hors production (audit sécurité M-1).
const allowedOrigins = [
  'https://nutrivita-v0.onrender.com', // production frontend
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:3000', 'http://localhost:19006']
    : []),
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate limiting — mounted BEFORE body parsers so the counter runs before large payloads
// are buffered in memory (prevents memory-based DoS on unauthenticated requests).
// S22/DEF-11 : 100/15 min était trop bas — au chargement l'app appelle journal + journal/range
// + glucose + weight + activities + profil + additifs, plus le polling. Un seul utilisateur actif
// pouvait approcher la limite et basculer hors-ligne (429). Relevé à 300/15 min (20/min), l'auth
// gardant son limiteur strict (10/15 min). Les préflights CORS (OPTIONS) ne consomment plus le quota.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});
app.use('/api/', limiter);

// Rate-limit renforcé sur l'authentification (anti brute-force — audit sécurité M-2)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
});
app.use('/api/auth', authLimiter);

// Route-specific large body limit for /api/interpret (base64 image in JSON payload).
// Must be mounted BEFORE the global express.json() so body-parser picks up this limit first.
// /api/vision uses multer (multipart) — unaffected by express.json limits.
// Global limit stays at 1 MB to limit DoS surface on all other routes (login, search, etc.).
app.use('/api/interpret',   express.json({ limit: '15mb' }));
app.use('/api/scan/label',  express.json({ limit: '15mb' })); // B-1: base64 image payload
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
// /api/foods/search — alias contrat frontend (P4.16 — SL-API)
app.use('/api/foods', require('./routes/foods'));
app.use('/api/modifiers', require('./routes/modifiers'));
app.use('/api/weight', require('./routes/weight'));
app.use('/api/glucose', require('./routes/glucose'));
app.use('/api/voice', require('./routes/voice'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/interpret', require('./routes/interpret'));
app.use('/api/scan',    require('./routes/scan'));
app.use('/api/groceries', require('./routes/scan'));
app.use('/api/scanned', require('./routes/scanned'));
app.use('/api/alternatives', require('./routes/alternatives')); // S12
app.use('/api/strava',  require('./routes/strava'));
app.use('/api/stats',   require('./routes/deficiencies'));
app.use('/api/stats',   require('./routes/stats-additives'));
app.use('/api/suggestions', require('./routes/suggestions')); // S27 — carences → aliments de saison

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));
// P1-8 : endpoint léger hors /api (non rate-limité) pour le keep-warm anti cold-start Render
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// S20 — Capture des erreurs de routes par Sentry (no-op si désactivé).
// DOIT être monté APRÈS toutes les routes et AVANT le handler d'erreurs final.
setupErrorHandler(app);

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

// Init DB puis démarrage — uniquement quand exécuté directement (`node server.js`).
// Requis comme module (tests), on n'initialise pas la DB et on n'écoute pas.
if (require.main === module) {
  initDB()
    .then(() => app.listen(PORT, () => {
      console.log(`NutriDZ API v2 démarrée sur le port ${PORT}`);
      console.log(`CORS origines autorisées : ${allowedOrigins.join(', ')}`);
    }))
    .then(() => {
      // S26 — planificateur de rappels push : vérifie chaque minute les heures configurées.
      // No-op total si les clés VAPID ne sont pas définies (le serveur tourne sans).
      const { isPushEnabled, sendDueReminders } = require('./services/pushSender');
      if (isPushEnabled()) {
        const { getDB } = require('./db');
        setInterval(() => {
          sendDueReminders(getDB()).catch((e) => console.error('[reminders]', e.message));
        }, 60 * 1000);
        console.log('[S26] Planificateur de rappels push actif (VAPID configuré).');
      }
    })
    .catch(err => { console.error('Échec init DB:', err); process.exit(1); });
}

module.exports = app;
