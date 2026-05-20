const path = require('path');
const fs = require('fs');

const JSON_PATH = path.join(__dirname, '..', 'data', 'dishesTranslations.json');

async function applyTranslations(db) {
  const translations = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  let updated = 0;

  for (const t of translations) {
    const result = await db.prepare(
      'UPDATE dishes SET name_fr = ?, name_ar = ?, name_en = ? WHERE id = ?'
    ).run(t.name_fr, t.name_ar, t.name_en, t.id);
    if (result.changes > 0) updated++;
  }

  const missing = await db.prepare(
    'SELECT id, name_fr FROM dishes WHERE name_fr IS NULL OR name_ar IS NULL OR name_en IS NULL'
  ).all();

  console.log(`✅ Traductions appliquées : ${updated} plats`);
  if (missing.length > 0) {
    console.warn(`⚠️  ${missing.length} plat(s) avec traduction manquante :`, missing);
  }

  return updated;
}

module.exports = { applyTranslations };

if (require.main === module) {
  const { getDB } = require('../db');
  const db = getDB();
  applyTranslations(db)
    .then(() => { db._db.close(); })
    .catch(err => { console.error(err); process.exit(1); });
}
