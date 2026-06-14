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

// Bonus : forme brute/crue (non transformée) — préférer "Tomate, crue" sur tout
const RAW_MARKERS = [
  /\bcru\b/, /\bcrue\b/, /\bcrus\b/, /\bcrues\b/,
  /\bnature\b/,
  /\bfrais\b/, /\bfraiche\b/, /\bfraiches\b/,
  /\bbrut\b/, /\bbrute\b/,
  /\bentier\b/, /\bentiere\b/,
];

// Malus : formes transformées/industrielles — pénaliser "Tomate séchée à l'huile"
const TRANSFORM_MARKERS = [
  /\bseche\b/, /\bsechee\b/, /\bseches\b/, /\bsechees\b/,
  /a l huile/,
  /\bconfit\b/, /\bconfite\b/, /\bconfits\b/, /\bconfites\b/,
  /en conserve/,
  /\bappertise\b/, /\bappertisee\b/,
  /\bsauce\b/,
  /\bconcentre\b/, /\bconcentree\b/,
  /\bfrit\b/, /\bfrite\b/, /\bfrits\b/, /\bfrites\b/,
  /\broti\b/, /\brotie\b/, /\brotis\b/, /\broties\b/,
  /\bsucre\b/, /\bsucree\b/,
  /\bsirop\b/,
  /\bdeshydrate\b/, /\bdeshydratee\b/,
  /\bpoche\b/,
  /\bsurgele\b/, /\bsurgelee\b/,
];

function rawBonus(normalizedName) {
  return RAW_MARKERS.some(re => re.test(normalizedName)) ? 20 : 0;
}

function transformMalus(normalizedEntry, normalizedQuery) {
  let malus = 0;
  const qWords = normalizedQuery.split(/\s+/).filter(Boolean);
  // If the user's query already contains a transform marker, that marker is intentional —
  // don't penalize the entry for it (e.g. "poulet roti" → no malus for "roti").
  const queryHasTransform = TRANSFORM_MARKERS.some(re => qWords.some(w => re.test(w)));

  for (const re of TRANSFORM_MARKERS) {
    if (re.test(normalizedEntry)) {
      const queryContainsThisMarker = qWords.some(w => re.test(w));
      if (!queryContainsThisMarker) malus += 25;
    }
  }
  // "cuit" : additional malus only if query has no cooking/transform marker AND no "cuit"
  if (/\bcuit/.test(normalizedEntry) && !/\bcuit/.test(normalizedQuery) && !queryHasTransform) {
    malus += 25;
  }
  return malus;
}

function score(query, entry) {
  const q = normalize(query);
  const fr = normalize(entry.alim_nom_fr || '');
  const en = normalize(entry.alim_nom_en || '');

  let base = 0;
  if (fr === q || en === q) base = 100;
  else if (fr.startsWith(q) || en.startsWith(q)) base = 80;
  else if (fr.includes(q) || en.includes(q)) base = 60;
  else {
    const words = q.split(' ').filter(w => w.length > 2);
    const frWords = fr.split(' ');
    const enWords = en.split(' ');
    const matchCount = words.filter(w => frWords.includes(w) || enWords.includes(w)).length;
    if (matchCount > 0) {
      // Boost when ALL query words match: multi-word intent is more specific (e.g. "poulet roti")
      const allMatch = words.every(w => frWords.includes(w) || enWords.includes(w));
      base = allMatch ? 40 + matchCount * 15 : 30 + matchCount * 10;
    }
  }
  if (base === 0) return 0;

  return Math.max(0, base + rawBonus(fr) - transformMalus(fr, q));
}

function searchByName(query, limit = 5) {
  if (!loaded) loadCiqual();
  if (!query || !ciqualData.length) return [];

  return ciqualData
    .map(entry => ({ entry, s: score(query, entry) }))
    .filter(r => r.s > 0)
    .sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      // tiebreaker : nom plus court = plus générique (préféré)
      const la = normalize(a.entry.alim_nom_fr || '').length;
      const lb = normalize(b.entry.alim_nom_fr || '').length;
      return la - lb;
    })
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

module.exports = { loadCiqual, searchByName, getStats, normalize, score, rawBonus, transformMalus };
