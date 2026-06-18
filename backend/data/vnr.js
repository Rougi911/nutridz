// Source : ANSES 2021 — Références Nutritionnelles pour la Population française
// https://www.anses.fr/fr/content/les-références-nutritionnelles-en-vitamines-et-minéraux
// Avis de l'Anses relatif à l'actualisation des repères nutritionnels du PNNS —
// Révision des références nutritionnelles pour la population française (adultes).
//
// Valeurs pour adultes (18–64 ans, hors grossesse/allaitement).
// Fer et Magnésium : valeurs différenciées homme/femme.
// Les VNR sont exprimées par jour.

const VNR = {
  vitaminC: {
    label:  'Vitamine C',
    unit:   'mg',
    male:   110,
    female: 110,
  },
  vitaminD: {
    label:  'Vitamine D',
    unit:   'µg',
    male:   15,
    female: 15,
  },
  vitaminB9: {
    label:  'Vitamine B9 (Folates)',
    unit:   'µg',
    male:   330,
    female: 330,
  },
  vitaminB12: {
    label:  'Vitamine B12',
    unit:   'µg',
    male:   4,
    female: 4,
  },
  iron: {
    label:  'Fer',
    unit:   'mg',
    male:   11,
    female: 16,
  },
  calcium: {
    label:  'Calcium',
    unit:   'mg',
    male:   950,
    female: 950,
  },
  magnesium: {
    label:  'Magnésium',
    unit:   'mg',
    male:   380,
    female: 300,
  },
  zinc: {
    label:  'Zinc',
    unit:   'mg',
    male:   11,
    female: 8,
  },
};

module.exports = { VNR };
