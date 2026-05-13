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

  console.log('✅ Base de données initialisée');
  await seedProducts(db);
}

async function seedProducts(db) {
  const count = await db.prepare('SELECT COUNT(*) as n FROM products').get();
  if (count.n > 0) return;

  const insert = db.prepare(`
    INSERT INTO products (name, brand, emoji, score, kcal_per100, glucides, proteines, lipides, fibres, sel, additifs, comment, category, barcode)
    VALUES (@name, @brand, @emoji, @score, @kcal_per100, @glucides, @proteines, @lipides, @fibres, @sel, @additifs, @comment, @category, @barcode)
  `);

  const algProducts = [
    { name:'Couscous fin', brand:'Tifritine', emoji:'🥣', score:'A', kcal_per100:356, glucides:72, proteines:12, lipides:2, fibres:5, sel:0.01, additifs:'[]', comment:'Excellent choix — riche en fibres, faible en graisses.', category:'cereales', barcode:'6191100000001' },
    { name:'Biscuits Maamouls', brand:'Cerma', emoji:'🍪', score:'C', kcal_per100:480, glucides:62, proteines:6, lipides:22, fibres:2, sel:0.3, additifs:'[{"name":"E471","type":"warn"},{"name":"Arômes","type":"warn"}]', comment:'Consommation modérée conseillée.', category:'biscuits', barcode:'6191100000002' },
    { name:'Lait entier', brand:'Candia DZ', emoji:'🥛', score:'A', kcal_per100:42, glucides:4.7, proteines:3.4, lipides:1.5, fibres:0, sel:0.1, additifs:'[]', comment:'Bonne source de protéines et calcium.', category:'laitiers', barcode:'6191100000003' },
    { name:'Jus Rouiba Pêche', brand:'Rouiba', emoji:'🧃', score:'B', kcal_per100:47, glucides:11, proteines:0.3, lipides:0.1, fibres:0.2, sel:0.02, additifs:'[{"name":"Vitamine C","type":"ok"},{"name":"Arômes","type":"warn"}]', comment:'Attention à la teneur en sucres ajoutés.', category:'boissons', barcode:'6191100000004' },
    { name:'Chips Fromage', brand:'Doritos DZ', emoji:'🍿', score:'D', kcal_per100:520, glucides:55, proteines:7, lipides:32, fibres:3, sel:1.2, additifs:'[{"name":"E621","type":"bad"},{"name":"E631","type":"bad"}]', comment:'À éviter — additifs controversés, très calorique.', category:'snacks', barcode:'6191100000005' },
    { name:'Miel de Thym', brand:'Ifri Bio', emoji:'🍯', score:'A', kcal_per100:305, glucides:82, proteines:0.4, lipides:0, fibres:0.2, sel:0, additifs:'[]', comment:'100% naturel. Sucres naturels, à doser.', category:'sucres', barcode:'6191100000006' },
    { name:'Oeufs frais', brand:'Ferme locale', emoji:'🥚', score:'A', kcal_per100:155, glucides:1.1, proteines:13, lipides:11, fibres:0, sel:0.4, additifs:'[]', comment:'Excellente source de protéines complètes.', category:'proteines', barcode:'6191100000007' },
    { name:'Pain semoule', brand:'Boulangerie DZ', emoji:'🍞', score:'B', kcal_per100:280, glucides:56, proteines:9, lipides:2, fibres:3, sel:1.1, additifs:'[]', comment:'Bon apport énergétique, fibres modérées.', category:'cereales', barcode:'6191100000008' },
    { name:'Yaourt nature', brand:'Soummam', emoji:'🥛', score:'A', kcal_per100:61, glucides:6, proteines:4, lipides:2.5, fibres:0, sel:0.1, additifs:'[]', comment:'Excellent pour la flore intestinale.', category:'laitiers', barcode:'6191100000009' },
    { name:'Huile de tournesol', brand:'Elio', emoji:'🫙', score:'B', kcal_per100:900, glucides:0, proteines:0, lipides:100, fibres:0, sel:0, additifs:'[]', comment:'Riche en oméga-6. Utiliser avec modération.', category:'matieres_grasses', barcode:'6191100000010' },
    { name:'Sardines en conserve', brand:'Sidi Daoud', emoji:'🐟', score:'A', kcal_per100:208, glucides:0, proteines:25, lipides:12, fibres:0, sel:1.3, additifs:'[]', comment:'Excellente source de protéines et oméga-3.', category:'proteines', barcode:'6191100000011' },
    { name:'Pois chiches cuits', brand:'Simar', emoji:'🫘', score:'A', kcal_per100:164, glucides:27, proteines:9, lipides:2.6, fibres:7, sel:0.5, additifs:'[]', comment:'Riche en protéines végétales et fibres.', category:'legumineuses', barcode:'6191100000012' },
  ];

  const insertAll = db.transaction(async (items) => {
    for (const p of items) await insert.run(p);
  });
  await insertAll(algProducts);
  console.log(`✅ ${algProducts.length} produits algériens chargés`);
}

module.exports = { getDB, initDB };
