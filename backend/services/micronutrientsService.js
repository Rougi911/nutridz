'use strict';
// Micronutrient estimates per 100g (ANSES CIQUAL 2023 approximations)
// Used for GET /api/stats/deficiencies (SL-API-04 / AL-07)
// Values: fer(mg), calcium(mg), vitD(µg), vitB12(µg), magnesium(mg), folates(µg)

const MICRO_DB = [
  { keywords: ['boeuf', 'bœuf', 'agneau', 'steak', 'veau', 'viande rouge', 'bifteck', 'entrecôte'],
    fer: 2.7, calcium: 8,   vitD: 0.1, vitB12: 1.5, magnesium: 22, folates: 6 },
  { keywords: ['poulet', 'dinde', 'volaille', 'poulet rôti', 'blanc de poulet'],
    fer: 0.9, calcium: 12,  vitD: 0.1, vitB12: 0.3, magnesium: 25, folates: 8 },
  { keywords: ['saumon', 'maquereau', 'sardine', 'hareng', 'truite'],
    fer: 0.9, calcium: 10,  vitD: 11.0, vitB12: 3.0, magnesium: 27, folates: 8 },
  { keywords: ['thon', 'sole', 'cabillaud', 'merlu', 'lieu', 'poisson'],
    fer: 0.5, calcium: 15,  vitD: 3.0, vitB12: 1.5, magnesium: 25, folates: 10 },
  { keywords: ['lentille', 'haricot', 'pois chiche', 'fève', 'légumineuse', 'flageolet'],
    fer: 2.4, calcium: 25,  vitD: 0,   vitB12: 0,   magnesium: 47, folates: 180 },
  { keywords: ['épinard', 'épinards', 'brocoli', 'chou', 'roquette', 'mâche'],
    fer: 2.7, calcium: 99,  vitD: 0,   vitB12: 0,   magnesium: 79, folates: 194 },
  { keywords: ['fromage', 'gruyère', 'emmental', 'parmesan', 'cheddar', 'brie', 'camembert', 'comté'],
    fer: 0.2, calcium: 700, vitD: 0.5, vitB12: 1.0, magnesium: 28, folates: 20 },
  { keywords: ['lait', 'yaourt', 'fromage blanc', 'crème', 'kéfir', 'lassi'],
    fer: 0.1, calcium: 120, vitD: 0.04, vitB12: 0.4, magnesium: 12, folates: 6 },
  { keywords: ['oeuf', 'œuf', 'omelette', 'oeufs'],
    fer: 1.8, calcium: 56,  vitD: 1.8, vitB12: 1.3, magnesium: 12, folates: 51 },
  { keywords: ['pain', 'brioche', 'baguette', 'toast', 'sandwich', 'biscotte'],
    fer: 1.5, calcium: 25,  vitD: 0,   vitB12: 0,   magnesium: 20, folates: 30 },
  { keywords: ['noix', 'amande', 'noisette', 'cajou', 'pistache', 'noix de cajou'],
    fer: 2.5, calcium: 80,  vitD: 0,   vitB12: 0,   magnesium: 170, folates: 50 },
  { keywords: ['orange', 'citron', 'pamplemousse', 'clémentine', 'mandarine'],
    fer: 0.1, calcium: 40,  vitD: 0,   vitB12: 0,   magnesium: 10, folates: 30 },
  { keywords: ['pomme', 'poire', 'pêche', 'abricot', 'prune', 'cerise', 'framboise', 'fraise'],
    fer: 0.3, calcium: 10,  vitD: 0,   vitB12: 0,   magnesium: 8,  folates: 15 },
  { keywords: ['banane', 'mangue', 'kiwi', 'ananas', 'papaye'],
    fer: 0.3, calcium: 8,   vitD: 0,   vitB12: 0,   magnesium: 27, folates: 20 },
  { keywords: ['tomate', 'poivron', 'courgette', 'aubergine', 'oignon', 'carotte', 'légume'],
    fer: 0.5, calcium: 20,  vitD: 0,   vitB12: 0,   magnesium: 15, folates: 30 },
  { keywords: ['riz', 'pâte', 'pâtes', 'spaghetti', 'quinoa', 'couscous', 'semoule'],
    fer: 0.6, calcium: 10,  vitD: 0,   vitB12: 0,   magnesium: 25, folates: 8 },
];

const DEFAULT_MICRO = { fer: 0.4, calcium: 15, vitD: 0.1, vitB12: 0.1, magnesium: 12, folates: 15 };

function lookupMicro(productName) {
  if (!productName) return { ...DEFAULT_MICRO };
  const lower = productName.toLowerCase();
  for (const row of MICRO_DB) {
    if (row.keywords.some(k => lower.includes(k))) {
      return { fer: row.fer, calcium: row.calcium, vitD: row.vitD, vitB12: row.vitB12, magnesium: row.magnesium, folates: row.folates };
    }
  }
  return { ...DEFAULT_MICRO };
}

// AL-07 — ANSES references by sex (µg or mg)
const ANSES_REF = {
  fer:      { h: 9,   f: 16  },  // mg/day
  calcium:  { h: 950, f: 950 },  // mg/day
  vitD:     { h: 15,  f: 15  },  // µg/day
  vitB12:   { h: 4,   f: 4   },  // µg/day
  magnesium:{ h: 380, f: 300 },  // mg/day
  folates:  { h: 330, f: 330 },  // µg/day
};

// REG-05 compliant status labels — never clinical terms
const STATUS_LOW     = 'Apports très faibles';
const STATUS_IMPROVE = 'Apports à améliorer';
const STATUS_OK      = 'Apports satisfaisants';

/**
 * calcDeficiencies(entries, dayCount, profile, month)
 * entries: [{ name, grams }] — from journal (LEFT JOIN products)
 * dayCount: number of distinct days with journal data
 * profile: { sexe, latitude_approx }
 * month: 1-12 (current month)
 */
function calcDeficiencies(entries, dayCount, profile, month) {
  const sexe = (profile?.sexe || 'h').toLowerCase() === 'f' ? 'f' : 'h';
  const latApprox = Math.round(profile?.latitude_approx ?? 46); // REG-03: round to degree
  const vitDFactor = (latApprox > 35 && [10, 11, 12, 1, 2, 3].includes(month)) ? 0.80 : 0.70;

  const totals = { fer: 0, calcium: 0, vitD: 0, vitB12: 0, magnesium: 0, folates: 0 };

  for (const e of entries) {
    const micro = lookupMicro(e.name);
    const ratio = (e.grams || 0) / 100;
    for (const key of Object.keys(totals)) {
      totals[key] += micro[key] * ratio;
    }
  }

  const results = [];
  for (const nutrient of Object.keys(ANSES_REF)) {
    const dailyRef = ANSES_REF[nutrient][sexe];
    const periodRef = dailyRef * dayCount;
    const pct = periodRef > 0 ? Math.round((totals[nutrient] / periodRef) * 100) : 0;

    const threshold = (nutrient === 'vitD') ? vitDFactor : 0.70;
    let status;
    if (pct < threshold * 100 * 0.5)        status = STATUS_LOW;
    else if (pct < threshold * 100)          status = STATUS_IMPROVE;
    else                                      status = STATUS_OK;

    results.push({
      nutrient,
      daily_ref: dailyRef,
      unit: nutrient === 'vitD' || nutrient === 'vitB12' ? 'µg' : 'mg',
      total_14d: Math.round(totals[nutrient] * 10) / 10,
      pct_reference: pct,
      status,
    });
  }

  return results;
}

/**
 * calcMicronutrientsIntake(entries)
 * Calcule les apports réels en 8 micronutriments à partir des données CIQUAL enrichies.
 * entries : tableau d'objets { quantity_g, vitaminC, vitaminD, vitaminB9, vitaminB12,
 *                               iron, calcium, magnesium, zinc }
 * Les champs micronutriments sont en mg ou µg pour 100g (unités CIQUAL).
 * Retourne les totaux pour la quantité réelle consommée.
 */
function calcMicronutrientsIntake(entries) {
  const totals = {
    vitaminC:   0,   // mg
    vitaminD:   0,   // µg
    vitaminB9:  0,   // µg
    vitaminB12: 0,   // µg
    iron:       0,   // mg
    calcium:    0,   // mg
    magnesium:  0,   // mg
    zinc:       0,   // mg
  };

  for (const entry of entries) {
    const ratio = (entry.quantity_g || 0) / 100;
    for (const key of Object.keys(totals)) {
      if (entry[key] != null) {
        totals[key] += entry[key] * ratio;
      }
    }
  }

  // Round to 2 decimal places
  for (const key of Object.keys(totals)) {
    totals[key] = Math.round(totals[key] * 100) / 100;
  }

  return totals;
}

module.exports = { lookupMicro, calcDeficiencies, calcMicronutrientsIntake, ANSES_REF, STATUS_LOW, STATUS_IMPROVE, STATUS_OK };
