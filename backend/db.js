'use strict';
/**
 * S7 — Couche d'accès PostgreSQL (migration SQLite → pg).
 *
 * Garde l'interface historique : `getDB().prepare(sql).get/all/run()`, `exec()`,
 * `withClient()`, `transaction()`. Les routes ne changent pas leur façon d'appeler la DB ;
 * seules les requêtes au SQL spécifiquement SQLite ont été portées (RETURNING, ON CONFLICT,
 * fonctions date). Voir PLAN-MIGRATION-S7-POSTGRES.md.
 *
 * Connexions : pool petit (max 5) sur la chaîne POOLED Neon (pgbouncer mode transaction).
 * Conséquence : aucun prepared statement nommé (on envoie toujours texte + valeurs).
 */

const { Pool, types } = require('pg');
const { applyTranslations } = require('./scripts/applyDishTranslations');
const { CONDIMENTS } = require('./data/condiments');

// pg renvoie int8 (bigint) et numeric en chaînes par défaut. On force le type number
// pour coller au comportement SQLite (ex. COUNT(*) → number, REAL → number).
types.setTypeParser(20, v => (v === null ? null : parseInt(v, 10)));    // int8 / bigint
types.setTypeParser(1700, v => (v === null ? null : parseFloat(v)));    // numeric / decimal

// ─── Connexion ────────────────────────────────────────────────────────────────

function getConnectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL non défini — requis depuis la migration Postgres (S7).');
  }
  return url;
}

function isLocalUrl(url) {
  return /@(localhost|127\.0\.0\.1)[:/]/.test(url) || /sslmode=disable/.test(url);
}

// Schéma dédié par worker Jest pour isoler les tests qui tournent en parallèle (S7d).
function testSchema() {
  const w = process.env.JEST_WORKER_ID;
  return w ? `test_w${w}` : null;
}

function buildPool(connectionString) {
  const schema = testSchema();
  const cfg = {
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: true,
    statement_timeout: 15000,
    ssl: isLocalUrl(connectionString) ? false : { rejectUnauthorized: false },
  };
  if (schema) cfg.options = `-c search_path=${schema}`;
  return new Pool(cfg);
}

// ─── Statement : traduction des paramètres `?` / `@clé` → `$n` ────────────────

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

class Statement {
  constructor(db, sql) {
    this._db = db;
    this._sql = sql;
  }

  // Retourne { text, values } prêt pour pg.
  _prepare(args) {
    // Mode nommé : un seul argument objet → placeholders `@clé`.
    if (args.length === 1 && isPlainObject(args[0])) {
      const obj = args[0];
      const values = [];
      const seen = {};
      const text = this._sql.replace(/@(\w+)/g, (m, key) => {
        if (!(key in obj)) return m; // littéral éventuel — on ne touche pas
        if (seen[key] === undefined) {
          values.push(obj[key]);
          seen[key] = `$${values.length}`;
        }
        return seen[key];
      });
      return { text, values };
    }
    // Mode positionnel : placeholders `?` dans l'ordre.
    const values = args;
    let i = 0;
    const text = this._sql.replace(/\?/g, () => `$${++i}`);
    return { text, values };
  }

  async get(...args) {
    const { text, values } = this._prepare(args);
    const r = await this._db._query(text, values);
    return r.rows[0];
  }

  async all(...args) {
    const { text, values } = this._prepare(args);
    const r = await this._db._query(text, values);
    return r.rows;
  }

  async run(...args) {
    let { text, values } = this._prepare(args);
    // Postgres ne renvoie pas d'auto-id sans RETURNING. On l'ajoute aux INSERT
    // pour exposer `lastInsertRowid` (rétro-compatibilité avec l'API SQLite).
    if (/^\s*INSERT\b/i.test(text) && !/\breturning\b/i.test(text)) {
      text = text.trim().replace(/;\s*$/, '') + ' RETURNING *';
    }
    const r = await this._db._query(text, values);
    // ON CONFLICT DO NOTHING ne renvoie aucune ligne → lastInsertRowid undefined.
    return { lastInsertRowid: r.rows[0] ? r.rows[0].id : undefined, changes: r.rowCount };
  }
}

class DB {
  constructor(connectionString) {
    this._connectionString = connectionString;
    this._pool = buildPool(connectionString);
  }

  get pool() { return this._pool; }

  prepare(sql) { return new Statement(this, sql); }

  _query(text, values) { return this._pool.query(text, values); }

  // exec() — DDL multi-instructions, sans paramètres.
  async exec(sql) { await this._pool.query(sql); }

  // Vérifie la connexion ; si la chaîne Neon échoue via le pooler à cause du
  // channel binding (SASL), on retire `channel_binding` et on reconstruit le pool.
  async ensureConnected() {
    try {
      await this._pool.query('SELECT 1');
    } catch (err) {
      const msg = String(err && err.message);
      if (/channel binding|channel_binding|SASL/i.test(msg) && /channel_binding/.test(this._connectionString)) {
        console.warn('[db] channel_binding incompatible avec le pooler → retrait et reconnexion');
        await this._pool.end().catch(() => {});
        this._connectionString = this._connectionString
          .replace(/([?&])channel_binding=[^&]*/i, '$1')
          .replace(/[?&]$/, '');
        this._pool = buildPool(this._connectionString);
        await this._pool.query('SELECT 1');
      } else {
        throw err;
      }
    }
  }

  // Client dédié, libéré dans un finally (évite l'épuisement du pool).
  async withClient(fn) {
    const client = await this._pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  // Transaction sur un client dédié. `fn` reçoit le client lié à la transaction.
  transaction(fn) {
    const self = this;
    return async function (items) {
      return self.withClient(async (client) => {
        await client.query('BEGIN');
        try {
          const out = await fn(client, items);
          await client.query('COMMIT');
          return out;
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        }
      });
    };
  }

  async close() { await this._pool.end(); }
}

let db;

function getDB() {
  if (!db) {
    db = new DB(getConnectionString());
  }
  return db;
}

async function initDB() {
  const db = getDB();
  await db.ensureConnected();

  // Schéma de test isolé par worker Jest (idempotent).
  const schema = testSchema();
  if (schema) await db.exec(`CREATE SCHEMA IF NOT EXISTS ${schema}`);

  await db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    age INTEGER DEFAULT 30,
    weight REAL DEFAULT 70,
    height INTEGER DEFAULT 170,
    sexe TEXT DEFAULT 'h',
    activity_level TEXT DEFAULT 'light',
    sport TEXT DEFAULT 'marche',
    goal TEXT DEFAULT 'maintien',
    pace TEXT DEFAULT 'modere',
    updated_at TIMESTAMPTZ DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    emoji TEXT DEFAULT '🍽️',
    score TEXT DEFAULT 'B',
    kcal_per100 REAL NOT NULL,
    glucides REAL DEFAULT 0,
    proteines REAL DEFAULT 0,
    lipides REAL DEFAULT 0,
    fibres REAL DEFAULT 0,
    sel REAL DEFAULT 0,
    additifs TEXT DEFAULT '[]',
    comment TEXT DEFAULT '',
    image_url TEXT,
    category TEXT DEFAULT 'divers',
    is_algerian INTEGER DEFAULT 1,
    source TEXT DEFAULT NULL,
    portion_default_g INTEGER DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    grams REAL NOT NULL,
    kcal REAL NOT NULL,
    glucides REAL DEFAULT 0,
    proteines REAL DEFAULT 0,
    lipides REAL DEFAULT 0,
    fibres REAL DEFAULT 0,
    modifiers_json TEXT DEFAULT '[]',
    parent_entry_id TEXT DEFAULT NULL,
    logged_at TIMESTAMPTZ DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS weight_entries (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    body_fat_pct REAL,
    date TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, date)
  )`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_weight_user_date ON weight_entries(user_id, date DESC)`);

  await db.exec(`CREATE TABLE IF NOT EXISTS glucose_readings (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    glucose_mg_dl REAL NOT NULL,
    reading_type TEXT CHECK(reading_type IN ('fasting', 'pre_meal', 'post_meal', 'bedtime', 'random', 'cgm')) NOT NULL,
    timestamp TEXT NOT NULL,
    notes TEXT,
    source TEXT DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT now()
  )`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_glucose_user_timestamp ON glucose_readings(user_id, timestamp DESC)`);

  await db.exec(`CREATE TABLE IF NOT EXISTS dishes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    name_fr TEXT,
    name_ar TEXT,
    name_en TEXT,
    description_fr TEXT,
    description_ar TEXT,
    description_en TEXT,
    emoji TEXT,
    cuisine TEXT,
    category TEXT,
    description TEXT,
    default_portion_g INTEGER,
    kcal_per_portion INTEGER,
    glucides REAL,
    proteines REAL,
    lipides REAL,
    fibres REAL,
    ingredients_json TEXT,
    difficulty TEXT,
    prep_time_min INTEGER,
    cook_time_min INTEGER,
    is_user_created INTEGER DEFAULT 0,
    created_by_user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    dish_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, dish_id),
    FOREIGN KEY (dish_id) REFERENCES dishes(id)
  )`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)`);

  await db.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    subscription_json TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS dish_analyses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plat_identifie TEXT,
    kcal REAL,
    data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // S7b — colonne `name` ajoutée (l'insert du webhook strava.js la référence).
  await db.exec(`CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT,
    duration_min INTEGER DEFAULT 0,
    distance_km REAL DEFAULT 0,
    calories_burned REAL DEFAULT 0,
    source TEXT DEFAULT 'manual',
    strava_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // SL-API-02/03 — produits scannés. S7b : colonne `scan_month` (YYYY-MM) + index unique
  // → upsert atomique par (user, barcode, mois) en remplacement de l'upsert applicatif racy.
  await db.exec(`CREATE TABLE IF NOT EXISTS scanned_products (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    barcode TEXT NOT NULL,
    product_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    verdict TEXT NOT NULL CHECK(verdict IN ('Excellent','Médiocre','Mauvais')),
    additives_json TEXT DEFAULT '[]',
    nutri_score TEXT,
    nova INTEGER,
    sugars_g REAL DEFAULT 0,
    salt_g REAL DEFAULT 0,
    sat_fat_g REAL DEFAULT 0,
    image_url TEXT DEFAULT NULL,
    nutriscore_source TEXT DEFAULT NULL,
    scan_month TEXT,
    times_this_month INTEGER DEFAULT 1,
    scanned_at TIMESTAMPTZ DEFAULT now()
  )`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_scanned_user_date ON scanned_products(user_id, scanned_at)`);
  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_scanned_user_barcode_month ON scanned_products(user_id, barcode, scan_month)`);

  // S7e — cache OpenFoodFacts persistant (remplace le cache mémoire volatil).
  await db.exec(`CREATE TABLE IF NOT EXISTS off_cache (
    barcode TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT now()
  )`);

  // ── Colonnes ajoutées au fil de l'eau (idempotent, natif Postgres) ──────────
  const addColumns = [
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL',
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS portion_default_g INTEGER DEFAULT NULL',
    'ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS parent_entry_id TEXT DEFAULT NULL',
    'ALTER TABLE activities ADD COLUMN IF NOT EXISTS name TEXT',
    'ALTER TABLE scanned_products ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL',
    'ALTER TABLE scanned_products ADD COLUMN IF NOT EXISTS nutriscore_source TEXT DEFAULT NULL',
    'ALTER TABLE scanned_products ADD COLUMN IF NOT EXISTS scan_month TEXT',
    'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS strava_access_token TEXT',
    'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT',
    'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS strava_athlete_id TEXT',
    'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS strava_token_expires_at BIGINT',
    'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS strava_athlete_name TEXT',
    'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_glucose_date TEXT',
    'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_glucose_version TEXT',
    'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS glucose_target_min_mg_dl INTEGER DEFAULT 70',
    'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS glucose_target_max_mg_dl INTEGER DEFAULT 180',
    "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'FR'",
    'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude_approx REAL DEFAULT 46.0',
  ];
  for (const sql of addColumns) await db.exec(sql);

  // weight_history (legacy SQLite) n'existe pas sur Postgres frais — nettoyage idempotent.
  await db.exec('DROP TABLE IF EXISTS weight_history');

  // Nettoyage one-time : retirer les anciens produits de seed (barcodes 619110000000*).
  try {
    const deleted = await db.prepare("DELETE FROM products WHERE barcode LIKE '619110000000%'").run();
    if (deleted.changes > 0) console.log(`🧹 ${deleted.changes} produit(s) de seed supprimé(s)`);
  } catch (_) { /* rien à nettoyer */ }

  await seedDishes();
  await seedCondiments();
  await applyDishTranslationsFromFile();
  console.log('✅ Base de données initialisée (Postgres)');
}

async function seedDishes() {
  const db = getDB();
  const existing = await db.prepare('SELECT COUNT(*) as cnt FROM dishes WHERE is_user_created = 0').get();
  if (existing.cnt > 0) return;

  const dishes = [
    // FRANÇAISE (6)
    { name: 'Steak Frites', name_ar: 'ستيك مع بطاطا مقلية', name_en: 'Steak and Fries', emoji: '🥩', cuisine: 'française', category: 'plat', description: 'Steak de bœuf grillé servi avec des frites dorées', default_portion_g: 450, kcal_per_portion: 720, glucides: 48, proteines: 42, lipides: 36, fibres: 4, difficulty: 'facile', prep_time_min: 10, cook_time_min: 20, ingredients_json: '[{"name":"Steak de bœuf","grams":200},{"name":"Pommes de terre","grams":250},{"name":"Huile","grams":20}]' },
    { name: 'Ratatouille', name_ar: 'راتاتوي', name_en: 'Ratatouille', emoji: '🍲', cuisine: 'française', category: 'plat', description: 'Ragoût de légumes provençal à la tomate', default_portion_g: 350, kcal_per_portion: 180, glucides: 22, proteines: 5, lipides: 8, fibres: 6, difficulty: 'moyen', prep_time_min: 20, cook_time_min: 45, ingredients_json: '[{"name":"Tomates","grams":150},{"name":"Courgettes","grams":100},{"name":"Poivrons","grams":80}]' },
    { name: 'Blanquette de Veau', name_ar: 'بلانكيت العجل', name_en: 'Veal Blanquette', emoji: '🥘', cuisine: 'française', category: 'plat', description: 'Ragoût de veau en sauce blanche crémeuse', default_portion_g: 400, kcal_per_portion: 520, glucides: 30, proteines: 38, lipides: 24, fibres: 2, difficulty: 'difficile', prep_time_min: 30, cook_time_min: 90, ingredients_json: '[{"name":"Veau","grams":200},{"name":"Crème fraîche","grams":50},{"name":"Champignons","grams":80}]' },
    { name: 'Quiche Lorraine', name_ar: 'كيش لورين', name_en: 'Quiche Lorraine', emoji: '🥧', cuisine: 'française', category: 'plat', description: 'Tarte salée aux lardons et crème fraîche', default_portion_g: 200, kcal_per_portion: 480, glucides: 28, proteines: 16, lipides: 34, fibres: 1, difficulty: 'moyen', prep_time_min: 20, cook_time_min: 35, ingredients_json: '[{"name":"Pâte brisée","grams":80},{"name":"Lardons","grams":60},{"name":"Crème fraîche","grams":80}]' },
    { name: 'Salade Niçoise', name_ar: 'سلطة نيسواز', name_en: 'Niçoise Salad', emoji: '🥗', cuisine: 'française', category: 'entree', description: 'Salade méditerranéenne au thon, œufs et olives', default_portion_g: 300, kcal_per_portion: 320, glucides: 18, proteines: 24, lipides: 16, fibres: 5, difficulty: 'facile', prep_time_min: 15, cook_time_min: 10, ingredients_json: '[{"name":"Thon en conserve","grams":80},{"name":"Œufs","grams":60},{"name":"Tomates","grams":100}]' },
    { name: 'Croque-Monsieur', name_ar: 'كروك موسيو', name_en: 'Croque-Monsieur', emoji: '🥪', cuisine: 'française', category: 'plat', description: 'Sandwich chaud au jambon et gruyère fondu', default_portion_g: 200, kcal_per_portion: 480, glucides: 42, proteines: 22, lipides: 24, fibres: 2, difficulty: 'facile', prep_time_min: 5, cook_time_min: 10, ingredients_json: '[{"name":"Pain de mie","grams":80},{"name":"Jambon","grams":60},{"name":"Gruyère","grams":50}]' },
    // ITALIENNE (5)
    { name: 'Pizza Margherita', name_ar: 'بيتزا مارغريتا', name_en: 'Margherita Pizza', emoji: '🍕', cuisine: 'italienne', category: 'plat', description: 'Pizza classique à la tomate, mozzarella et basilic', default_portion_g: 300, kcal_per_portion: 660, glucides: 78, proteines: 26, lipides: 22, fibres: 4, difficulty: 'moyen', prep_time_min: 30, cook_time_min: 15, ingredients_json: '[{"name":"Pâte à pizza","grams":180},{"name":"Mozzarella","grams":80},{"name":"Sauce tomate","grams":60}]' },
    { name: 'Spaghetti Carbonara', name_ar: 'سباغيتي كاربونارا', name_en: 'Spaghetti Carbonara', emoji: '🍝', cuisine: 'italienne', category: 'plat', description: 'Pâtes à la pancetta, œuf et pecorino', default_portion_g: 320, kcal_per_portion: 620, glucides: 68, proteines: 24, lipides: 28, fibres: 3, difficulty: 'moyen', prep_time_min: 10, cook_time_min: 15, ingredients_json: '[{"name":"Spaghetti","grams":120},{"name":"Pancetta","grams":60},{"name":"Œufs","grams":60}]' },
    { name: 'Lasagne', name_ar: 'لازانيا', name_en: 'Lasagna', emoji: '🫕', cuisine: 'italienne', category: 'plat', description: 'Lasagne à la bolognaise et béchamel gratinée', default_portion_g: 400, kcal_per_portion: 680, glucides: 58, proteines: 32, lipides: 30, fibres: 4, difficulty: 'difficile', prep_time_min: 40, cook_time_min: 45, ingredients_json: '[{"name":"Feuilles de lasagne","grams":100},{"name":"Bœuf haché","grams":120},{"name":"Béchamel","grams":100}]' },
    { name: 'Risotto', name_ar: 'ريزوتو', name_en: 'Risotto', emoji: '🍚', cuisine: 'italienne', category: 'plat', description: 'Riz crémeux au parmesan et champignons', default_portion_g: 350, kcal_per_portion: 540, glucides: 72, proteines: 14, lipides: 18, fibres: 2, difficulty: 'difficile', prep_time_min: 10, cook_time_min: 30, ingredients_json: '[{"name":"Riz Arborio","grams":130},{"name":"Parmesan","grams":40},{"name":"Champignons","grams":80}]' },
    { name: 'Tiramisu', name_ar: 'تيراميسو', name_en: 'Tiramisu', emoji: '🍮', cuisine: 'italienne', category: 'dessert', description: 'Dessert au mascarpone, café et biscuits', default_portion_g: 150, kcal_per_portion: 420, glucides: 38, proteines: 8, lipides: 24, fibres: 1, difficulty: 'moyen', prep_time_min: 30, cook_time_min: 0, ingredients_json: '[{"name":"Mascarpone","grams":80},{"name":"Biscuits à la cuillère","grams":40},{"name":"Café","grams":30}]' },
    // MAGHRÉBINE (10)
    { name: 'Couscous Royal', name_ar: 'كسكسي ملكي', name_en: 'Royal Couscous', emoji: '🫕', cuisine: 'maghrébine', category: 'plat', description: 'Semoule de blé avec viandes grillées et légumes', default_portion_g: 500, kcal_per_portion: 780, glucides: 95, proteines: 42, lipides: 20, fibres: 8, difficulty: 'difficile', prep_time_min: 30, cook_time_min: 120, ingredients_json: '[{"name":"Semoule","grams":200},{"name":"Agneau","grams":120},{"name":"Merguez","grams":80}]' },
    { name: 'Chorba Frik', name_ar: 'شربة فريك', name_en: 'Chorba Frik', emoji: '🍲', cuisine: 'maghrébine', category: 'plat', description: 'Soupe algérienne au blé vert et agneau', default_portion_g: 400, kcal_per_portion: 320, glucides: 38, proteines: 20, lipides: 8, fibres: 5, difficulty: 'moyen', prep_time_min: 20, cook_time_min: 60, ingredients_json: '[{"name":"Frik (blé vert)","grams":80},{"name":"Agneau","grams":100},{"name":"Tomates","grams":80}]' },
    { name: 'Tajine Poulet', name_ar: 'طاجين الدجاج', name_en: 'Chicken Tajine', emoji: '🍗', cuisine: 'maghrébine', category: 'plat', description: 'Poulet mijoté aux épices, olives et citron confit', default_portion_g: 400, kcal_per_portion: 480, glucides: 15, proteines: 40, lipides: 26, fibres: 3, difficulty: 'moyen', prep_time_min: 20, cook_time_min: 60, ingredients_json: '[{"name":"Poulet","grams":250},{"name":"Olives","grams":40},{"name":"Citron confit","grams":20}]' },
    { name: 'Méchoui', name_ar: 'مشوي', name_en: 'Mechoui', emoji: '🐑', cuisine: 'maghrébine', category: 'plat', description: 'Agneau rôti entier aux épices berbères', default_portion_g: 350, kcal_per_portion: 620, glucides: 0, proteines: 56, lipides: 44, fibres: 0, difficulty: 'difficile', prep_time_min: 30, cook_time_min: 240, ingredients_json: '[{"name":"Agneau","grams":300},{"name":"Ail","grams":10},{"name":"Épices","grams":5}]' },
    { name: 'Harira', name_ar: 'حريرة', name_en: 'Harira', emoji: '🍵', cuisine: 'maghrébine', category: 'plat', description: 'Soupe aux lentilles, tomates et coriandre', default_portion_g: 350, kcal_per_portion: 280, glucides: 36, proteines: 14, lipides: 8, fibres: 7, difficulty: 'moyen', prep_time_min: 15, cook_time_min: 45, ingredients_json: '[{"name":"Lentilles","grams":80},{"name":"Tomates","grams":100},{"name":"Pois chiches","grams":60}]' },
    { name: 'Chakhchoukha', name_ar: 'شخشوخة', name_en: 'Chakhchoukha', emoji: '🫕', cuisine: 'maghrébine', category: 'plat', description: 'Galettes émiettées avec ragoût de viande et légumes', default_portion_g: 450, kcal_per_portion: 640, glucides: 78, proteines: 32, lipides: 18, fibres: 5, difficulty: 'difficile', prep_time_min: 40, cook_time_min: 90, ingredients_json: '[{"name":"Galettes de blé (rougag)","grams":150},{"name":"Agneau","grams":120},{"name":"Pois chiches","grams":80}]' },
    { name: 'Rechta', name_ar: 'رشتة', name_en: 'Rechta', emoji: '🍜', cuisine: 'maghrébine', category: 'plat', description: 'Pâtes algériennes fines à la sauce blanche et poulet', default_portion_g: 400, kcal_per_portion: 560, glucides: 72, proteines: 30, lipides: 14, fibres: 3, difficulty: 'difficile', prep_time_min: 60, cook_time_min: 60, ingredients_json: '[{"name":"Pâtes Rechta","grams":150},{"name":"Poulet","grams":120},{"name":"Navet","grams":80}]' },
    { name: 'Bourek', name_ar: 'بوراك', name_en: 'Bourek', emoji: '🥟', cuisine: 'maghrébine', category: 'entree', description: 'Feuilleté frit farci à la viande hachée et fromage', default_portion_g: 120, kcal_per_portion: 320, glucides: 28, proteines: 14, lipides: 18, fibres: 1, difficulty: 'moyen', prep_time_min: 30, cook_time_min: 10, ingredients_json: '[{"name":"Feuilles de brick","grams":40},{"name":"Bœuf haché","grams":50},{"name":"Fromage fondu","grams":20}]' },
    { name: 'Kefta', name_ar: 'كفتة', name_en: 'Kefta', emoji: '🍢', cuisine: 'maghrébine', category: 'plat', description: 'Boulettes de viande épicées grillées', default_portion_g: 250, kcal_per_portion: 420, glucides: 8, proteines: 36, lipides: 26, fibres: 1, difficulty: 'facile', prep_time_min: 15, cook_time_min: 15, ingredients_json: '[{"name":"Viande hachée","grams":200},{"name":"Oignon","grams":30},{"name":"Épices","grams":5}]' },
    { name: 'Dolma', name_ar: 'دولمة', name_en: 'Dolma', emoji: '🫑', cuisine: 'maghrébine', category: 'plat', description: 'Légumes farcis à la viande et riz', default_portion_g: 350, kcal_per_portion: 460, glucides: 42, proteines: 24, lipides: 20, fibres: 5, difficulty: 'difficile', prep_time_min: 45, cook_time_min: 60, ingredients_json: '[{"name":"Poivrons farcis","grams":200},{"name":"Riz","grams":60},{"name":"Viande hachée","grams":80}]' },
    // MOYEN-ORIENT (7)
    { name: 'Shawarma', name_ar: 'شاورما', name_en: 'Shawarma', emoji: '🌯', cuisine: 'moyen-orient', category: 'plat', description: 'Viande marinée grillée à la broche dans un pain pita', default_portion_g: 350, kcal_per_portion: 580, glucides: 52, proteines: 36, lipides: 22, fibres: 3, difficulty: 'moyen', prep_time_min: 20, cook_time_min: 30, ingredients_json: '[{"name":"Poulet mariné","grams":180},{"name":"Pain pita","grams":80},{"name":"Sauce tahini","grams":30}]' },
    { name: 'Falafel', name_ar: 'فلافل', name_en: 'Falafel', emoji: '🧆', cuisine: 'moyen-orient', category: 'plat', description: 'Boulettes de pois chiches frites aux herbes', default_portion_g: 200, kcal_per_portion: 360, glucides: 38, proteines: 14, lipides: 16, fibres: 8, difficulty: 'moyen', prep_time_min: 30, cook_time_min: 10, ingredients_json: '[{"name":"Pois chiches","grams":150},{"name":"Persil","grams":20},{"name":"Cumin","grams":3}]' },
    { name: 'Hummus', name_ar: 'حمص', name_en: 'Hummus', emoji: '🫙', cuisine: 'moyen-orient', category: 'entree', description: 'Purée de pois chiches au tahini et citron', default_portion_g: 150, kcal_per_portion: 240, glucides: 22, proteines: 8, lipides: 14, fibres: 5, difficulty: 'facile', prep_time_min: 10, cook_time_min: 0, ingredients_json: '[{"name":"Pois chiches","grams":100},{"name":"Tahini","grams":30},{"name":"Citron","grams":20}]' },
    { name: 'Mansaf', name_ar: 'منسف', name_en: 'Mansaf', emoji: '🍖', cuisine: 'moyen-orient', category: 'plat', description: 'Agneau cuit au yaourt fermenté servi sur riz', default_portion_g: 500, kcal_per_portion: 760, glucides: 80, proteines: 48, lipides: 24, fibres: 3, difficulty: 'difficile', prep_time_min: 30, cook_time_min: 120, ingredients_json: '[{"name":"Agneau","grams":200},{"name":"Riz","grams":150},{"name":"Yaourt jameed","grams":100}]' },
    { name: 'Kebab', name_ar: 'كباب', name_en: 'Kebab', emoji: '🍢', cuisine: 'moyen-orient', category: 'plat', description: 'Brochettes de viande épicées grillées au charbon', default_portion_g: 300, kcal_per_portion: 520, glucides: 5, proteines: 44, lipides: 32, fibres: 1, difficulty: 'facile', prep_time_min: 15, cook_time_min: 20, ingredients_json: '[{"name":"Agneau haché","grams":250},{"name":"Oignon","grams":30},{"name":"Épices","grams":5}]' },
    { name: 'Fattoush', name_ar: 'فتوش', name_en: 'Fattoush', emoji: '🥗', cuisine: 'moyen-orient', category: 'entree', description: 'Salade libanaise aux légumes frais et pain grillé', default_portion_g: 250, kcal_per_portion: 200, glucides: 26, proteines: 6, lipides: 8, fibres: 4, difficulty: 'facile', prep_time_min: 15, cook_time_min: 5, ingredients_json: '[{"name":"Tomates","grams":80},{"name":"Concombre","grams":60},{"name":"Pain pita grillé","grams":30}]' },
    { name: 'Taboulé', name_ar: 'تبولة', name_en: 'Tabbouleh', emoji: '🥗', cuisine: 'moyen-orient', category: 'entree', description: 'Salade au persil, boulgour, tomates et citron', default_portion_g: 200, kcal_per_portion: 180, glucides: 22, proteines: 5, lipides: 8, fibres: 4, difficulty: 'facile', prep_time_min: 20, cook_time_min: 0, ingredients_json: '[{"name":"Persil","grams":80},{"name":"Boulgour","grams":40},{"name":"Tomates","grams":60}]' },
    // ASIATIQUE (7)
    { name: 'Sushi', name_ar: 'سوشي', name_en: 'Sushi', emoji: '🍱', cuisine: 'asiatique', category: 'plat', description: 'Riz vinaigré garni de poisson frais et algues nori', default_portion_g: 300, kcal_per_portion: 420, glucides: 68, proteines: 18, lipides: 8, fibres: 2, difficulty: 'difficile', prep_time_min: 45, cook_time_min: 20, ingredients_json: '[{"name":"Riz à sushi","grams":180},{"name":"Saumon","grams":80},{"name":"Feuilles nori","grams":10}]' },
    { name: 'Ramen', name_ar: 'رامن', name_en: 'Ramen', emoji: '🍜', cuisine: 'asiatique', category: 'plat', description: 'Soupe japonaise aux nouilles, bouillon et garnitures', default_portion_g: 500, kcal_per_portion: 560, glucides: 72, proteines: 26, lipides: 16, fibres: 3, difficulty: 'difficile', prep_time_min: 30, cook_time_min: 120, ingredients_json: '[{"name":"Nouilles ramen","grams":100},{"name":"Porc chashu","grams":80},{"name":"Bouillon miso","grams":200}]' },
    { name: 'Pad Thaï', name_ar: 'باد تاي', name_en: 'Pad Thai', emoji: '🍝', cuisine: 'asiatique', category: 'plat', description: 'Nouilles de riz sautées aux crevettes, arachides et œuf', default_portion_g: 350, kcal_per_portion: 520, glucides: 62, proteines: 22, lipides: 18, fibres: 3, difficulty: 'moyen', prep_time_min: 15, cook_time_min: 15, ingredients_json: '[{"name":"Nouilles de riz","grams":150},{"name":"Crevettes","grams":80},{"name":"Arachides","grams":30}]' },
    { name: 'Riz Cantonais', name_ar: 'أرز كانتوني', name_en: 'Fried Rice', emoji: '🍚', cuisine: 'asiatique', category: 'plat', description: 'Riz sauté aux légumes, œuf et sauce soja', default_portion_g: 350, kcal_per_portion: 480, glucides: 72, proteines: 16, lipides: 14, fibres: 2, difficulty: 'facile', prep_time_min: 10, cook_time_min: 15, ingredients_json: '[{"name":"Riz cuit","grams":200},{"name":"Œufs","grams":60},{"name":"Légumes","grams":80}]' },
    { name: 'Dim Sum', name_ar: 'دم سم', name_en: 'Dim Sum', emoji: '🥟', cuisine: 'asiatique', category: 'entree', description: 'Petits dumplings vapeur farcis crevettes ou porc', default_portion_g: 200, kcal_per_portion: 320, glucides: 36, proteines: 16, lipides: 12, fibres: 2, difficulty: 'difficile', prep_time_min: 45, cook_time_min: 15, ingredients_json: '[{"name":"Pâte dim sum","grams":80},{"name":"Crevettes","grams":80},{"name":"Gingembre","grams":5}]' },
    { name: 'Curry Indien', name_ar: 'كاري هندي', name_en: 'Indian Curry', emoji: '🍛', cuisine: 'asiatique', category: 'plat', description: 'Sauce épicée au lait de coco, légumes et poulet', default_portion_g: 400, kcal_per_portion: 520, glucides: 42, proteines: 30, lipides: 22, fibres: 5, difficulty: 'moyen', prep_time_min: 15, cook_time_min: 35, ingredients_json: '[{"name":"Poulet","grams":150},{"name":"Lait de coco","grams":100},{"name":"Curry","grams":10}]' },
    { name: 'Biryani', name_ar: 'برياني', name_en: 'Biryani', emoji: '🍛', cuisine: 'asiatique', category: 'plat', description: 'Riz épicé aux épices, viande et safran', default_portion_g: 400, kcal_per_portion: 620, glucides: 82, proteines: 28, lipides: 16, fibres: 3, difficulty: 'difficile', prep_time_min: 30, cook_time_min: 60, ingredients_json: '[{"name":"Riz basmati","grams":180},{"name":"Poulet","grams":120},{"name":"Épices biryani","grams":10}]' },
    // AMÉRICAINE (5)
    { name: 'Burger', name_ar: 'برغر', name_en: 'Burger', emoji: '🍔', cuisine: 'américaine', category: 'plat', description: 'Sandwich au steak haché, cheddar, laitue et tomate', default_portion_g: 320, kcal_per_portion: 720, glucides: 54, proteines: 36, lipides: 36, fibres: 3, difficulty: 'facile', prep_time_min: 10, cook_time_min: 15, ingredients_json: '[{"name":"Pain burger","grams":90},{"name":"Steak haché","grams":150},{"name":"Cheddar","grams":30}]' },
    { name: 'Hot-Dog', name_ar: 'هوت دوغ', name_en: 'Hot Dog', emoji: '🌭', cuisine: 'américaine', category: 'plat', description: 'Saucisse dans un pain moelleux avec ketchup et moutarde', default_portion_g: 180, kcal_per_portion: 380, glucides: 38, proteines: 16, lipides: 18, fibres: 2, difficulty: 'facile', prep_time_min: 5, cook_time_min: 5, ingredients_json: '[{"name":"Pain hot-dog","grams":60},{"name":"Saucisse","grams":80},{"name":"Ketchup","grams":20}]' },
    { name: 'Fried Chicken', name_ar: 'دجاج مقلي', name_en: 'Fried Chicken', emoji: '🍗', cuisine: 'américaine', category: 'plat', description: 'Poulet croustillant frit à la chapelure épicée', default_portion_g: 300, kcal_per_portion: 620, glucides: 32, proteines: 42, lipides: 32, fibres: 1, difficulty: 'moyen', prep_time_min: 20, cook_time_min: 20, ingredients_json: '[{"name":"Poulet","grams":200},{"name":"Chapelure","grams":50},{"name":"Épices","grams":5}]' },
    { name: 'Mac and Cheese', name_ar: 'مكرونة بالجبن', name_en: 'Mac and Cheese', emoji: '🧀', cuisine: 'américaine', category: 'plat', description: 'Macaronis crémeux en sauce au fromage cheddar', default_portion_g: 300, kcal_per_portion: 540, glucides: 64, proteines: 18, lipides: 22, fibres: 2, difficulty: 'facile', prep_time_min: 5, cook_time_min: 15, ingredients_json: '[{"name":"Macaroni","grams":120},{"name":"Cheddar","grams":80},{"name":"Beurre","grams":20}]' },
    { name: 'Pancakes', name_ar: 'بانكيك', name_en: 'Pancakes', emoji: '🥞', cuisine: 'américaine', category: 'dessert', description: "Crêpes épaisses moelleuses au sirop d'érable", default_portion_g: 200, kcal_per_portion: 440, glucides: 68, proteines: 10, lipides: 14, fibres: 2, difficulty: 'facile', prep_time_min: 10, cook_time_min: 15, ingredients_json: '[{"name":"Farine","grams":100},{"name":"Lait","grams":80},{"name":"Sirop d\'érable","grams":30}]' },
    // TURQUE (5)
    { name: 'Döner Kebab', name_ar: 'دونر كباب', name_en: 'Doner Kebab', emoji: '🌯', cuisine: 'turque', category: 'plat', description: 'Viande rôtie à la broche dans du pain pide', default_portion_g: 350, kcal_per_portion: 580, glucides: 48, proteines: 36, lipides: 24, fibres: 2, difficulty: 'moyen', prep_time_min: 10, cook_time_min: 30, ingredients_json: '[{"name":"Viande veau/agneau","grams":180},{"name":"Pain pide","grams":100},{"name":"Sauce yaourt","grams":40}]' },
    { name: 'Lahmacun', name_ar: 'لحم عجين', name_en: 'Lahmacun', emoji: '🫓', cuisine: 'turque', category: 'plat', description: 'Pizza turque fine à la viande hachée épicée', default_portion_g: 250, kcal_per_portion: 420, glucides: 52, proteines: 22, lipides: 14, fibres: 3, difficulty: 'moyen', prep_time_min: 20, cook_time_min: 15, ingredients_json: '[{"name":"Pâte fine","grams":100},{"name":"Viande hachée","grams":80},{"name":"Tomates épicées","grams":60}]' },
    { name: 'Pide', name_ar: 'بيدة', name_en: 'Pide', emoji: '🫓', cuisine: 'turque', category: 'plat', description: 'Pain bateau turc garni de fromage et viande', default_portion_g: 300, kcal_per_portion: 560, glucides: 64, proteines: 24, lipides: 20, fibres: 3, difficulty: 'moyen', prep_time_min: 30, cook_time_min: 20, ingredients_json: '[{"name":"Pâte à pain","grams":150},{"name":"Fromage","grams":60},{"name":"Viande","grams":60}]' },
    { name: 'Köfte', name_ar: 'كفتة تركية', name_en: 'Köfte', emoji: '🍢', cuisine: 'turque', category: 'plat', description: 'Boulettes de viande épicées grillées à la turque', default_portion_g: 250, kcal_per_portion: 440, glucides: 6, proteines: 38, lipides: 28, fibres: 1, difficulty: 'facile', prep_time_min: 15, cook_time_min: 15, ingredients_json: '[{"name":"Viande hachée","grams":200},{"name":"Oignon","grams":30},{"name":"Épices turques","grams":5}]' },
    { name: 'Baklava', name_ar: 'بقلاوة', name_en: 'Baklava', emoji: '🍯', cuisine: 'turque', category: 'dessert', description: 'Pâtisserie feuilletée aux pistaches et miel', default_portion_g: 100, kcal_per_portion: 380, glucides: 46, proteines: 6, lipides: 20, fibres: 2, difficulty: 'difficile', prep_time_min: 60, cook_time_min: 30, ingredients_json: '[{"name":"Pâte filo","grams":50},{"name":"Pistaches","grams":30},{"name":"Miel","grams":30}]' },
    // INDIENNE (4)
    { name: 'Butter Chicken', name_ar: 'دجاج بالزبدة', name_en: 'Butter Chicken', emoji: '🍗', cuisine: 'indienne', category: 'plat', description: 'Poulet tendre en sauce tomate crémeuse et épices', default_portion_g: 400, kcal_per_portion: 520, glucides: 18, proteines: 38, lipides: 28, fibres: 3, difficulty: 'moyen', prep_time_min: 20, cook_time_min: 35, ingredients_json: '[{"name":"Poulet","grams":200},{"name":"Sauce tomate-crème","grams":120},{"name":"Épices indiennes","grams":10}]' },
    { name: 'Naan', name_ar: 'نان', name_en: 'Naan', emoji: '🫓', cuisine: 'indienne', category: 'entree', description: 'Pain indien moelleux cuit au tandoor', default_portion_g: 100, kcal_per_portion: 280, glucides: 48, proteines: 8, lipides: 6, fibres: 2, difficulty: 'moyen', prep_time_min: 60, cook_time_min: 5, ingredients_json: '[{"name":"Farine","grams":80},{"name":"Yaourt","grams":30},{"name":"Beurre","grams":10}]' },
    { name: 'Dal Tadka', name_ar: 'دال تادكا', name_en: 'Dal Tadka', emoji: '🫘', cuisine: 'indienne', category: 'plat', description: 'Lentilles épicées avec tarka à l\'ail et cumin', default_portion_g: 350, kcal_per_portion: 320, glucides: 46, proteines: 16, lipides: 8, fibres: 10, difficulty: 'facile', prep_time_min: 10, cook_time_min: 30, ingredients_json: '[{"name":"Lentilles rouges","grams":150},{"name":"Tomates","grams":80},{"name":"Épices","grams":10}]' },
    { name: 'Samosa', name_ar: 'سموسة', name_en: 'Samosa', emoji: '🥟', cuisine: 'indienne', category: 'entree', description: 'Chaussons frits farcis pommes de terre et petits pois', default_portion_g: 150, kcal_per_portion: 300, glucides: 36, proteines: 6, lipides: 16, fibres: 3, difficulty: 'moyen', prep_time_min: 30, cook_time_min: 15, ingredients_json: '[{"name":"Pâte","grams":50},{"name":"Pommes de terre","grams":80},{"name":"Petits pois","grams":30}]' },
    // MEXICAINE (4)
    { name: 'Tacos', name_ar: 'تاكو', name_en: 'Tacos', emoji: '🌮', cuisine: 'mexicaine', category: 'plat', description: 'Tortilla garnie de viande, guacamole et salsa', default_portion_g: 250, kcal_per_portion: 420, glucides: 42, proteines: 22, lipides: 18, fibres: 4, difficulty: 'facile', prep_time_min: 15, cook_time_min: 15, ingredients_json: '[{"name":"Tortilla maïs","grams":60},{"name":"Bœuf haché","grams":100},{"name":"Guacamole","grams":40}]' },
    { name: 'Burrito', name_ar: 'بوريتو', name_en: 'Burrito', emoji: '🌯', cuisine: 'mexicaine', category: 'plat', description: 'Grande tortilla roulée avec riz, haricots et viande', default_portion_g: 400, kcal_per_portion: 620, glucides: 72, proteines: 28, lipides: 20, fibres: 8, difficulty: 'facile', prep_time_min: 15, cook_time_min: 20, ingredients_json: '[{"name":"Tortilla farine","grams":80},{"name":"Riz","grams":80},{"name":"Haricots noirs","grams":80}]' },
    { name: 'Guacamole', name_ar: 'جواكامولي', name_en: 'Guacamole', emoji: '🥑', cuisine: 'mexicaine', category: 'entree', description: 'Sauce crémeuse à l\'avocat, citron et coriandre', default_portion_g: 100, kcal_per_portion: 180, glucides: 8, proteines: 2, lipides: 16, fibres: 5, difficulty: 'facile', prep_time_min: 10, cook_time_min: 0, ingredients_json: '[{"name":"Avocat","grams":80},{"name":"Tomate","grams":20},{"name":"Citron vert","grams":10}]' },
    { name: 'Quesadilla', name_ar: 'كيساديا', name_en: 'Quesadilla', emoji: '🫓', cuisine: 'mexicaine', category: 'plat', description: 'Tortilla grillée fourrée au fromage fondu et poulet', default_portion_g: 250, kcal_per_portion: 480, glucides: 46, proteines: 24, lipides: 22, fibres: 2, difficulty: 'facile', prep_time_min: 10, cook_time_min: 10, ingredients_json: '[{"name":"Tortilla farine","grams":80},{"name":"Fromage","grams":60},{"name":"Poulet","grams":80}]' },
    // JAPONAISE (4)
    { name: 'Tempura', name_ar: 'تمبورا', name_en: 'Tempura', emoji: '🍤', cuisine: 'japonaise', category: 'plat', description: 'Crevettes et légumes frits en pâte légère', default_portion_g: 250, kcal_per_portion: 380, glucides: 36, proteines: 16, lipides: 18, fibres: 2, difficulty: 'moyen', prep_time_min: 15, cook_time_min: 10, ingredients_json: '[{"name":"Crevettes","grams":100},{"name":"Pâte tempura","grams":60},{"name":"Légumes","grams":80}]' },
    { name: 'Onigiri', name_ar: 'أونيغيري', name_en: 'Onigiri', emoji: '🍙', cuisine: 'japonaise', category: 'entree', description: 'Triangle de riz farci saumon ou thon, emballé nori', default_portion_g: 120, kcal_per_portion: 200, glucides: 38, proteines: 8, lipides: 2, fibres: 1, difficulty: 'moyen', prep_time_min: 20, cook_time_min: 0, ingredients_json: '[{"name":"Riz à sushi","grams":90},{"name":"Saumon","grams":20},{"name":"Feuille nori","grams":3}]' },
    { name: 'Teriyaki Poulet', name_ar: 'دجاج تيرياكي', name_en: 'Chicken Teriyaki', emoji: '🍗', cuisine: 'japonaise', category: 'plat', description: 'Poulet laqué à la sauce teriyaki sucrée salée', default_portion_g: 300, kcal_per_portion: 440, glucides: 28, proteines: 36, lipides: 16, fibres: 1, difficulty: 'facile', prep_time_min: 10, cook_time_min: 20, ingredients_json: '[{"name":"Poulet","grams":200},{"name":"Sauce teriyaki","grams":50},{"name":"Riz","grams":80}]' },
    { name: 'Miso Soupe', name_ar: 'حساء ميسو', name_en: 'Miso Soup', emoji: '🍵', cuisine: 'japonaise', category: 'entree', description: 'Bouillon de miso chaud au tofu et algues wakame', default_portion_g: 250, kcal_per_portion: 80, glucides: 8, proteines: 6, lipides: 2, fibres: 1, difficulty: 'facile', prep_time_min: 5, cook_time_min: 5, ingredients_json: '[{"name":"Pâte miso","grams":20},{"name":"Tofu","grams":50},{"name":"Algues wakame","grams":5}]' },
    // DIVERS (3)
    { name: 'Omelette', name_ar: 'عجة', name_en: 'Omelette', emoji: '🍳', cuisine: 'divers', category: 'plat', description: 'Omelette aux œufs frais, fromage et herbes', default_portion_g: 200, kcal_per_portion: 300, glucides: 2, proteines: 22, lipides: 22, fibres: 0, difficulty: 'facile', prep_time_min: 5, cook_time_min: 5, ingredients_json: '[{"name":"Œufs","grams":150},{"name":"Fromage","grams":30},{"name":"Beurre","grams":10}]' },
    { name: 'Salade César', name_ar: 'سلطة قيصر', name_en: 'Caesar Salad', emoji: '🥗', cuisine: 'divers', category: 'entree', description: 'Salade romaine, croûtons, parmesan et sauce César', default_portion_g: 250, kcal_per_portion: 340, glucides: 18, proteines: 12, lipides: 24, fibres: 4, difficulty: 'facile', prep_time_min: 10, cook_time_min: 5, ingredients_json: '[{"name":"Laitue romaine","grams":150},{"name":"Croûtons","grams":30},{"name":"Parmesan","grams":20}]' },
    { name: "Soupe à l'Oignon", name_ar: 'شوربة البصل', name_en: 'French Onion Soup', emoji: '🧅', cuisine: 'divers', category: 'entree', description: 'Soupe gratinée aux oignons caramélisés et gruyère', default_portion_g: 350, kcal_per_portion: 340, glucides: 28, proteines: 14, lipides: 16, fibres: 3, difficulty: 'moyen', prep_time_min: 15, cook_time_min: 50, ingredients_json: '[{"name":"Oignons","grams":150},{"name":"Bouillon","grams":150},{"name":"Gruyère","grams":40}]' },
  ];

  const stmt = db.prepare(`
    INSERT INTO dishes (name, name_ar, name_en, emoji, cuisine, category, description,
      default_portion_g, kcal_per_portion, glucides, proteines, lipides, fibres,
      ingredients_json, difficulty, prep_time_min, cook_time_min, is_user_created)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  for (const d of dishes) {
    await stmt.run(
      d.name, d.name_ar, d.name_en, d.emoji, d.cuisine, d.category, d.description,
      d.default_portion_g, d.kcal_per_portion, d.glucides, d.proteines, d.lipides, d.fibres,
      d.ingredients_json, d.difficulty, d.prep_time_min, d.cook_time_min
    );
  }
  console.log(`🍽️ ${dishes.length} plats de seed insérés`);
}

// S15 — seed du catalogue sauces & condiments dans products.
// Idempotent : barcode synthétique `cond:<key>` + ON CONFLICT (barcode) DO NOTHING.
// Macros P/G/L laissées à NULL (à compléter via CIQUAL/OFF — voir data/condiments.js).
async function seedCondiments() {
  const db = getDB();
  const stmt = db.prepare(`
    INSERT INTO products
      (barcode, name, brand, kcal_per100, glucides, proteines, lipides, category, portion_default_g, is_algerian, source)
    VALUES (@barcode, @name, @brand, @kcal_per100, @glucides, @proteines, @lipides, @category, @portion_default_g, 0, 'condiment')
    ON CONFLICT (barcode) DO NOTHING
  `);
  let inserted = 0;
  for (const cdt of CONDIMENTS) {
    const r = await stmt.run({
      barcode: `cond:${cdt.key}`,
      name: cdt.name_fr,
      brand: 'NutriVita',
      kcal_per100: cdt.kcal_per_100g,
      glucides: cdt.glucides,
      proteines: cdt.proteines,
      lipides: cdt.lipides,
      category: cdt.category,
      portion_default_g: cdt.portion_default_g,
    });
    inserted += r.changes;
  }
  if (inserted > 0) console.log(`🧂 ${inserted} condiment(s) seedé(s)`);
}

async function applyDishTranslationsFromFile() {
  try {
    const db = getDB();
    await applyTranslations(db);
  } catch (err) {
    console.warn('⚠️  Traductions plats non appliquées (JSON manquant ?) :', err.message);
  }
}

module.exports = { getDB, initDB };
