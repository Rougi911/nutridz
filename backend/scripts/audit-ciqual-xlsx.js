'use strict';
// Audit script — reads ciqual-source-anses.xlsx and reports structure
// Run: node backend/scripts/audit-ciqual-xlsx.js

const path = require('path');
const XLSX = require('xlsx');

const xlsxPath = path.join(__dirname, '../data/ciqual-source-anses.xlsx');

console.log('Reading:', xlsxPath);
const wb = XLSX.readFile(xlsxPath);

console.log('\n=== Sheets ===');
console.log(wb.SheetNames);

const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

console.log('\n=== First sheet:', sheetName, '===');
console.log('Total rows (including header):', rows.length);

const headers = rows[0];
console.log('\n=== Column headers ===');
headers.forEach((h, i) => console.log(`  [${i}] ${h}`));

console.log('\n=== First 3 data rows ===');
for (let i = 1; i <= 3; i++) {
  const row = rows[i];
  if (!row) continue;
  const obj = {};
  headers.forEach((h, idx) => { obj[h] = row[idx]; });
  console.log(`\nRow ${i}:`, JSON.stringify(obj, null, 2));
}

// Search for special values
console.log('\n=== Special values scan (first 50 data rows) ===');
const specials = new Set();
for (let i = 1; i <= Math.min(50, rows.length - 1); i++) {
  const row = rows[i];
  if (!row) continue;
  row.forEach(cell => {
    const v = String(cell || '').trim();
    if (/traces/i.test(v) || v === '-' || v === 'NC' || /^</.test(v)) {
      specials.add(v);
    }
  });
}
console.log('Special values found:', [...specials]);

// Find columns for target micronutrients
const microTargets = [
  'vitC', 'vitamine C', 'Vitamine C', 'vit_C',
  'vitD', 'vitamine D', 'Vitamine D', 'vit_D',
  'B9', 'folate', 'Folate', 'Folates', 'B9_',
  'B12', 'vitamine B12', 'Vitamine B12', 'B12_',
  'Fer', 'fer',
  'Calcium', 'calcium', 'Ca_',
  'Magnesium', 'magnésium', 'Magnésium', 'Mg_',
  'Zinc', 'zinc', 'Zn_',
];

console.log('\n=== Micronutrient column search ===');
headers.forEach((h, i) => {
  const hs = String(h || '');
  if (microTargets.some(t => hs.toLowerCase().includes(t.toLowerCase()))) {
    console.log(`  [${i}] "${h}"`);
  }
});

// Also show all columns containing key nutrient terms
console.log('\n=== All columns with "vit", "fer", "cal", "mag", "zinc", "folat" ===');
headers.forEach((h, i) => {
  const hs = String(h || '').toLowerCase();
  if (['vit', 'fer', 'cal', 'mag', 'zinc', 'folat'].some(t => hs.includes(t))) {
    console.log(`  [${i}] "${h}"`);
  }
});

// Show alim_code and alim_nom_fr columns
console.log('\n=== Join key candidates (alim_code, alim_nom) ===');
headers.forEach((h, i) => {
  const hs = String(h || '').toLowerCase();
  if (hs.includes('alim_code') || hs.includes('alim_nom') || hs.includes('code') || hs.includes('nom')) {
    console.log(`  [${i}] "${h}"`);
  }
});

// Show sample rows for key columns
const ciqualJson = require('../data/ciqual.json');
console.log('\n=== Sample: first ciqual.json entry name ===');
console.log(ciqualJson[0].alim_nom_fr);

// Try to find it in xlsx
const sampleName = ciqualJson[0].alim_nom_fr;
console.log(`\n=== Searching for "${sampleName}" in xlsx ===`);
const nomColIdx = headers.findIndex(h => String(h || '').toLowerCase().includes('nom_fr') || String(h || '').toLowerCase() === 'alim_nom_fr');
console.log('alim_nom_fr column index:', nomColIdx);
if (nomColIdx >= 0) {
  for (let i = 1; i <= rows.length - 1; i++) {
    const row = rows[i];
    if (row && String(row[nomColIdx] || '').toLowerCase() === sampleName.toLowerCase()) {
      console.log('Found at row', i, ':', JSON.stringify(row.slice(0, 20)));
      break;
    }
  }
}
