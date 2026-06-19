'use strict';
/**
 * importAdditiveNames.js — Importe les noms d'additifs depuis la taxonomie Open Food Facts.
 *
 * Usage : node backend/scripts/importAdditiveNames.js
 * Sortie : backend/data/additive-names.json
 *
 * Format OFF : { "en:e150d": { "name": { "fr":["Caramel sulfite-ammoniacal"], "en":["..."] } } }
 * Résultat  : { "E150d": { "fr": "Caramel sulfite-ammoniacal", "en": "..." } }
 *
 * Ré-exécutable à tout moment pour rafraîchir les noms.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const OFF_URL  = 'https://static.openfoodfacts.org/data/taxonomies/additives.json';
const OUT_PATH = path.join(__dirname, '../data/additive-names.json');
const TIMEOUT  = 30_000;

function normalizeKey(id) {
  // "en:e150d" → "E150d"
  const m = String(id).match(/[eE](\d{3,4}[a-zA-Z]?)$/);
  return m ? `E${m[1]}` : null;
}

/** OFF names are strings like "E433 - Monooléate de polyoxyéthylène de sorbitane". Strip prefix. */
function cleanName(raw) {
  if (!raw) return null;
  // Remove leading "Exxx - " or "Exxx – " prefix
  const stripped = String(raw).replace(/^E\d{3,4}[a-z]?\s*[-–]\s*/i, '').trim();
  return stripped || String(raw).trim();
}

function bestLang(names, ...langs) {
  for (const lang of langs) {
    if (names[lang]) return cleanName(names[lang]);
  }
  return null;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: TIMEOUT }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error('JSON parse error: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

async function main() {
  console.log('[importAdditiveNames] Téléchargement de la taxonomie OFF…');
  let raw;
  try {
    raw = await fetchJson(OFF_URL);
  } catch (err) {
    console.error('[importAdditiveNames] Erreur réseau:', err.message);
    process.exit(1);
  }

  const result = {};
  let count = 0;

  for (const [id, entry] of Object.entries(raw)) {
    const key = normalizeKey(id);
    if (!key) continue;

    // OFF stores names as strings keyed by lang code (e.g. "fr": "E433 - Monooléate...")
    const names = entry.name || {};
    const fr = bestLang(names, 'fr', 'en', 'de', 'es');
    const en = bestLang(names, 'en', 'fr', 'de', 'es');
    const ar = bestLang(names, 'ar');

    if (!fr && !en) continue; // aucun nom exploitable

    result[key] = {};
    if (fr) result[key].fr = fr;
    if (en) result[key].en = en;
    if (ar) result[key].ar = ar;
    count++;
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`[importAdditiveNames] ${count} codes écrits dans ${OUT_PATH}`);
}

main();
