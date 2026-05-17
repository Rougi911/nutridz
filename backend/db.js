const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'nutridz.db');

class Statement {
  constructor(db, sql) {
    this._db = db;
    this._sql = sql;
  }

  // Converts {key: val} → {'@key': val} for @named params; positional args pass through as array
  _params(args) {
    if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      const out = {};
      for (const k of Object.keys(args[0])) out[`@${k}`] = args[0][k];
      return out;
    }
    return args;
  }

  get(...args) {
    return new Promise((resolve, reject) =>
      this._db.get(this._sql, this._params(args), (err, row) => err ? reject(err) : resolve(row))
    );
  }

  all(...args) {
    return new Promise((resolve, reject) =>
      this._db.all(this._sql, this._params(args), (err, rows) => err ? reject(err) : resolve(rows))
    );
  }

  run(...args) {
    return new Promise((resolve, reject) =>
      this._db.run(this._sql, this._params(args), function(err) {
        err ? reject(err) : resolve({ lastInsertRowid: this.lastID, changes: this.changes });
      })
    );
  }
}

class DB {
  constructor(dbPath) {
    this._db = new sqlite3.Database(dbPath);
  }

  prepare(sql) { return new Statement(this._db, sql); }

  exec(sql) {
    return new Promise((resolve, reject) =>
      this._db.exec(sql, err => err ? reject(err) : resolve())
    );
  }

  transaction(fn) {
    const self = this;
    return async function(items) {
      await new Promise((res, rej) => self._db.run('BEGIN', e => e ? rej(e) : res()));
      try {
        await fn(items);
        await new Promise((res, rej) => self._db.run('COMMIT', e => e ? rej(e) : res()));
      } catch (e) {
        await new Promise(res => self._db.run('ROLLBACK', () => res()));
        throw e;
      }
    };
  }
}

let db;

function getDB() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new DB(DB_PATH);
  }
  return db;
}

async function initDB() {
  const db = getDB();

  await db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS weight_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    weight REAL NOT NULL,
    date TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS dish_analyses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plat_identifie TEXT,
    kcal REAL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await db.exec(`CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    duration_min INTEGER DEFAULT 0,
    distance_km REAL DEFAULT 0,
    calories_burned REAL DEFAULT 0,
    source TEXT DEFAULT 'manual',
    strava_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // Add Strava & Google Fit columns to profiles (safe for existing DBs)
  const stravaColumns = [
    'ALTER TABLE profiles ADD COLUMN strava_access_token TEXT',
    'ALTER TABLE profiles ADD COLUMN strava_refresh_token TEXT',
    'ALTER TABLE profiles ADD COLUMN strava_athlete_id TEXT',
    'ALTER TABLE profiles ADD COLUMN strava_token_expires_at INTEGER',
    'ALTER TABLE profiles ADD COLUMN strava_athlete_name TEXT',
  ];
  for (const sql of stravaColumns) {
    try { await db.exec(sql); } catch (_) { /* column already exists */ }
  }

  // One-time cleanup: remove hardcoded seed products (barcodes 619110000000*)
  try {
    const deleted = await db.prepare(
      "DELETE FROM products WHERE barcode LIKE '619110000000%'"
    ).run();
    if (deleted.changes > 0) {
      console.log(`🧹 ${deleted.changes} produit(s) de seed supprimé(s)`);
    }
  } catch (_) {}

  console.log('✅ Base de données initialisée');
}

module.exports = { getDB, initDB };
