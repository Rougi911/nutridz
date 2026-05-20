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

  await run(db, `CREATE TABLE IF NOT EXISTS glucose_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    glucose_mg_dl REAL NOT NULL,
    reading_type TEXT CHECK(reading_type IN ('fasting', 'pre_meal', 'post_meal', 'bedtime', 'random', 'cgm')) NOT NULL,
    timestamp TEXT NOT NULL,
    notes TEXT,
    source TEXT DEFAULT 'manual',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log('✅ Table glucose_readings prête');

  await run(db, `CREATE INDEX IF NOT EXISTS idx_glucose_user_timestamp ON glucose_readings(user_id, timestamp DESC)`);
  console.log('✅ Index idx_glucose_user_timestamp prêt');

  db.close();
  console.log('✅ Migration terminée.');
}

main().catch(err => { console.error(err); process.exit(1); });
