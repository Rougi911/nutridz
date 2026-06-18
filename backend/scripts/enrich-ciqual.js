'use strict';
// Enrichissement de ciqual.json avec 8 micronutriments depuis le fichier ANSES xlsx
// Run: node backend/scripts/enrich-ciqual.js

const path = require('path');
const fs   = require('fs');
const XLSX = require('xlsx');

const CIQUAL_JSON = path.join(__dirname, '../data/ciqual.json');
const XLSX_PATH   = path.join(__dirname, '../data/ciqual-source-anses.xlsx');

// --- Column indices in xlsx (0-based), confirmed by audit ---
// [6]  alim_code
// [7]  alim_nom_fr
// [50] Calcium (mg/100g)
// [53] Fer (mg/100g)
// [55] Magnésium (mg/100g)
// [61] Zinc (mg/100g)
// [65] Vitamine D (µg/100g)
// [72] Vitamine C (mg/100g)
// [78] Vitamine B9 DFE (µg/100g) — primary (équivalents folates alimentaires, more complete)
// [79] Vitamine B9 Folates totaux (µg/100g) — fallback
// [82] Vitamine B12 (µg/100g)

const COL = {
  alim_nom_fr:  7,
  calcium:      50,
  iron:         53,
  magnesium:    55,
  zinc:         61,
  vitaminD:     65,
  vitaminC:     72,
  vitaminB9_dfe:78,  // primary
  vitaminB9_raw:79,  // fallback
  vitaminB12:   82,
};

/**
 * Parse a raw ANSES cell value to a number or null.
 * Rules:
 *   "traces"      → 0
 *   "-"           → null  (donnée non disponible)
 *   "NC"          → null  (non communiqué)
 *   "< X,Y"       → parseFloat("X.Y")  (borne haute conservative)
 *   "1,5"         → 1.5
 *   normal number → parseFloat
 *   null / ""     → null
 */
function parseValue(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '' || s === '-' || s.toLowerCase() === 'nc') return null;
  if (s.toLowerCase() === 'traces') return 0;
  // "< X" — take the number after "<"
  const ltMatch = s.match(/^<\s*(.+)$/);
  if (ltMatch) {
    const num = parseFloat(ltMatch[1].replace(',', '.'));
    return isNaN(num) ? null : num;
  }
  const num = parseFloat(s.replace(',', '.'));
  return isNaN(num) ? null : num;
}

// --- Load xlsx ---
console.log('Reading xlsx:', XLSX_PATH);
const wb = XLSX.readFile(XLSX_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

// Build a map: normalized(alim_nom_fr) → micronutrients object
// We also keep alim_code for potential future use
const xlsxMap = new Map(); // key = exact alim_nom_fr (lowercased+trimmed)

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row) continue;
  const nomFr = String(row[COL.alim_nom_fr] || '').trim();
  if (!nomFr) continue;

  // VitaminB9: prefer DFE column (78) which is more complete; fall back to raw folates (79)
  const b9_dfe = parseValue(row[COL.vitaminB9_dfe]);
  const b9_raw = parseValue(row[COL.vitaminB9_raw]);
  const vitaminB9 = b9_dfe !== null ? b9_dfe : b9_raw;

  const micro = {
    vitaminC:  parseValue(row[COL.vitaminC]),
    vitaminD:  parseValue(row[COL.vitaminD]),
    vitaminB9,
    vitaminB12:parseValue(row[COL.vitaminB12]),
    iron:      parseValue(row[COL.iron]),
    calcium:   parseValue(row[COL.calcium]),
    magnesium: parseValue(row[COL.magnesium]),
    zinc:      parseValue(row[COL.zinc]),
  };

  xlsxMap.set(nomFr.toLowerCase(), micro);
}

console.log(`XLSX loaded: ${xlsxMap.size} entries`);

// --- Load ciqual.json ---
const ciqualData = JSON.parse(fs.readFileSync(CIQUAL_JSON, 'utf8'));
console.log(`ciqual.json loaded: ${ciqualData.length} entries`);

// --- Enrich ---
let enriched = 0;
let notFound = [];

const enrichedData = ciqualData.map(item => {
  const key = (item.alim_nom_fr || '').trim().toLowerCase();
  const micro = xlsxMap.get(key);

  if (!micro) {
    notFound.push(item.alim_nom_fr);
    return {
      ...item,
      vitaminC:  null,
      vitaminD:  null,
      vitaminB9: null,
      vitaminB12:null,
      iron:      null,
      calcium:   null,
      magnesium: null,
      zinc:      null,
    };
  }

  enriched++;
  return {
    // Preserve all existing fields first
    alim_nom_fr: item.alim_nom_fr,
    alim_nom_en: item.alim_nom_en,
    group:       item.group,
    kcal:        item.kcal,
    proteines:   item.proteines,
    glucides:    item.glucides,
    lipides:     item.lipides,
    fibres:      item.fibres,
    sel:         item.sel,
    // Add micronutrients
    vitaminC:    micro.vitaminC,
    vitaminD:    micro.vitaminD,
    vitaminB9:   micro.vitaminB9,
    vitaminB12:  micro.vitaminB12,
    iron:        micro.iron,
    calcium:     micro.calcium,
    magnesium:   micro.magnesium,
    zinc:        micro.zinc,
  };
});

// --- Write enriched ciqual.json ---
fs.writeFileSync(CIQUAL_JSON, JSON.stringify(enrichedData, null, 2), 'utf8');
console.log('\n=== Enrichissement terminé ===');
console.log(`✅ Enrichis avec succès  : ${enriched} / ${ciqualData.length}`);
console.log(`❌ Sans correspondance   : ${notFound.length}`);
if (notFound.length > 0) {
  console.log('\nAliments sans correspondance :');
  notFound.forEach(n => console.log('  -', n));
}

// --- Spot-check: show values for reference foods ---
console.log('\n=== Vérification aliments de référence ===');
const checks = ['épinard', 'foie', 'parmesan', 'emmental', 'calcium'];
enrichedData.forEach(item => {
  const nomLow = (item.alim_nom_fr || '').toLowerCase();
  if (
    nomLow.includes('épinard') ||
    nomLow.includes('spinach') ||
    nomLow.includes('foie') ||
    nomLow.includes('parmesan') ||
    nomLow.includes('emmental')
  ) {
    console.log(`\n${item.alim_nom_fr}`);
    console.log(`  iron=${item.iron}, vitaminB12=${item.vitaminB12}, calcium=${item.calcium}, vitaminB9=${item.vitaminB9}`);
  }
});
