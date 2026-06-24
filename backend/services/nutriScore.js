'use strict';
/**
 * P1-7c — Calcul du Nutri-Score officiel, version **2023** (Santé publique France).
 *
 * Utilisé uniquement en repli, quand OpenFoodFacts ne fournit pas de `nutriscore_grade`.
 * Le chemin principal (grade lu chez OFF) est DÉJÀ en 2023 (OFF a migré :
 * `nutriscore_version: 2023`), donc seul ce recalcul devait être aligné.
 *
 * Barèmes vérifiés contre les calculs 2023 exposés par OFF (`nutriscore.2023.data`)
 * sur un panier de produits réels (cf. tests p1-7c).
 *
 * Limites assumées (rares dans le chemin de repli — OFF gère ces sous-algorithmes
 * quand il a les données) : catégories spéciales « matières grasses/noix/graines »
 * (ratio AGS) et « fromages » (protéines toujours comptées) ne sont PAS traitées ici.
 * Le pourcentage fruits/légumes/légumineuses n'est pas ré-estimé depuis les ingrédients
 * (on n'a que les nutriments en repli) : il vaut 0 sauf si présent dans les nutriments.
 */

// ─── Barèmes points négatifs (2023) ──────────────────────────────────────────
const ENERGY_SOLID = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350];          // kJ, 0–10
const ENERGY_BEV   = [30, 90, 150, 210, 240, 270, 300, 330, 360, 390];                     // kJ, 0–10 (boissons)
const SUGARS_SOLID = [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51];       // g, 0–15
const SUGARS_BEV   = [0.5, 2, 3.5, 5, 6, 7, 8, 9, 10, 11];                                  // g, 0–10 (boissons)
const SATFAT       = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];                                       // g, 0–10
const SALT         = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0,
                      2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0];                    // g, 0–20
const SWEETENER_MALUS = 4; // édulcorants non nutritifs (2023) : +4 points négatifs

// ─── Barèmes points positifs (2023) ──────────────────────────────────────────
const FIBER   = [3.0, 4.1, 5.2, 6.3, 7.4];          // g (AOAC), 0–5
const PROTEIN = [2.4, 4.8, 7.2, 9.6, 12, 14, 17];   // g, 0–7
const RED_MEAT_PROTEIN_CAP = 2;                      // plafond protéines viande rouge (2023)

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

// Nombre de seuils strictement dépassés
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
  if (pct > 80) return 6;
  if (pct > 60) return 4;
  if (pct > 40) return 2;
  return 0;
}

// Grades 2023 — aliments généraux
function gradeFromScoreSolid(s) {
  if (s <= 0)  return 'a';
  if (s <= 2)  return 'b';
  if (s <= 10) return 'c';
  if (s <= 18) return 'd';
  return 'e';
}
// Grades 2023 — boissons (eau gérée en amont → A ; autres boissons : B→E)
function gradeFromScoreBeverage(s) {
  if (s <= 1) return 'b';
  if (s <= 5) return 'c';
  if (s <= 9) return 'd';
  return 'e';
}

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

function saltGrams(nut) {
  const salt = num(nut['salt_100g']);
  if (salt !== null) return salt;
  const sodium = num(nut['sodium_100g']);
  if (sodium !== null) return sodium * 2.5; // sodium g → sel g
  return null;
}

function fruitPercent(nut) {
  return (
    num(nut['fruits-vegetables-legumes_100g']) ??
    num(nut['fruits-vegetables-legumes-estimate-from-ingredients_100g']) ??
    num(nut['fruits-vegetables-nuts_100g']) ??
    num(nut['fruits-vegetables-nuts-estimate-from-ingredients_100g']) ??
    num(nut['fruits-vegetables-nuts-estimate_100g']) ?? 0
  );
}

/**
 * @param {object} nutriments  objet OFF `product.nutriments`
 * @param {{isBeverage?:boolean, isWater?:boolean, isRedMeat?:boolean, hasSweeteners?:boolean}} opts
 * @returns {'a'|'b'|'c'|'d'|'e'|null}  null = aucune donnée exploitable (« non noté »)
 */
function computeNutriScoreGrade(nutriments, opts = {}) {
  const nut = nutriments || {};
  const { isBeverage = false, isWater = false, isRedMeat = false, hasSweeteners = false } = opts;

  if (isWater) return 'a'; // les eaux sont toujours A

  const hasData = CORE_KEYS.some(k => num(nut[k]) !== null);
  if (!hasData) return null;

  const energy  = energyKj(nut) ?? 0;
  const sugars  = num(nut['sugars_100g']) ?? 0;
  const satfat  = num(nut['saturated-fat_100g']) ?? 0;
  const salt    = saltGrams(nut) ?? 0;
  const fiber   = num(nut['fiber_100g']) ?? 0;
  const protein = num(nut['proteins_100g']) ?? 0;
  const fruitPct = fruitPercent(nut);

  const negative =
    pointsFromThresholds(energy, isBeverage ? ENERGY_BEV : ENERGY_SOLID) +
    pointsFromThresholds(sugars, isBeverage ? SUGARS_BEV : SUGARS_SOLID) +
    pointsFromThresholds(satfat, SATFAT) +
    pointsFromThresholds(salt, SALT) +
    (hasSweeteners ? SWEETENER_MALUS : 0);

  const fiberPts = pointsFromThresholds(fiber, FIBER);
  let proteinPts = pointsFromThresholds(protein, PROTEIN);
  if (isRedMeat) proteinPts = Math.min(proteinPts, RED_MEAT_PROTEIN_CAP);
  const maxFruit = isBeverage ? 6 : 5;
  const fruitPts = isBeverage ? fruitPointsBeverage(fruitPct) : fruitPointsSolid(fruitPct);

  // Protéines comptées : toujours pour les boissons ; sinon seulement si N < 11
  // (ou fruits/légumes au maximum). Cohérent avec le champ count_proteins d'OFF.
  const countProtein = isBeverage || negative < 11 || fruitPts === maxFruit;
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

// Édulcorants non nutritifs (2023) — détection via additives_tags (codes E intenses + polyols)
const SWEETENER_CODES = new Set([
  'e420', 'e421', 'e950', 'e951', 'e952', 'e953', 'e954', 'e955', 'e956', 'e957',
  'e959', 'e960', 'e961', 'e962', 'e963', 'e964', 'e965', 'e966', 'e967', 'e968', 'e969',
]);
function detectSweeteners(additivesTags = []) {
  return (additivesTags || []).some(tag => {
    const m = String(tag).toLowerCase().match(/e\d{3,4}/);
    return m && SWEETENER_CODES.has(m[0]);
  });
}

// Viande rouge (2023) — plafond des points protéines. Détection via categories_tags.
function detectRedMeat(categoriesTags = []) {
  const cats = (categoriesTags || []).map(c => String(c).toLowerCase());
  return cats.some(c =>
    /(beef|veal|pork|lamb|mutton|horse|red-meat|viandes-de-boeuf|viandes-de-porc|charcuteries|hams|sausages)/.test(c));
}

module.exports = { computeNutriScoreGrade, detectBeverage, detectSweeteners, detectRedMeat };
