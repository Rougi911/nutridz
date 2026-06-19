'use strict';
// Résolution centralisée du nom d'un additif, priorité :
//   1. ADDITIVES_CLASSIFICATION (nom éditorial EFSA, toujours FR)
//   2. additive-names.json (taxonomie OFF, multilangue)
//   3. Fallback : le code lui-même ("E903")
const { ADDITIVES_CLASSIFICATION } = require('../data/additives');
const ADDITIVE_NAMES = require('../data/additive-names.json');

/**
 * @param {string} code   Code normalisé, ex. "E150d" (casse du fichier de classification)
 * @param {string} [lang] "fr"|"en"|"ar" — défaut "fr"
 * @returns {string}
 */
function resolveAdditiveName(code, lang = 'fr') {
  // 1) Classification éditoriale (toujours FR, prioritaire car curé)
  const classif = ADDITIVES_CLASSIFICATION[code];
  if (classif?.name) return classif.name;

  // 2) Taxonomie OFF
  const offEntry = ADDITIVE_NAMES[code];
  if (offEntry) {
    return offEntry[lang] || offEntry.fr || offEntry.en || code;
  }

  // 3) Fallback code
  return code;
}

module.exports = { resolveAdditiveName };
