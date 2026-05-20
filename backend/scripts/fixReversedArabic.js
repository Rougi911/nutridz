// ⚠️ ONE-SHOT SCRIPT — ne pas relancer après correction
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const JSON_PATH = path.join(__dirname, '..', 'data', 'dishesTranslations.json');
const DB_PATH   = path.join(__dirname, '..', 'nutridz.db');

function run(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve({ changes: this.changes });
    })
  );
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );
}

async function main() {
  // 1. Charge le JSON
  const translations = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

  // 2. Inverse chaque name_ar caractère par caractère
  for (const entry of translations) {
    entry.name_ar = [...entry.name_ar].reverse().join('');
  }

  // 3. Réécrit le JSON
  fs.writeFileSync(JSON_PATH, JSON.stringify(translations, null, 2), 'utf8');
  console.log(`✅ ${JSON_PATH} réécrit avec les name_ar corrigés`);

  // 4. Met à jour la DB
  const db = new sqlite3.Database(DB_PATH);
  let updated = 0;
  for (const entry of translations) {
    const result = await run(db, 'UPDATE dishes SET name_ar = ? WHERE id = ?', [entry.name_ar, entry.id]);
    if (result.changes > 0) updated++;
  }
  console.log(`✅ ${updated} ligne(s) mises à jour en DB\n`);

  // 5. Vérification spot-check
  const rows = await all(db, 'SELECT id, name_fr, name_ar FROM dishes WHERE id IN (1, 2, 14, 23, 45)');
  console.log('Vérification (id 1, 2, 14, 23, 45) :');
  rows.forEach(r => console.log(`  [${r.id}] ${r.name_fr} → ${r.name_ar}`));

  db.close();
}

main().catch(err => { console.error(err); process.exit(1); });
