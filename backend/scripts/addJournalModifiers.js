const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'nutridz.db');

function run(db, sql) {
  return new Promise((resolve, reject) =>
    db.run(sql, function (err) {
      err ? reject(err) : resolve({ changes: this.changes });
    })
  );
}

function all(db, sql) {
  return new Promise((resolve, reject) =>
    db.all(sql, (err, rows) => (err ? reject(err) : resolve(rows)))
  );
}

async function main() {
  const db = new sqlite3.Database(DB_PATH);

  const cols = await all(db, 'PRAGMA table_info(journal_entries)');
  const existing = new Set(cols.map(c => c.name));

  if (!existing.has('modifiers_json')) {
    await run(db, "ALTER TABLE journal_entries ADD COLUMN modifiers_json TEXT DEFAULT '[]'");
    console.log('✅ Colonne ajoutée : modifiers_json');
  } else {
    console.log('⏭️  Colonne déjà présente : modifiers_json');
  }

  db.close();
  console.log('✅ Migration terminée.');
}

main().catch(err => { console.error(err); process.exit(1); });
