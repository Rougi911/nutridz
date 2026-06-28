'use strict';
// DEF-7 — Classification d'un additif avec repli sur le code parent.
//
// Les sous-variantes (E322i, E450ii, E160ai…) ne sont pas listées individuellement dans
// ADDITIVES_CLASSIFICATION : elles héritent de la classification de leur code parent
// (E322, E450, E160a) au lieu d'être affichées « unknown ». On retire les lettres finales
// une à une jusqu'à trouver une entrée, ou jusqu'à ne plus avoir que des chiffres
// (alors : non classifié → null). Les sous-divisions explicitement classées (E150a..d)
// gardent leur valeur propre car le match exact est prioritaire avant tout repli.
//
// Module séparé (et non data/additives) pour rester mockable : les tests qui mockent
// `data/additives` fournissent ADDITIVES_CLASSIFICATION, et ce module suit ce mock.
const { ADDITIVES_CLASSIFICATION } = require('../data/additives');

/**
 * @param {string} code Code normalisé au format des clés : 'E322i', 'E150d'
 *                      (E majuscule, suffixe de sous-variante en minuscules).
 * @returns {{name:string, risk:string, concern?:string}|null}
 */
function classifyAdditive(code) {
  if (!code) return null;
  let c = String(code).replace(/^e/, 'E'); // tolère 'e322i'
  while (c.length > 1) {
    if (ADDITIVES_CLASSIFICATION[c]) return ADDITIVES_CLASSIFICATION[c];
    if (/[a-z]$/.test(c)) c = c.slice(0, -1); // retire une lettre de sous-variante
    else break;                               // plus que des chiffres → non classifié
  }
  return null;
}

module.exports = { classifyAdditive };
