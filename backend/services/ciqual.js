const path = require('path');
const fs   = require('fs');

const DATA_PATH = path.join(__dirname, '../data/ciqual.json');

let ciqualData = [];
let loaded = false;

function loadCiqual() {
  if (loaded) return;
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    ciqualData = JSON.parse(raw);
    loaded = true;
    console.log(`✅ CIQUAL chargé : ${ciqualData.length} aliments`);
  } catch (e) {
    console.warn('⚠️  CIQUAL non disponible:', e.message);
    ciqualData = [];
    loaded = true;
  }
}

// U+0300-U+036F: combining diacritical marks
const ACCENT_RE = new RegExp('[\\u0300-\\u036f]', 'g');
const NON_ALPHANUM = /[^a-z0-9 ]/g;

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(ACCENT_RE, '')
    .replace(NON_ALPHANUM, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function score(query, entry) {
  const q = normalize(query);
  const fr = normalize(entry.alim_nom_fr || '');
  const en = normalize(entry.alim_nom_en || '');

  if (fr === q || en === q) return 100;
  if (fr.startsWith(q) || en.startsWith(q)) return 80;
  if (fr.includes(q) || en.includes(q)) return 60;

  // partial word match
  const words = q.split(' ').filter(w => w.length > 2);
  const frWords = fr.split(' ');
  const enWords = en.split(' ');
  const matchCount = words.filter(w => frWords.includes(w) || enWords.includes(w)).length;
  if (matchCount > 0) return 30 + matchCount * 10;

  return 0;
}

function searchByName(query, limit = 5) {
  if (!loaded) loadCiqual();
  if (!query || !ciqualData.length) return [];

  return ciqualData
    .map(entry => ({ entry, score: score(query, entry) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => formatEntry(r.entry));
}

function formatEntry(entry) {
  return {
    source:    'ciqual',
    nom_fr:    entry.alim_nom_fr,
    nom_en:    entry.alim_nom_en || null,
    group:     entry.group || null,
    kcal:      entry.kcal      || 0,
    proteines: entry.proteines || 0,
    glucides:  entry.glucides  || 0,
    lipides:   entry.lipides   || 0,
    fibres:    entry.fibres    || 0,
    sel:       entry.sel       || 0,
  };
}

function getStats() {
  if (!loaded) loadCiqual();
  return { count: ciqualData.length, source: 'ciqual' };
}

loadCiqual();

module.exports = { loadCiqual, searchByName, getStats };
