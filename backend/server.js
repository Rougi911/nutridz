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
app.set('trust proxy', 1); // Render/Heroku proxy — needed for express-rate-limit

const allowedOrigins = [
  'https://nutridz-web.onrender.com',
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
app.use(express.json());

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

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
const dishesRoutes = require('./routes/dishes');
app.use('/api/dishes', dishesRoutes);
const nutritionRoutes = require('./routes/nutrition');
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/modifiers', require('./routes/modifiers'));
app.use('/api/weight', require('./routes/weight'));
app.use('/api/glucose', require('./routes/glucose'));
app.use('/api/voice', require('./routes/voice'));
app.use('/api/favorites', require('./routes/favorites'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// Gestion d'erreurs globale
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Init DB puis démarrage
initDB()
  .then(() => app.listen(PORT, () => {
    console.log(`NutriDZ API v2 démarrée sur le port ${PORT}`);
    console.log(`CORS origines autorisées : ${allowedOrigins.join(', ')}`);
  }))
  .catch(err => { console.error('Échec init DB:', err); process.exit(1); });

module.exports = app;
