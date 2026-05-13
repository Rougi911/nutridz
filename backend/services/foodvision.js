const axios = require('axios');

const CLARIFAI_API_URL = 'https://api.clarifai.com/v2/models/food-item-recognition/versions/dde2543f774a4ef1b7e318dc0cfbba15/outputs';

// ─── Base nutritionnelle locale (pour 100g) ───────────────────────────────────
// portion = taille de portion typique en g (utilisée pour l'estimation des quantités)
const NUTRITION_DB = {
  // Cuisine algérienne
  couscous:      { nom_fr: 'Couscous',       kcal: 356, glucides: 72,  proteines: 12, lipides: 2,    fibres: 5,   sel: 0.01, portion: 200, emoji: '🥣',  nom_ar: 'كسكسي',   cuisine: 'algérienne' },
  chakhchoukha:  { nom_fr: 'Chakhchoukha',   kcal: 300, glucides: 45,  proteines: 12, lipides: 8,    fibres: 3,   sel: 1.0,  portion: 250, emoji: '🥣',  nom_ar: 'شخشوخة',  cuisine: 'algérienne' },
  rechta:        { nom_fr: 'Rechta',          kcal: 340, glucides: 70,  proteines: 11, lipides: 2,    fibres: 3,   sel: 0.5,  portion: 200, emoji: '🍜',  nom_ar: 'رشتة',    cuisine: 'algérienne' },
  chorba:        { nom_fr: 'Chorba',          kcal: 85,  glucides: 8,   proteines: 6,  lipides: 3,    fibres: 2,   sel: 1.2,  portion: 300, emoji: '🍲',  nom_ar: 'شوربة',   cuisine: 'algérienne' },
  harira:        { nom_fr: 'Harira',          kcal: 90,  glucides: 10,  proteines: 5,  lipides: 3,    fibres: 3,   sel: 1.0,  portion: 300, emoji: '🍵',  nom_ar: 'حريرة',   cuisine: 'algérienne' },
  tajine:        { nom_fr: 'Tajine',          kcal: 180, glucides: 8,   proteines: 18, lipides: 9,    fibres: 2,   sel: 1.5,  portion: 300, emoji: '🫕',  nom_ar: 'طاجين',   cuisine: 'algérienne' },
  merguez:       { nom_fr: 'Merguez',         kcal: 320, glucides: 2,   proteines: 18, lipides: 26,   fibres: 0,   sel: 2.0,  portion: 120, emoji: '🌭',  nom_ar: 'مرقاز',   cuisine: 'algérienne' },
  kefta:         { nom_fr: 'Kefta',           kcal: 265, glucides: 5,   proteines: 20, lipides: 18,   fibres: 0.5, sel: 1.8,  portion: 150, emoji: '🍢',  nom_ar: 'كفتة',    cuisine: 'algérienne' },
  bourek:        { nom_fr: 'Bourek',          kcal: 280, glucides: 25,  proteines: 10, lipides: 15,   fibres: 1,   sel: 1.0,  portion: 100, emoji: '🫔',  nom_ar: 'بورك',    cuisine: 'algérienne' },
  garantita:     { nom_fr: 'Garantita',       kcal: 185, glucides: 20,  proteines: 8,  lipides: 8,    fibres: 2,   sel: 1.2,  portion: 150, emoji: '🥘',  nom_ar: 'قرنيطة',  cuisine: 'algérienne' },
  dolma:         { nom_fr: 'Dolma',           kcal: 160, glucides: 15,  proteines: 8,  lipides: 8,    fibres: 2,   sel: 1.0,  portion: 200, emoji: '🫑',  nom_ar: 'دولمة',   cuisine: 'algérienne' },
  berkoukes:     { nom_fr: 'Berkoukes',       kcal: 320, glucides: 60,  proteines: 10, lipides: 5,    fibres: 4,   sel: 0.8,  portion: 200, emoji: '🥣',  nom_ar: 'بركوكس',  cuisine: 'algérienne' },
  makroud:       { nom_fr: 'Makroud',         kcal: 420, glucides: 65,  proteines: 5,  lipides: 16,   fibres: 3,   sel: 0.3,  portion: 80,  emoji: '🍮',  nom_ar: 'مقروض',   cuisine: 'algérienne' },
  baklava:       { nom_fr: 'Baklava',         kcal: 428, glucides: 50,  proteines: 6,  lipides: 24,   fibres: 2,   sel: 0.3,  portion: 80,  emoji: '🍯',  nom_ar: 'بقلاوة',  cuisine: 'méditerranéenne' },
  // Céréales / féculents
  bread:         { nom_fr: 'Pain',            kcal: 265, glucides: 51,  proteines: 9,  lipides: 3,    fibres: 2.7, sel: 1.2,  portion: 80,  emoji: '🍞',  nom_ar: 'خبز',     cuisine: null },
  rice:          { nom_fr: 'Riz',             kcal: 350, glucides: 77,  proteines: 7,  lipides: 1,    fibres: 1,   sel: 0,    portion: 180, emoji: '🍚',  nom_ar: 'أرز',     cuisine: null },
  pasta:         { nom_fr: 'Pâtes',           kcal: 358, glucides: 71,  proteines: 13, lipides: 2,    fibres: 3,   sel: 0,    portion: 180, emoji: '🍝',  nom_ar: 'معكرونة', cuisine: null },
  potato:        { nom_fr: 'Pomme de terre',  kcal: 87,  glucides: 20,  proteines: 2,  lipides: 0.1,  fibres: 2,   sel: 0,    portion: 200, emoji: '🥔',  nom_ar: 'بطاطا',   cuisine: null },
  // Protéines animales
  chicken:       { nom_fr: 'Poulet',          kcal: 165, glucides: 0,   proteines: 31, lipides: 4,    fibres: 0,   sel: 0.8,  portion: 200, emoji: '🍗',  nom_ar: 'دجاج',    cuisine: null },
  beef:          { nom_fr: 'Bœuf',            kcal: 250, glucides: 0,   proteines: 26, lipides: 16,   fibres: 0,   sel: 0.7,  portion: 150, emoji: '🥩',  nom_ar: 'لحم بقري', cuisine: null },
  lamb:          { nom_fr: 'Agneau',          kcal: 294, glucides: 0,   proteines: 25, lipides: 21,   fibres: 0,   sel: 0.7,  portion: 150, emoji: '🍖',  nom_ar: 'لحم غنم', cuisine: null },
  fish:          { nom_fr: 'Poisson',         kcal: 145, glucides: 0,   proteines: 22, lipides: 6,    fibres: 0,   sel: 0.6,  portion: 180, emoji: '🐟',  nom_ar: 'سمك',     cuisine: null },
  sardine:       { nom_fr: 'Sardines',        kcal: 208, glucides: 0,   proteines: 25, lipides: 12,   fibres: 0,   sel: 1.3,  portion: 150, emoji: '🐟',  nom_ar: 'سردين',   cuisine: null },
  egg:           { nom_fr: 'Œuf',             kcal: 155, glucides: 1,   proteines: 13, lipides: 11,   fibres: 0,   sel: 0.4,  portion: 100, emoji: '🥚',  nom_ar: 'بيض',     cuisine: null },
  // Légumes
  tomato:        { nom_fr: 'Tomate',          kcal: 18,  glucides: 4,   proteines: 1,  lipides: 0.2,  fibres: 1.2, sel: 0,    portion: 150, emoji: '🍅',  nom_ar: 'طماطم',   cuisine: null },
  carrot:        { nom_fr: 'Carotte',         kcal: 41,  glucides: 10,  proteines: 1,  lipides: 0.2,  fibres: 2.8, sel: 0.1,  portion: 100, emoji: '🥕',  nom_ar: 'جزر',     cuisine: null },
  onion:         { nom_fr: 'Oignon',          kcal: 40,  glucides: 9,   proteines: 1,  lipides: 0.1,  fibres: 1.7, sel: 0,    portion: 80,  emoji: '🧅',  nom_ar: 'بصل',     cuisine: null },
  pepper:        { nom_fr: 'Poivron',         kcal: 31,  glucides: 6,   proteines: 1,  lipides: 0.3,  fibres: 2.1, sel: 0,    portion: 100, emoji: '🌶️', nom_ar: 'فلفل',    cuisine: null },
  zucchini:      { nom_fr: 'Courgette',       kcal: 17,  glucides: 3.1, proteines: 1.2,lipides: 0.3,  fibres: 1,   sel: 0,    portion: 150, emoji: '🥒',  nom_ar: 'قرع',     cuisine: null },
  eggplant:      { nom_fr: 'Aubergine',       kcal: 25,  glucides: 6,   proteines: 1,  lipides: 0.2,  fibres: 3,   sel: 0,    portion: 150, emoji: '🍆',  nom_ar: 'باذنجان', cuisine: null },
  salad:         { nom_fr: 'Salade',          kcal: 20,  glucides: 3,   proteines: 1.5,lipides: 0.3,  fibres: 2,   sel: 0.1,  portion: 200, emoji: '🥗',  nom_ar: 'سلطة',    cuisine: null },
  // Légumineuses
  chickpea:      { nom_fr: 'Pois chiches',    kcal: 164, glucides: 27,  proteines: 9,  lipides: 2.6,  fibres: 7,   sel: 0.5,  portion: 150, emoji: '🫘',  nom_ar: 'حمص',     cuisine: null },
  lentil:        { nom_fr: 'Lentilles',       kcal: 116, glucides: 20,  proteines: 9,  lipides: 0.4,  fibres: 8,   sel: 0,    portion: 150, emoji: '🫘',  nom_ar: 'عدس',     cuisine: null },
  // Laitiers
  yogurt:        { nom_fr: 'Yaourt',          kcal: 61,  glucides: 5,   proteines: 4,  lipides: 3,    fibres: 0,   sel: 0.1,  portion: 150, emoji: '🥛',  nom_ar: 'زبادي',   cuisine: null },
  cheese:        { nom_fr: 'Fromage',         kcal: 402, glucides: 1.3, proteines: 25, lipides: 33,   fibres: 0,   sel: 1.8,  portion: 40,  emoji: '🧀',  nom_ar: 'جبن',     cuisine: null },
  // Fruits
  date:          { nom_fr: 'Dattes',          kcal: 282, glucides: 75,  proteines: 2.5,lipides: 0.4,  fibres: 8,   sel: 0,    portion: 50,  emoji: '🌴',  nom_ar: 'تمر',     cuisine: 'algérienne' },
  apple:         { nom_fr: 'Pomme',           kcal: 52,  glucides: 14,  proteines: 0.3,lipides: 0.2,  fibres: 2.4, sel: 0,    portion: 150, emoji: '🍎',  nom_ar: 'تفاح',    cuisine: null },
  orange:        { nom_fr: 'Orange',          kcal: 47,  glucides: 12,  proteines: 0.9,lipides: 0.1,  fibres: 2.4, sel: 0,    portion: 150, emoji: '🍊',  nom_ar: 'برتقال',  cuisine: null },
  banana:        { nom_fr: 'Banane',          kcal: 89,  glucides: 23,  proteines: 1.1,lipides: 0.3,  fibres: 2.6, sel: 0,    portion: 120, emoji: '🍌',  nom_ar: 'موز',     cuisine: null },
  // Fast-food / international
  pizza:         { nom_fr: 'Pizza',           kcal: 266, glucides: 33,  proteines: 11, lipides: 10,   fibres: 2.3, sel: 1.5,  portion: 200, emoji: '🍕',  nom_ar: null,      cuisine: 'internationale' },
  burger:        { nom_fr: 'Burger',          kcal: 295, glucides: 24,  proteines: 17, lipides: 14,   fibres: 1,   sel: 1.8,  portion: 200, emoji: '🍔',  nom_ar: null,      cuisine: 'internationale' },
  sandwich:      { nom_fr: 'Sandwich',        kcal: 250, glucides: 30,  proteines: 12, lipides: 9,    fibres: 2,   sel: 1.5,  portion: 200, emoji: '🥪',  nom_ar: null,      cuisine: 'internationale' },
  fries:         { nom_fr: 'Frites',          kcal: 312, glucides: 41,  proteines: 3.4,lipides: 15,   fibres: 3,   sel: 0.6,  portion: 150, emoji: '🍟',  nom_ar: null,      cuisine: 'internationale' },
  soup:          { nom_fr: 'Soupe',           kcal: 72,  glucides: 8,   proteines: 4,  lipides: 2,    fibres: 2,   sel: 1.0,  portion: 300, emoji: '🍵',  nom_ar: 'شوربة',   cuisine: null },
  cake:          { nom_fr: 'Gâteau',          kcal: 347, glucides: 55,  proteines: 5,  lipides: 13,   fibres: 1,   sel: 0.5,  portion: 100, emoji: '🎂',  nom_ar: null,      cuisine: null },
};

// ─── Correspondances labels Clarifai → clés NUTRITION_DB ─────────────────────
const LABEL_MAP = {
  'couscous': 'couscous', 'chakhchoukha': 'chakhchoukha', 'rechta': 'rechta',
  'chorba': 'chorba', 'harira': 'harira', 'tajine': 'tajine', 'tagine': 'tajine',
  'merguez': 'merguez', 'sausage': 'merguez', 'spicy sausage': 'merguez',
  'kefta': 'kefta', 'kebab': 'kefta', 'meatball': 'kefta', 'kofte': 'kefta',
  'bourek': 'bourek', 'borek': 'bourek', 'brik': 'bourek', 'spring roll': 'bourek',
  'garantita': 'garantita', 'dolma': 'dolma', 'stuffed pepper': 'dolma',
  'berkoukes': 'berkoukes', 'makroud': 'makroud', 'baklava': 'baklava',
  'bread': 'bread', 'pita': 'bread', 'flatbread': 'bread', 'baguette': 'bread', 'khobz': 'bread',
  'rice': 'rice', 'white rice': 'rice', 'fried rice': 'rice', 'pilaf': 'rice',
  'pasta': 'pasta', 'noodle': 'pasta', 'spaghetti': 'pasta', 'macaroni': 'pasta',
  'potato': 'potato', 'mashed potato': 'potato', 'boiled potato': 'potato',
  'chicken': 'chicken', 'roast chicken': 'chicken', 'grilled chicken': 'chicken',
  'beef': 'beef', 'steak': 'beef', 'ground beef': 'beef', 'veal': 'beef',
  'lamb': 'lamb', 'mutton': 'lamb', 'sheep': 'lamb',
  'fish': 'fish', 'salmon': 'fish', 'tuna': 'fish', 'cod': 'fish', 'tilapia': 'fish',
  'sardine': 'sardine', 'sardines': 'sardine',
  'egg': 'egg', 'eggs': 'egg', 'fried egg': 'egg', 'omelette': 'egg', 'scrambled egg': 'egg',
  'tomato': 'tomato', 'cherry tomato': 'tomato',
  'carrot': 'carrot', 'onion': 'onion', 'shallot': 'onion',
  'pepper': 'pepper', 'bell pepper': 'pepper', 'capsicum': 'pepper',
  'zucchini': 'zucchini', 'courgette': 'zucchini',
  'eggplant': 'eggplant', 'aubergine': 'eggplant',
  'salad': 'salad', 'green salad': 'salad', 'lettuce': 'salad',
  'chickpea': 'chickpea', 'hummus': 'chickpea', 'chick pea': 'chickpea',
  'lentil': 'lentil', 'lentils': 'lentil',
  'yogurt': 'yogurt', 'yoghurt': 'yogurt',
  'cheese': 'cheese',
  'date': 'date', 'dates': 'date',
  'apple': 'apple', 'orange': 'orange', 'banana': 'banana',
  'pizza': 'pizza', 'burger': 'burger', 'hamburger': 'burger',
  'sandwich': 'sandwich', 'wrap': 'sandwich', 'sub': 'sandwich',
  'french fries': 'fries', 'fries': 'fries', 'chips': 'fries',
  'soup': 'soup', 'stew': 'soup', 'broth': 'soup',
  'cake': 'cake', 'pastry': 'cake', 'dessert': 'cake',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findInDB(clarifaiLabel) {
  const lower = clarifaiLabel.toLowerCase().trim();
  if (LABEL_MAP[lower]) return LABEL_MAP[lower];
  // Correspondance partielle
  for (const [label, key] of Object.entries(LABEL_MAP)) {
    if (lower.includes(label) || label.includes(lower)) return key;
  }
  return null;
}

function buildAliment(dbKey, isMain, confiance_pct) {
  const nutr = NUTRITION_DB[dbKey];
  const ratio = nutr.portion / 100;
  return {
    nom: nutr.nom_fr,
    nom_ar: nutr.nom_ar || null,
    quantite_g: nutr.portion,
    fourchette: { min: Math.round(nutr.portion * 0.7), max: Math.round(nutr.portion * 1.3) },
    kcal: Math.round(nutr.kcal * ratio),
    glucides: Math.round(nutr.glucides * ratio * 10) / 10,
    proteines: Math.round(nutr.proteines * ratio * 10) / 10,
    lipides: Math.round(nutr.lipides * ratio * 10) / 10,
    fibres: Math.round(nutr.fibres * ratio * 10) / 10,
    emoji: nutr.emoji,
    est_principal: isMain,
    confiance_detection: confiance_pct,
    _dbKey: dbKey,
  };
}

function calculateTotals(aliments) {
  const sum = (k) => aliments.reduce((s, a) => s + (a[k] || 0), 0);
  const kcal = Math.round(sum('kcal'));
  return {
    kcal,
    kcal_min: Math.round(kcal * 0.8),
    kcal_max: Math.round(kcal * 1.2),
    glucides:  Math.round(sum('glucides')  * 10) / 10,
    proteines: Math.round(sum('proteines') * 10) / 10,
    lipides:   Math.round(sum('lipides')   * 10) / 10,
    fibres:    Math.round(sum('fibres')    * 10) / 10,
    sel_estime: Math.round(aliments.reduce((s, a) => {
      const n = NUTRITION_DB[a._dbKey];
      return s + (n ? n.sel * (a.quantite_g / 100) : 0);
    }, 0) * 10) / 10,
  };
}

function detectCuisine(aliments) {
  const algKeys = ['couscous', 'chakhchoukha', 'rechta', 'chorba', 'harira', 'tajine', 'merguez', 'kefta', 'bourek', 'garantita', 'dolma', 'berkoukes', 'makroud'];
  if (aliments.some(a => algKeys.includes(a._dbKey))) return 'algérienne';
  if (aliments.some(a => ['pizza', 'burger', 'fries', 'sandwich'].includes(a._dbKey))) return 'internationale';
  return 'méditerranéenne';
}

function nutritionScore(totaux) {
  let score = 0;
  if (totaux.fibres > 10) score += 2; else if (totaux.fibres > 5) score += 1;
  if (totaux.proteines > 20) score += 2; else if (totaux.proteines > 10) score += 1;
  if (totaux.lipides > 40) score -= 2; else if (totaux.lipides > 25) score -= 1;
  if (totaux.kcal > 800) score -= 2; else if (totaux.kcal > 600) score -= 1;
  return score >= 3 ? 'A' : score >= 1 ? 'B' : score >= -1 ? 'C' : 'D';
}

function generateConseil(totaux, goal) {
  if (!goal || goal === 'maintien') {
    if (totaux.fibres >= 10) return `Excellent équilibre ! Repas riche en fibres (${totaux.fibres}g) — idéal pour le maintien.`;
    if (totaux.proteines < 10) return `Repas pauvre en protéines (${totaux.proteines}g). Ajoutez une source protéinée (viande, légumineuses, œufs).`;
  }
  if (goal === 'perte' && totaux.kcal > 600) return `Ce repas apporte ${totaux.kcal} kcal. Pour votre objectif perte de poids, réduisez les portions ou évitez les féculents.`;
  if (goal === 'prise' && totaux.kcal < 500) return `Repas trop léger pour la prise de masse (${totaux.kcal} kcal). Ajoutez des glucides complexes ou des protéines.`;
  return `Repas de ${totaux.kcal} kcal — ${totaux.proteines}g de protéines, ${totaux.glucides}g de glucides, ${totaux.lipides}g de lipides.`;
}

function generateTags(aliments, totaux) {
  const tags = [];
  if (totaux.proteines > 20) tags.push('riche en protéines');
  if (totaux.fibres > 8) tags.push('riche en fibres');
  if (totaux.kcal < 400) tags.push('léger');
  if (totaux.kcal > 700) tags.push('calorique');
  if (aliments.some(a => NUTRITION_DB[a._dbKey]?.cuisine === 'algérienne')) tags.push('cuisine algérienne');
  if (aliments.some(a => ['chickpea', 'lentil'].includes(a._dbKey))) tags.push('légumineuses');
  if (aliments.some(a => ['chicken', 'beef', 'lamb', 'fish', 'egg', 'merguez', 'kefta', 'sardine'].includes(a._dbKey))) tags.push('source de protéines');
  return tags;
}

function enrichAnalysis(data, weightKg = 70) {
  const totaux = data.totaux || {};
  const effortPhysique = {
    marche:   calcEffort(totaux.kcal, 3.5, weightKg),
    velo:     calcEffort(totaux.kcal, 6.0, weightKg),
    course:   calcEffort(totaux.kcal, 9.0, weightKg),
    natation: calcEffort(totaux.kcal, 7.0, weightKg),
  };
  const satietePts = (totaux.proteines || 0) * 0.4 + (totaux.fibres || 0) * 0.6;
  const satiete = satietePts > 20 ? 'Très rassasiant' : satietePts > 12 ? 'Rassasiant' : satietePts > 6 ? 'Modérément rassasiant' : 'Peu rassasiant';
  const totalKcalMacros = (totaux.glucides || 0) * 4 + (totaux.proteines || 0) * 4 + (totaux.lipides || 0) * 9;
  const macros_pct = totalKcalMacros > 0 ? {
    glucides:  Math.round((totaux.glucides  * 4 / totalKcalMacros) * 100),
    proteines: Math.round((totaux.proteines * 4 / totalKcalMacros) * 100),
    lipides:   Math.round((totaux.lipides   * 9 / totalKcalMacros) * 100),
  } : { glucides: 0, proteines: 0, lipides: 0 };
  return {
    ...data,
    effort_physique: effortPhysique,
    satiete,
    macros_pct,
    incertitude_pct: data.confiance === 'haute' ? 10 : data.confiance === 'moyenne' ? 20 : 35,
  };
}

function calcEffort(kcal, met, weightKg) {
  if (!kcal || !weightKg) return 0;
  return Math.round(kcal / (met * weightKg * 3.5 / 200));
}

// ─── Appel Clarifai ───────────────────────────────────────────────────────────
async function callClarifai(base64Image) {
  // Strip le préfixe data URI si présent (ex: "data:image/jpeg;base64,...")
  const clean = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  const res = await axios.post(
    CLARIFAI_API_URL,
    { inputs: [{ data: { image: { base64: clean } } }] },
    {
      headers: {
        'Authorization': `Key ${process.env.CLARIFAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );
  return res.data?.outputs?.[0]?.data?.concepts || [];
}

function conceptsToAliments(concepts, minConfidence = 0.5, maxItems = 6) {
  const seen = new Set();
  const aliments = [];
  for (const c of concepts) {
    if (c.value < minConfidence) break;
    const dbKey = findInDB(c.name);
    if (!dbKey || seen.has(dbKey)) continue;
    seen.add(dbKey);
    aliments.push(buildAliment(dbKey, aliments.length === 0, Math.round(c.value * 100)));
    if (aliments.length >= maxItems) break;
  }
  return aliments;
}

// ─── API publique (même interface que l'ancienne version Anthropic) ───────────

async function analyzeDishPhoto(base64Image, mediaType = 'image/jpeg', context = {}) {
  const { weight = 70, goal = 'maintien' } = context;
  try {
    const concepts = await callClarifai(base64Image);

    if (!concepts.length || concepts[0].value < 0.4) {
      return { success: false, error: 'Aucun aliment détecté. Prenez la photo de plus près avec une bonne lumière.' };
    }

    const aliments = conceptsToAliments(concepts);
    if (!aliments.length) {
      return { success: false, error: 'Aliments non reconnus. Essayez une photo plus nette.' };
    }

    const totaux = calculateTotals(aliments);
    const avgConf = concepts.slice(0, aliments.length).reduce((s, c) => s + c.value, 0) / aliments.length;
    const confiance = avgConf > 0.85 ? 'haute' : avgConf > 0.65 ? 'moyenne' : 'faible';

    const result = {
      plat_identifie: aliments[0].nom,
      cuisine: detectCuisine(aliments),
      confiance,
      aliments,
      totaux,
      score_nutritionnel: nutritionScore(totaux),
      conseil: generateConseil(totaux, goal),
      tags: generateTags(aliments, totaux),
      plats_similaires: [],
      erreur: null,
    };

    return { success: true, data: enrichAnalysis(result, weight) };

  } catch (err) {
    const status = err.response?.status;
    console.error('[FoodVision/Clarifai] Erreur:', status, err.message);
    console.error('Clarifai error response:', JSON.stringify(err.response?.data, null, 2));
    if (status === 401) return { success: false, error: 'Clé API Clarifai invalide ou manquante.' };
    if (status === 400) return { success: false, error: `Requête Clarifai invalide : ${err.message}` };
    return { success: false, error: "Erreur lors de l'analyse du plat." };
  }
}

async function analyzeMultiplePhotos(images, context = {}) {
  const { weight = 70 } = context;
  try {
    // Analyser chaque photo et fusionner en gardant la meilleure confiance par aliment
    const bestConcepts = new Map();
    for (const { base64 } of images) {
      const concepts = await callClarifai(base64);
      for (const c of concepts) {
        if (!bestConcepts.has(c.name) || bestConcepts.get(c.name) < c.value) {
          bestConcepts.set(c.name, c.value);
        }
      }
    }

    const merged = [...bestConcepts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    const aliments = conceptsToAliments(merged, 0.5, 8);
    if (!aliments.length) return { success: false, error: 'Aucun aliment reconnu sur les photos.' };

    const totaux = calculateTotals(aliments);
    const result = {
      plat_identifie: aliments[0].nom,
      cuisine: detectCuisine(aliments),
      confiance: 'haute',
      aliments, totaux,
      score_nutritionnel: nutritionScore(totaux),
      conseil: generateConseil(totaux, context.goal || 'maintien'),
      tags: generateTags(aliments, totaux),
      plats_similaires: [],
      erreur: null,
    };
    return { success: true, data: enrichAnalysis(result, weight) };

  } catch (err) {
    console.error('[FoodVision/Clarifai] Multi-photos erreur:', err.message);
    return { success: false, error: 'Analyse multi-photos impossible.' };
  }
}

// Affinage local : ajuste les quantités et ajoute les aliments mentionnés par l'utilisateur
async function refineAnalysis(previousAnalysis, userCorrection) {
  try {
    const correction = userCorrection.toLowerCase();
    const analysis = JSON.parse(JSON.stringify(previousAnalysis)); // deep copy

    // Ajustement de portion
    let factor = 1;
    if (/petit|petite|moins|réduit|small|less/.test(correction)) factor = 0.75;
    else if (/grand|grande|plus|large|gros|beaucoup/.test(correction)) factor = 1.3;

    if (factor !== 1) {
      analysis.aliments = analysis.aliments.map(a => ({
        ...a,
        quantite_g:  Math.round(a.quantite_g  * factor),
        kcal:        Math.round(a.kcal        * factor),
        glucides:    Math.round(a.glucides     * factor * 10) / 10,
        proteines:   Math.round(a.proteines   * factor * 10) / 10,
        lipides:     Math.round(a.lipides      * factor * 10) / 10,
        fibres:      Math.round(a.fibres       * factor * 10) / 10,
        fourchette:  { min: Math.round(a.fourchette.min * factor), max: Math.round(a.fourchette.max * factor) },
      }));
    }

    // Ajout d'un aliment mentionné
    for (const [label, dbKey] of Object.entries(LABEL_MAP)) {
      if (correction.includes(label) && !analysis.aliments.find(a => a._dbKey === dbKey)) {
        analysis.aliments.push(buildAliment(dbKey, false, 100));
        analysis.conseil = `${NUTRITION_DB[dbKey].nom_fr} ajouté. ` + analysis.conseil;
        break;
      }
    }

    analysis.totaux = calculateTotals(analysis.aliments);
    analysis.score_nutritionnel = nutritionScore(analysis.totaux);

    return { success: true, data: analysis };
  } catch {
    return { success: false, error: "Impossible d'affiner l'analyse." };
  }
}

module.exports = { analyzeDishPhoto, analyzeMultiplePhotos, refineAnalysis };
