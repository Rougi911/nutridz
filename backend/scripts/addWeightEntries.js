const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'nutridz.db');

function run(db, sql) {
  return new Promise((resolve, reject) =>
    db.run(sql, function (err) { err ? reject(err) : resolve(this); })
  );
}

async function main() {
  const db = new sqlite3.Database(DB_PATH);

  await run(db, `CREATE TABLE IF NOT EXISTS weight_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    body_fat_pct REAL,
    date TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
  )`);
  console.log('✅ Table weight_entries prête');

  await run(db, `CREATE INDEX IF NOT EXISTS idx_weight_user_date ON weight_entries(user_id, date DESC)`);
  console.log('✅ Index idx_weight_user_date prêt');

  db.close();
  console.log('✅ Migration terminée.');
}

main().catch(err => { console.error(err); process.exit(1); });
