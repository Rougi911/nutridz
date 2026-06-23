'use strict';
/**
 * P1-7 — Calcul du Nutri-Score officiel (algorithme Santé publique France, version 2017).
 *
 * Utilisé quand OpenFoodFacts ne fournit PAS de `nutriscore_grade` (catégories exclues :
 * cafés, thés, eaux, épices…). On recalcule le grade a–e à partir des nutriments bruts
 * plutôt que de retomber sur un score arbitraire.
 *
 * Barème publié, vérifiable (cohérent REG-05). Eaux → A. Boissons : grille dédiée.
 * Renvoie un grade 'a'..'e', ou `null` si aucune donnée nutritionnelle exploitable.
 */

// ─── Barèmes points négatifs ─────────────────────────────────────────────────
const ENERGY_SOLID = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]; // kJ
const ENERGY_BEV   = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270];              // kJ (boissons)
const SUGARS_SOLID = [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45];               // g
const SUGARS_BEV   = [1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5, 15];               // g (boissons)
const SATFAT       = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];                            // g
const SODIUM_MG    = [90, 180, 270, 360, 450, 540, 630, 720, 810, 900];          // mg

// ─── Barèmes points positifs ─────────────────────────────────────────────────
const FIBER   = [0.9, 1.9, 2.8, 3.7, 4.7]; // g, max 5
const PROTEIN = [1.6, 3.2, 4.8, 6.4, 8.0]; // g, max 5

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

// Nombre de seuils strictement dépassés (0..thresholds.length)
function pointsFromThresholds(value, thresholds) {
  let p = 0;
  for (const t of thresholds) {
    if (value > t) p++;
    else break;
  }
  return p;
}

function fruitPointsSolid(pct) {
  if (pct > 80) return 5;
  if (pct > 60) return 2;
  if (pct > 40) return 1;
  return 0;
}
function fruitPointsBeverage(pct) {
  if (pct > 80) return 10;
  if (pct > 60) return 4;
  if (pct > 40) return 2;
  return 0;
}

function gradeFromScoreSolid(s) {
  if (s <= -1) return 'a';
  if (s <= 2)  return 'b';
  if (s <= 10) return 'c';
  if (s <= 18) return 'd';
  return 'e';
}
function gradeFromScoreBeverage(s) {
  // Les eaux sont gérées en amont (A). Les autres boissons démarrent à B.
  if (s <= 1) return 'b';
  if (s <= 5) return 'c';
  if (s <= 9) return 'd';
  return 'e';
}

// Champs nutriments qui suffisent à considérer qu'on a « des données »
const CORE_KEYS = [
  'energy-kj_100g', 'energy-kcal_100g', 'energy_100g',
  'sugars_100g', 'saturated-fat_100g', 'salt_100g', 'sodium_100g', 'proteins_100g',
];

function energyKj(nut) {
  const kj = num(nut['energy-kj_100g']);
  if (kj !== null) return kj;
  const kcal = num(nut['energy-kcal_100g']);
  if (kcal !== null) return kcal * 4.184;
  return num(nut['energy_100g']); // OFF expose souvent energy_100g en kJ
}

function sodiumMg(nut) {
  const so = num(nut['sodium_100g']);
  if (so !== null) return so * 1000;          // g → mg
  const salt = num(nut['salt_100g']);
  if (salt !== null) return salt * 400;       // sel g → sodium mg (sel/2.5 *1000)
  return null;
}

/**
 * @param {object} nutriments  objet OFF `product.nutriments`
 * @param {{isBeverage?:boolean, isWater?:boolean}} opts
 * @returns {'a'|'b'|'c'|'d'|'e'|null}
 */
function computeNutriScoreGrade(nutriments, opts = {}) {
  const nut = nutriments || {};
  const { isBeverage = false, isWater = false } = opts;

  if (isWater) return 'a'; // les eaux sont toujours A

  const hasData = CORE_KEYS.some(k => num(nut[k]) !== null);
  if (!hasData) return null; // aucune donnée exploitable → non noté

  // Valeurs (champ absent → 0, comme le fait OFF)
  const energy  = energyKj(nut) ?? 0;
  const sugars  = num(nut['sugars_100g']) ?? 0;
  const satfat  = num(nut['saturated-fat_100g']) ?? 0;
  const sodium  = sodiumMg(nut) ?? 0;
  const fiber   = num(nut['fiber_100g']) ?? 0;
  const protein = num(nut['proteins_100g']) ?? 0;
  const fruitPct =
    num(nut['fruits-vegetables-nuts-estimate-from-ingredients_100g']) ??
    num(nut['fruits-vegetables-nuts_100g']) ??
    num(nut['fruits-vegetables-nuts-estimate_100g']) ?? 0;

  const energyPts = pointsFromThresholds(energy, isBeverage ? ENERGY_BEV : ENERGY_SOLID);
  const sugarsPts = pointsFromThresholds(sugars, isBeverage ? SUGARS_BEV : SUGARS_SOLID);
  const satfatPts = pointsFromThresholds(satfat, SATFAT);
  const sodiumPts = pointsFromThresholds(sodium, SODIUM_MG);
  const negative  = energyPts + sugarsPts + satfatPts + sodiumPts;

  const fiberPts   = pointsFromThresholds(fiber, FIBER);
  const proteinPts = pointsFromThresholds(protein, PROTEIN);
  const maxFruit   = isBeverage ? 10 : 5;
  const fruitPts   = isBeverage ? fruitPointsBeverage(fruitPct) : fruitPointsSolid(fruitPct);

  // Règle protéines : si N ≥ 11 et fruits/légumes non maximal, on ne compte pas les protéines
  const countProtein = negative < 11 || fruitPts === maxFruit;
  const score = negative - fiberPts - fruitPts - (countProtein ? proteinPts : 0);

  return isBeverage ? gradeFromScoreBeverage(score) : gradeFromScoreSolid(score);
}

// Détection eau / boisson à partir des categories_tags OFF (+ nom en repli)
function detectBeverage(categoriesTags = [], name = '') {
  const cats = (categoriesTags || []).map(c => String(c).toLowerCase());
  const isWater =
    cats.some(c => /(^|:)(waters|mineral-waters|spring-waters|natural-mineral-waters)$/.test(c) || c.includes('water')) ||
    /\b(eau|eaux|water)\b/i.test(name);
  const isBeverage =
    isWater ||
    cats.some(c => c.includes('beverage') || c.includes('drinks') ||
      /(sodas|juices|coffees|teas|hot-beverages|iced-teas|energy-drinks)/.test(c));
  return { isWater, isBeverage };
}

module.exports = { computeNutriScoreGrade, detectBeverage };
