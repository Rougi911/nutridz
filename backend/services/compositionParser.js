'use strict';
/**
 * S5 — Post-traitement de l'extraction de composition (photo d'étiquette).
 *
 * Porté du prototype validé hors-ligne (`composition-parser.proto.mjs`, 23 scénarios),
 * en remplaçant les mini-dicos par les vrais : `ADDITIVES_CLASSIFICATION` (code→{name,risk})
 * et `ADDITIVES_NAMES` (nom→code E) de `data/additives.js`.
 *
 * Gère : décimales FR (virgule)/EN (point), unités collées, énergie kJ→kcal + double unité,
 * « traces »→0, « NC »/« - »→null, « <0,5 »→moitié, bornes & cohérences (sucres≤glucides,
 * saturés≤lipides, négatifs/absurdes rejetés), extraction additifs (codes E, noms→E,
 * sous-variants type E450i, inconnus en `unknown`), `needs_confirmation` si incohérence
 * ou extraction trop maigre (<4 champs).
 */
const ADDITIVES = require('../data/additives');
const EFSA = ADDITIVES.ADDITIVES_CLASSIFICATION; // code → {name, risk, concern}
const NAMES2E = ADDITIVES.ADDITIVES_NAMES;       // nom (minuscule) → code E

function normalizeCode(tag) {
  const m = String(tag).match(/[eE](\d{3,4}[a-z]{0,3})$/i);
  return m ? `E${m[1].toLowerCase()}` : null;
}

// Normalise un nombre : virgule décimale, unités, "traces", "NC", "-", null
function num(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  let s = String(raw).trim().toLowerCase();
  if (['nc', 'n/a', 'na', '-', '–', '', '. '].includes(s)) return null;
  if (s.includes('trace')) return 0;
  const lt = s.match(/^<\s*([\d.,]+)/); if (lt) return parseFloat(lt[1].replace(',', '.')) / 2;
  s = s.replace(/\s*(g|mg|kcal|kj|kj\/100g|%)\s*$/, '').replace(',', '.').replace(/\s/g, '');
  const v = parseFloat(s); return isFinite(v) ? v : null;
}

// Énergie → kcal (gère kJ, double unité "480 kcal (2009 kJ)")
function toKcal(energyRaw, unitHint) {
  if (energyRaw == null) return null;
  const s = String(energyRaw).toLowerCase();
  const kc = s.match(/([\d.,]+)\s*kcal/);
  if (kc) { const v = parseFloat(kc[1].replace(',', '.')); return isFinite(v) ? Math.round(v) : null; }
  const kj = s.match(/([\d.,]+)\s*kj/);
  if (kj) { const v = parseFloat(kj[1].replace(',', '.')); return isFinite(v) ? Math.round(v / 4.184) : null; }
  const v = num(energyRaw); if (v == null) return null;
  if (unitHint === 'kj' || v > 900) return Math.round(v / 4.184);
  return Math.round(v);
}

function sanitize(p) {
  const warn = [];
  let kcal = toKcal(p.kcal, p.energy_unit);
  let glucides = num(p.glucides), sucres = num(p.dont_sucres), prot = num(p.proteines),
      lip = num(p.lipides), sat = num(p.dont_satures), fib = num(p.fibres), sel = num(p.sel);
  const clamp = (x, max) => { if (x == null) return null; if (x < 0) { warn.push('negatif'); return null; } if (x > max) { warn.push('hors_borne'); return null; } return x; };
  glucides = clamp(glucides, 100); prot = clamp(prot, 100); lip = clamp(lip, 100); fib = clamp(fib, 100); sel = clamp(sel, 100);
  sucres = clamp(sucres, 100); sat = clamp(sat, 100);
  if (kcal != null && (kcal < 0 || kcal > 900)) { warn.push('kcal_hors_borne'); kcal = null; }
  if (sucres != null && glucides != null && sucres > glucides + 0.5) { warn.push('sucres>glucides'); sucres = null; }
  if (sat != null && lip != null && sat > lip + 0.5) { warn.push('satures>lipides'); sat = null; }
  return { per_100g: { kcal, glucides, dont_sucres: sucres, proteines: prot, lipides: lip, dont_satures: sat, fibres: fib, sel }, warnings: warn };
}

function extractAdditives(ingredientsText, additivesList) {
  const found = new Map();
  const add = (codeNorm) => {
    if (!codeNorm) return;
    const cl = EFSA[codeNorm]; const code = codeNorm.toUpperCase();
    if (!found.has(code)) found.set(code, { code, name: (cl && cl.name) || code, risk: (cl && cl.risk) || 'unknown' });
  };
  const txt = (ingredientsText || '') + ' ' + ((additivesList || []).join(' '));
  for (const m of txt.matchAll(/\bE\s?(\d{3,4}[a-z]{0,3})\b/gi)) add(normalizeCode('E' + m[1]));
  const low = (ingredientsText || '').toLowerCase();
  for (const [name, code] of Object.entries(NAMES2E)) if (low.includes(name)) add(code);
  for (const a of (additivesList || [])) { const c = normalizeCode(a); if (c) add(c); else { const lc = String(a).toLowerCase(); if (NAMES2E[lc]) add(NAMES2E[lc]); } }
  return [...found.values()];
}

function buildComposition(g) {
  const { per_100g, warnings } = sanitize(g.per_100g || {});
  const additives = extractAdditives(g.ingredients_text, g.additives);
  const fields = Object.values(per_100g).filter(v => v != null).length;
  const baseConf = g.confidence ?? 0.5;
  let conf = baseConf - warnings.length * 0.1 - (fields < 4 ? 0.15 : 0);
  conf = Math.max(0, Math.min(1, Math.round(conf * 100) / 100));
  return {
    product_name: g.product_name || null,
    per_100g,
    additives,
    confidence: conf,
    needs_confirmation: conf < 0.7 || warnings.length > 0 || fields < 4,
    warnings,
  };
}

module.exports = { buildComposition, sanitize, extractAdditives, num, toKcal, normalizeCode };
