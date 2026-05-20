const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'nutridz.db');

function run(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes });
    })
  );
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );
}

async function main() {
  const db = new sqlite3.Database(DB_PATH);

  // Get existing columns
  const cols = await all(db, 'PRAGMA table_info(dishes)');
  const existing = new Set(cols.map(c => c.name));

  const toAdd = [
    ['name_fr', 'TEXT'],
    ['name_ar', 'TEXT'],
    ['name_en', 'TEXT'],
    ['description_fr', 'TEXT'],
    ['description_ar', 'TEXT'],
    ['description_en', 'TEXT'],
  ];

  for (const [col, type] of toAdd) {
    if (!existing.has(col)) {
      await run(db, `ALTER TABLE dishes ADD COLUMN ${col} ${type}`);
      console.log(`✅ Colonne ajoutée : ${col}`);
    } else {
      console.log(`⏭️  Colonne déjà présente : ${col}`);
    }
  }

  // Backfill name_fr from name (only where null)
  const result = await run(db, `UPDATE dishes SET name_fr = name WHERE name_fr IS NULL`);
  console.log(`✅ name_fr backfillé pour ${result.changes} plat(s)`);

  // Backfill description_fr from description (only where null)
  const result2 = await run(db, `UPDATE dishes SET description_fr = description WHERE description_fr IS NULL`);
  console.log(`✅ description_fr backfillé pour ${result2.changes} plat(s)`);

  db.close();
  console.log('✅ Migration terminée.');
}

main().catch(err => { console.error(err); process.exit(1); });
