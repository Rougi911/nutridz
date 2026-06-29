'use strict';
/**
 * S27 — Suggestions d'aliments naturels & de saison pour combler les carences identifiées.
 *
 * Couvre les 6 nutriments suivis par `micronutrientsService` : fer, calcium, vitD, vitB12,
 * magnesium, folates. Pour chaque nutriment en carence, on propose des aliments riches,
 * en priorisant ceux **de saison** (calendrier France). REG-05 : vocabulaire non clinique,
 * suggestions indicatives (le disclaimer est ajouté par la route).
 *
 * `null` dans SEASON_FR = disponible toute l'année (légumineuse sèche, oléagineux, enrichi…).
 */

// Aliments riches par nutriment (plante d'abord ; B12 quasi absente des végétaux → options enrichies).
const NUTRIENT_FOODS = {
  fer:       ['lentilles', 'épinard', 'pois chiches', 'persil', 'tofu', 'haricots blancs'],
  calcium:   ['chou kale', 'brocoli', 'épinard', 'amandes', 'figue séchée', 'chou'],
  vitD:      ['champignons', 'œuf'],                       // + exposition au soleil (note côté UI)
  vitB12:    ['levure alimentaire enrichie', 'produits enrichis'], // B12 d'origine animale sinon
  magnesium: ['épinard', 'banane', 'haricots noirs', 'amandes', 'chocolat noir', 'graines de courge'],
  folates:   ['épinard', 'asperge', 'brocoli', 'lentilles', 'orange', 'avocat'],
};

// Saison France (mois 1-12). null = toute l'année.
const SEASON_FR = {
  'lentilles': null, 'pois chiches': null, 'tofu': null, 'haricots blancs': null,
  'haricots noirs': null, 'amandes': null, 'figue séchée': null, 'graines de courge': null,
  'chocolat noir': null, 'œuf': null, 'levure alimentaire enrichie': null, 'produits enrichis': null,
  'banane': null, 'avocat': null,
  'épinard': [1, 2, 3, 4, 5, 9, 10, 11, 12],
  'persil':  [4, 5, 6, 7, 8, 9, 10],
  'chou kale': [10, 11, 12, 1, 2, 3],
  'brocoli': [6, 7, 8, 9, 10, 11],
  'chou':    [9, 10, 11, 12, 1, 2, 3],
  'champignons': [9, 10, 11, 12, 1],
  'asperge': [4, 5, 6],
  'orange':  [11, 12, 1, 2, 3, 4],
};

function isInSeason(name, month) {
  const s = SEASON_FR[name];
  return s == null ? true : s.includes(month);
}

/**
 * @param {Array<{nutrient:string, status?:string}>} deficientNutrients — nutriments EN CARENCE
 *        (déjà filtrés en amont : statut ≠ « satisfaisant »).
 * @param {number} month 1-12
 * @param {number} [max=4] nombre max d'aliments par nutriment
 * @returns {Array<{nutrient, status, foods:Array<{name, inSeason}>}>}
 */
function suggestSeasonalFoods(deficientNutrients, month, max = 4) {
  const out = [];
  for (const d of deficientNutrients || []) {
    const foods = (NUTRIENT_FOODS[d.nutrient] || [])
      .map((name) => ({ name, inSeason: isInSeason(name, month) }))
      // de saison en premier (ordre stable sinon)
      .sort((a, b) => Number(b.inSeason) - Number(a.inSeason))
      .slice(0, max);
    out.push({ nutrient: d.nutrient, status: d.status || null, foods });
  }
  return out;
}

module.exports = { NUTRIENT_FOODS, SEASON_FR, isInSeason, suggestSeasonalFoods };
