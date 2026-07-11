const axios = require('axios');

const OFF_API = 'https://world.openfoodfacts.org/api/v0/product';
const OFF_SEARCH = 'https://world.openfoodfacts.org/cgi/search.pl';

/**
 * Recherche un produit par code-barres sur OpenFoodFacts
 * Retourne un objet normalisé NutraLance ou null si non trouvé
 */
async function lookupBarcode(barcode) {
  try {
    const { data } = await axios.get(`${OFF_API}/${barcode}.json`, { timeout: 6000 });

    if (data.status !== 1 || !data.product) return null;

    return normalizeOFFProduct(data.product, barcode);
  } catch (err) {
    console.error('[OpenFoodFacts] Erreur barcode lookup:', err.message);
    return null;
  }
}

/**
 * Recherche par nom sur OpenFoodFacts.
 * Stratégie double : Algérie en priorité, puis monde entier.
 * Les deux requêtes partent en parallèle ; on fusionne en dédupliquant.
 */
async function searchByName(query, limit = 8) {
  const [algRes, globalRes] = await Promise.allSettled([
    searchOFF(query, limit, 'algeria'),
    searchOFF(query, limit, null),
  ]);

  const alg    = algRes.status    === 'fulfilled' ? algRes.value    : [];
  const global = globalRes.status === 'fulfilled' ? globalRes.value : [];

  const seen = new Set();
  const merged = [];
  for (const p of [...alg, ...global]) {
    const key = p.barcode || p.name;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(p);
    }
    if (merged.length >= limit) break;
  }
  return merged;
}

/** Requête interne OpenFoodFacts avec filtre pays optionnel */
async function searchOFF(query, limit, country) {
  try {
    const params = {
      search_terms: query,
      search_simple: 1,
      action: 'process',
      json: 1,
      page_size: limit,
    };
    if (country) params.countries_tags = country;

    const { data } = await axios.get(OFF_SEARCH, { params, timeout: 8000 });
    if (!data.products?.length) return [];
    return data.products.map(p => normalizeOFFProduct(p)).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Normalise un produit OpenFoodFacts vers le format NutraLance
 */
function normalizeOFFProduct(p, barcode = null) {
  const n = p.nutriments || {};

  // Valeurs nutritionnelles pour 100g
  const kcal = n['energy-kcal_100g'] || n['energy_100g'] / 4.184 || 0;
  const glucides = n.carbohydrates_100g || 0;
  const proteines = n.proteins_100g || 0;
  const lipides = n.fat_100g || 0;
  const fibres = n.fiber_100g || 0;
  const sel = n.salt_100g || 0;
  const sucres = n.sugars_100g || 0;
  const graissesSat = n['saturated-fat_100g'] || 0;

  if (!kcal && !glucides && !proteines && !lipides) return null;

  // Score nutritionnel (Nutri-Score ou calculé)
  const score = p.nutriscore_grade?.toUpperCase() || computeScore({ kcal, glucides, lipides, fibres, proteines, sucres, graissesSat, sel });

  // Additifs
  const additifs = parseAdditifs(p.additives_tags || []);

  // Nom et marque (priorité FR/AR)
  const name = p.product_name_fr || p.product_name_ar || p.product_name || p.generic_name || 'Produit inconnu';
  const brand = p.brands?.split(',')[0]?.trim() || 'Marque inconnue';

  // Emoji selon catégorie
  const emoji = categoryEmoji(p.categories_tags || []);

  return {
    barcode: barcode || p.code || null,
    name,
    brand,
    emoji,
    score,
    kcal_per100: Math.round(kcal * 10) / 10,
    glucides: Math.round(glucides * 10) / 10,
    proteines: Math.round(proteines * 10) / 10,
    lipides: Math.round(lipides * 10) / 10,
    fibres: Math.round(fibres * 10) / 10,
    sel: Math.round(sel * 100) / 100,
    sucres: Math.round(sucres * 10) / 10,
    graisses_saturees: Math.round(graissesSat * 10) / 10,
    additifs,
    comment: buildComment(score, { kcal, proteines, fibres, lipides }),
    category: guessCategory(p.categories_tags || []),
    source: 'openfoodfacts',
    image_url: p.image_front_small_url || p.image_url || null,
    ingredients_text: p.ingredients_text_fr || p.ingredients_text || null
  };
}

/**
 * Calcule un Nutri-Score simplifié si absent
 * Basé sur les points négatifs (calories, sucres, graisses sat, sel)
 * et positifs (fibres, protéines)
 */
function computeScore({ kcal, sucres, graissesSat, sel, fibres, proteines }) {
  let neg = 0;
  // Points négatifs
  if (kcal > 800) neg += 10; else if (kcal > 600) neg += 7; else if (kcal > 400) neg += 4; else if (kcal > 200) neg += 2;
  if (sucres > 45) neg += 10; else if (sucres > 22.5) neg += 6; else if (sucres > 10) neg += 3;
  if (graissesSat > 10) neg += 10; else if (graissesSat > 4) neg += 5; else if (graissesSat > 2) neg += 2;
  if (sel > 1.5) neg += 7; else if (sel > 0.6) neg += 3;
  // Points positifs
  let pos = 0;
  if (fibres > 4.7) pos += 5; else if (fibres > 3.7) pos += 4; else if (fibres > 2.8) pos += 3; else if (fibres > 1.9) pos += 2; else if (fibres > 0.9) pos += 1;
  if (proteines > 8) pos += 5; else if (proteines > 6.4) pos += 4; else if (proteines > 4.8) pos += 3; else if (proteines > 3.2) pos += 2; else if (proteines > 1.6) pos += 1;

  const total = neg - pos;
  if (total <= 0) return 'A';
  if (total <= 3) return 'B';
  if (total <= 10) return 'C';
  if (total <= 18) return 'D';
  return 'E';
}

function parseAdditifs(tags) {
  const BAD = ['en:e102','en:e110','en:e122','en:e124','en:e129','en:e211','en:e220','en:e621','en:e631','en:e951'];
  const WARN = ['en:e471','en:e472','en:e322','en:e330','en:e300'];

  return tags
    .filter(t => t.startsWith('en:e'))
    .slice(0, 6)
    .map(t => {
      const code = t.replace('en:', '').toUpperCase();
      const type = BAD.includes(t) ? 'bad' : WARN.includes(t) ? 'warn' : 'ok';
      return { name: code, type };
    });
}

function buildComment(score, { kcal, proteines, fibres, lipides }) {
  const msgs = {
    A: 'Excellent choix nutritionnel.',
    B: 'Bon choix, à consommer régulièrement.',
    C: 'Qualité correcte — consommer avec modération.',
    D: 'À limiter dans votre alimentation quotidienne.',
    E: 'À éviter — profil nutritionnel défavorable.'
  };
  let comment = msgs[score] || msgs.C;
  if (proteines > 15) comment += ' Riche en protéines.';
  if (fibres > 4) comment += ' Bonne source de fibres.';
  if (lipides > 20) comment += ' Attention à la teneur en graisses.';
  return comment;
}

function categoryEmoji(tags) {
  const map = {
    'dairy': '🥛', 'milk': '🥛', 'cheese': '🧀', 'yogurt': '🥛',
    'bread': '🍞', 'cereals': '🥣', 'pasta': '🍝', 'rice': '🍚',
    'meat': '🥩', 'fish': '🐟', 'seafood': '🦐', 'eggs': '🥚',
    'fruits': '🍎', 'vegetables': '🥦', 'legumes': '🫘',
    'beverages': '🧃', 'water': '💧', 'juice': '🧃',
    'chocolate': '🍫', 'candy': '🍬', 'cookies': '🍪', 'biscuits': '🍪',
    'chips': '🍿', 'snacks': '🍿', 'nuts': '🥜',
    'oil': '🫙', 'butter': '🧈', 'condiment': '🫙',
    'honey': '🍯', 'jam': '🫐', 'sugar': '🍯',
    'coffee': '☕', 'tea': '🍵'
  };
  for (const tag of tags) {
    for (const [key, emoji] of Object.entries(map)) {
      if (tag.includes(key)) return emoji;
    }
  }
  return '🍽️';
}

function guessCategory(tags) {
  const map = {
    'dairy': 'laitiers', 'milk': 'laitiers', 'cheese': 'laitiers',
    'bread': 'cereales', 'cereals': 'cereales', 'pasta': 'cereales',
    'meat': 'proteines', 'fish': 'proteines', 'eggs': 'proteines',
    'legumes': 'legumineuses', 'beans': 'legumineuses',
    'beverages': 'boissons', 'juice': 'boissons', 'water': 'boissons',
    'biscuits': 'biscuits', 'cookies': 'biscuits',
    'chips': 'snacks', 'snacks': 'snacks',
    'oil': 'matieres_grasses', 'butter': 'matieres_grasses',
    'honey': 'sucres', 'sugar': 'sucres', 'jam': 'sucres',
    'fruits': 'fruits', 'vegetables': 'legumes'
  };
  for (const tag of tags) {
    for (const [key, cat] of Object.entries(map)) {
      if (tag.includes(key)) return cat;
    }
  }
  return 'divers';
}

module.exports = { lookupBarcode, searchByName, searchOFF, normalizeOFFProduct, computeScore };
