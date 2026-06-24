// Catalogue des sauces & condiments (S15).
//
// kcal_per_100g : références INDICATIVES (spec S15). portion_default_g : pré-remplit l'éditeur.
// Les macros P/G/L exactes sont laissées à `null` → à compléter au seed via CIQUAL/OFF (REG-05).
// Pour étendre : ajouter une ligne `c(...)` dans la catégorie voulue (clé `key` stable et unique).
//
// c(key, fr, en, kcal_per_100g, portion_default_g, category)
const c = (key, fr, en, kcal, portion, category) => ({
  key, name_fr: fr, name_en: en, name_ar: null,
  kcal_per_100g: kcal, portion_default_g: portion, category,
  glucides: null, proteines: null, lipides: null, // à compléter via CIQUAL
});

// Sauces froides / émulsionnées
const FROIDES = [
  c('mayonnaise',       'Mayonnaise',          'Mayonnaise',          680, 15, 'condiment'),
  c('aioli',            'Aïoli',               'Aioli',               700, 15, 'condiment'),
  c('sauce_tartare',    'Sauce tartare',       'Tartar sauce',        580, 15, 'condiment'),
  c('sauce_cocktail',   'Sauce cocktail',      'Cocktail sauce',      450, 15, 'condiment'),
  c('sauce_andalouse',  'Sauce andalouse',     'Andalouse sauce',     480, 15, 'condiment'),
  c('sauce_samourai',   'Sauce samouraï',      'Samurai sauce',       470, 15, 'condiment'),
  c('sauce_algerienne', 'Sauce algérienne',    'Algerian sauce',      450, 15, 'condiment'),
  c('sauce_burger',     'Sauce burger',        'Burger sauce',        420, 15, 'condiment'),
  c('sauce_cesar',      'Sauce César',         'Caesar sauce',        450, 15, 'condiment'),
  c('sauce_blanche',    'Sauce blanche/kebab', 'White/kebab sauce',   350, 25, 'condiment'),
  c('sauce_yaourt',     'Sauce au yaourt',     'Yogurt sauce',        120, 25, 'condiment'),
  c('vinaigrette',      'Vinaigrette',         'Vinaigrette',         450, 10, 'condiment'),
  c('pesto',            'Pesto',               'Pesto',               450, 15, 'condiment'),
  c('tapenade',         'Tapenade',            'Tapenade',            250, 15, 'condiment'),
  c('houmous',          'Houmous',             'Hummus',              230, 30, 'condiment'),
  c('guacamole',        'Guacamole',           'Guacamole',           160, 30, 'condiment'),
];

// Sauces tomate / chaudes
const CHAUDES = [
  c('ketchup',          'Ketchup',             'Ketchup',             110, 15, 'condiment'),
  c('sauce_tomate',     'Sauce tomate nature', 'Plain tomato sauce',   35, 50, 'condiment'),
  c('bolognaise',       'Bolognaise',          'Bolognese',            90, 80, 'condiment'),
  c('barbecue',         'Barbecue',            'Barbecue sauce',      170, 20, 'condiment'),
  c('aigre_douce',      'Aigre-douce',         'Sweet and sour',      130, 30, 'condiment'),
  c('curry',            'Curry',               'Curry sauce',         110, 40, 'condiment'),
  c('satay',            'Satay/cacahuète',     'Satay/peanut sauce',  250, 30, 'condiment'),
  c('bechamel',         'Béchamel',            'Béchamel',            130, 50, 'condiment'),
  c('sauce_fromage',    'Sauce fromage',       'Cheese sauce',        180, 50, 'condiment'),
  c('sauce_poivre',     'Sauce poivre',        'Pepper sauce',        120, 40, 'condiment'),
  c('sauce_champignons','Sauce champignons',   'Mushroom sauce',       90, 50, 'condiment'),
  c('hollandaise',      'Hollandaise',         'Hollandaise',         520, 30, 'condiment'),
  c('bearnaise',        'Béarnaise',           'Béarnaise',           540, 30, 'condiment'),
  c('gravy',            'Gravy',               'Gravy',                60, 50, 'condiment'),
  c('chimichurri',      'Chimichurri',         'Chimichurri',         230, 15, 'condiment'),
];

// Asiatiques / pimentées
const ASIA = [
  c('sauce_soja',       'Sauce soja',          'Soy sauce',            60, 10, 'condiment'),
  c('teriyaki',         'Teriyaki',            'Teriyaki',             90, 15, 'condiment'),
  c('nuoc_mam',         'Nuoc-mâm',            'Fish sauce',           50, 10, 'condiment'),
  c('sriracha',         'Sriracha',            'Sriracha',            100, 10, 'condiment'),
  c('tabasco',          'Tabasco',             'Tabasco',              12,  5, 'condiment'),
  c('sambal_oelek',     'Sambal oelek',        'Sambal oelek',         80, 10, 'condiment'),
  c('chili_sucree',     'Sauce chili sucrée',  'Sweet chili sauce',   230, 15, 'condiment'),
  c('wasabi',           'Wasabi',              'Wasabi',              290,  5, 'condiment'),
  c('sauce_huitre',     'Sauce huître',        'Oyster sauce',         80, 15, 'condiment'),
];

// Maghreb / local
const MAGHREB = [
  c('harissa',          'Harissa',             'Harissa',              80, 10, 'condiment'),
  c('dersa',            'Dersa',               'Dersa',                60, 10, 'condiment'),
  c('chermoula',        'Chermoula',           'Chermoula',           200, 15, 'condiment'),
  c('smen',             'Smen (beurre clarifié)', 'Smen (clarified butter)', 880, 5, 'condiment'),
  c('felfel',           'Felfel/poivron grillé', 'Felfel/grilled pepper',   40, 30, 'condiment'),
];

// Condiments / assaisonnements
const ASSAISONNEMENTS = [
  c('huile_olive',      "Huile d'olive",       'Olive oil',           900, 10, 'condiment'),
  c('huile_tournesol',  'Huile de tournesol',  'Sunflower oil',       900, 10, 'condiment'),
  c('beurre',           'Beurre',              'Butter',              750, 10, 'condiment'),
  c('vinaigre_balsamique','Vinaigre balsamique','Balsamic vinegar',    90, 10, 'condiment'),
  c('vinaigre_cidre',   'Vinaigre de cidre',   'Cider vinegar',        20, 10, 'condiment'),
  c('jus_citron',       'Jus de citron',       'Lemon juice',          25,  5, 'condiment'),
  c('moutarde_douce',   'Moutarde douce',      'Mild mustard',        150, 10, 'condiment'),
  c('moutarde_forte',   'Moutarde forte',      'Strong mustard',      160, 10, 'condiment'),
  c('moutarde_ancienne','Moutarde à l\'ancienne','Wholegrain mustard',150, 10, 'condiment'),
  c('miel',             'Miel',                'Honey',               320, 15, 'condiment'),
  c('sirop_erable',     'Sirop d\'érable',     'Maple syrup',         260, 15, 'condiment'),
  c('confiture',        'Confiture',           'Jam',                 270, 15, 'condiment'),
  c('chutney',          'Chutney',             'Chutney',             180, 20, 'condiment'),
  c('worcestershire',   'Worcestershire',      'Worcestershire',       80, 10, 'condiment'),
  c('sauce_hp',         'Sauce HP/brune',      'HP/brown sauce',      110, 15, 'condiment'),
  c('relish',           'Relish',              'Relish',              130, 15, 'condiment'),
  c('cornichons',       'Cornichons',          'Gherkins',             15, 20, 'condiment'),
  c('capres',           'Câpres',              'Capers',               25, 10, 'condiment'),
  c('olives',           'Olives',              'Olives',              150, 20, 'condiment'),
  c('tahini',           'Tahini',              'Tahini',              600, 15, 'condiment'),
  c('levure_maltee',    'Levure maltée',       'Nutritional yeast',   350,  5, 'condiment'),
  c('raifort',          'Raifort',             'Horseradish',         110, 10, 'condiment'),
  c('ail',              'Ail',                 'Garlic',              150,  5, 'condiment'),
  c('gingembre',        'Gingembre',           'Ginger',               80,  5, 'condiment'),
  c('sel',              'Sel',                 'Salt',                  0,  1, 'condiment'),
  c('poivre',           'Poivre',              'Pepper',              250,  1, 'condiment'),
];

// Herbes & épices : apport calorique négligeable aux doses usuelles (kcal ≈ 0 par portion)
const HERBES = [
  c('persil',           'Persil',              'Parsley',               0,  1, 'herbe'),
  c('coriandre',        'Coriandre',           'Coriander',             0,  1, 'herbe'),
  c('basilic',          'Basilic',             'Basil',                 0,  1, 'herbe'),
  c('menthe',           'Menthe',              'Mint',                  0,  1, 'herbe'),
  c('cumin',            'Cumin',               'Cumin',                 0,  1, 'herbe'),
  c('paprika',          'Paprika',             'Paprika',               0,  1, 'herbe'),
  c('curry_poudre',     'Curry en poudre',     'Curry powder',          0,  1, 'herbe'),
  c('ras_el_hanout',    'Ras el hanout',       'Ras el hanout',         0,  1, 'herbe'),
  c('curcuma',          'Curcuma',             'Turmeric',              0,  1, 'herbe'),
  c('cannelle',         'Cannelle',            'Cinnamon',              0,  1, 'herbe'),
];

const ALL = [...FROIDES, ...CHAUDES, ...ASIA, ...MAGHREB, ...ASSAISONNEMENTS, ...HERBES];

module.exports = {
  CONDIMENTS: ALL,
  CATEGORIES: { froides: FROIDES, chaudes: CHAUDES, asia: ASIA, maghreb: MAGHREB, assaisonnements: ASSAISONNEMENTS, herbes: HERBES },
};
