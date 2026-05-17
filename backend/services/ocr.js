const { createWorker } = require('tesseract.js');

// ─── OCR local via Tesseract.js (gratuit, 100% offline après premier téléchargement) ──

/**
 * Lit une photo d'étiquette nutritionnelle et extrait les valeurs.
 * Accepte un Buffer ou une chaîne base64.
 */
async function extractNutritionFromImage(imageInput, _mediaType = 'image/jpeg') {
  const buffer = Buffer.isBuffer(imageInput)
    ? imageInput
    : Buffer.from(imageInput, 'base64');

  let worker;
  try {
    // fra = français · ara = arabe · eng = anglais (mots-clés)
    // logger: () => {} supprime les logs de progression Tesseract
    worker = await createWorker('fra+ara+eng', 1, { logger: () => {} });
    const { data } = await worker.recognize(buffer);
    const { text, confidence } = data;

    if (!text || text.trim().length < 15) {
      return {
        success: false,
        error: "Texte illisible. Rapprochez-vous de l'étiquette et assurez une bonne lumière."
      };
    }

    const nutrition = parseNutritionText(text);
    const hasValues = nutrition.kcal_per100 || nutrition.proteines
                   || nutrition.lipides    || nutrition.glucides;

    if (!hasValues) {
      return {
        success: false,
        error: 'Tableau nutritionnel non détecté. Photographiez le tableau des valeurs nutritionnelles en entier.',
        raw_text: text.slice(0, 400)
      };
    }

    const confiance = confidence > 70 ? 'haute' : confidence > 40 ? 'moyenne' : 'faible';

    return {
      success: true,
      data: enrichOCRResult({
        name: nutrition.name || 'Produit scanné',
        brand: '',
        confiance,
        ...nutrition
      })
    };

  } catch (err) {
    console.error('[Tesseract OCR] Erreur:', err.message);
    return { success: false, error: "Erreur lors de l'analyse de l'image." };
  } finally {
    if (worker) await worker.terminate().catch(() => {});
  }
}

// ─── Parsing du texte OCR — regex FR + AR ────────────────────────────────────

function parseNutritionText(rawText) {
  // Normalisation : virgule décimale FR → point, artefacts OCR courants
  const text = rawText
    .replace(/(\d),(\d)/g, '$1.$2')   // 3,2 → 3.2
    .replace(/[|lI](?=\d)/g, '1')     // l/I/| → 1 devant un chiffre
    .replace(/(?<=\d)[oO](?=\s|g|$)/g, '0'); // o/O → 0 après un chiffre

  // Extrait le 1er nombre décimal valide après l'un des motifs
  const pick = (...patterns) => {
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v >= 0 && v < 10000) return v;
      }
    }
    return 0;
  };

  // --- Énergie (kcal) ---
  let kcal_per100 = pick(
    /(?:énergie|energie|energy|valeur[^:\n]*énergétique)[^\n]*?(\d+\.?\d*)\s*kcal/i,
    /(?:سعرات حرارية|طاقة)[^\n\d]*(\d+\.?\d*)/,
    /(\d{2,4})\s*kcal/i
  );
  // Fallback kJ → kcal
  if (!kcal_per100) {
    const kj = pick(
      /(?:énergie|energie|energy)[^\n]*?(\d+\.?\d*)\s*kJ/i,
      /(\d{3,5})\s*kJ/i
    );
    if (kj) kcal_per100 = Math.round(kj / 4.184);
  }

  // --- Lipides / Matières grasses ---
  const lipides = pick(
    /(?:matières?\s*grasses?|lipides?|fat(?:\s*total)?)[^\n]*?(\d+\.?\d*)\s*g/i,
    /(?:دهون|ليبيدات|مواد دهنية)[^\n\d]*(\d+\.?\d*)/
  );

  // --- Acides gras saturés ---
  const graisses_saturees = pick(
    /(?:dont\s*)?(?:acides?\s*gras\s*saturés?|saturated\s*fat)[^\n]*?(\d+\.?\d*)\s*g/i,
    /(?:أحماض دهنية مشبعة|دهون مشبعة)[^\n\d]*(\d+\.?\d*)/
  );

  // --- Glucides ---
  const glucides = pick(
    /(?:glucides?|carbohydrate)[^\n]*?(\d+\.?\d*)\s*g/i,
    /(?:كربوهيدرات|نشويات)[^\n\d]*(\d+\.?\d*)/
  );

  // --- Sucres ---
  const sucres = pick(
    /(?:dont\s*)?(?:sucres?|sugars?)[^\n]*?(\d+\.?\d*)\s*g/i,
    /(?:سكريات)[^\n\d]*(\d+\.?\d*)/
  );

  // --- Protéines ---
  const proteines = pick(
    /(?:protéines?|proteines?|proteins?)[^\n]*?(\d+\.?\d*)\s*g/i,
    /(?:بروتين|بروتينات)[^\n\d]*(\d+\.?\d*)/
  );

  // --- Fibres ---
  const fibres = pick(
    /(?:fibres?\s*(?:alimentaires?)?|dietary\s*fibre)[^\n]*?(\d+\.?\d*)\s*g/i,
    /(?:ألياف)[^\n\d]*(\d+\.?\d*)/
  );

  // --- Sel / Sodium ---
  let sel = pick(
    /\bsel\b[^\n]*?(\d+\.?\d*)\s*g/im,
    /\bsalt\b[^\n]*?(\d+\.?\d*)\s*g/i,
    /(?:ملح)[^\n\d]*(\d+\.?\d*)/
  );
  if (!sel) {
    const sodMg = pick(/\bsodium\b[^\n]*?(\d+\.?\d*)\s*mg/i);
    if (sodMg) sel = Math.round(sodMg / 1000 * 2.54 * 100) / 100;
    else {
      const sodG = pick(/\bsodium\b[^\n]*?(\d+\.?\d*)\s*g/i);
      if (sodG) sel = Math.round(sodG * 2.54 * 100) / 100;
    }
  }

  // --- Nom du produit : 1ère ligne significative non-nutritionnelle ---
  const NUTRIENT_RE = /(?:énergie|kcal|kj|lipide|glucide|protéine|matière|acide.gras|fibres?|sodium|\bsel\b|fat\b|protein|carbo|sugar|fibre)/i;
  const name = rawText.split('\n')
    .map(l => l.trim())
    .find(l => l.length > 2 && l.length < 60
            && !/^\d[\d\s.,\/]*$/.test(l)
            && !NUTRIENT_RE.test(l)) || '';

  return { kcal_per100, lipides, graisses_saturees, glucides, sucres, proteines, fibres, sel, name };
}

// ─── Analyse d'ingrédients — 100% local, sans IA ─────────────────────────────

function extractFromIngredientsText(text) {
  if (!text?.trim()) return { success: false, error: 'Texte manquant.' };

  // Additifs E-number
  const BAD_E  = new Set(['E102','E110','E122','E124','E129','E211','E220','E621','E631','E951','E104','E127','E128']);
  const WARN_E = new Set(['E471','E472','E322','E330','E300','E250','E251','E252','E407','E412','E415']);
  const eNums  = [...new Set((text.match(/\bE\d{3,4}[a-z]?\b/gi) || []).map(e => e.toUpperCase()))];
  const additifs = eNums.map(name => ({
    name,
    type: BAD_E.has(name) ? 'bad' : WARN_E.has(name) ? 'warn' : 'ok'
  }));

  // Liste d'ingrédients
  const ingredients_parsed = text.split(/[,;]/)
    .map(i => i.trim().replace(/\s+/g, ' '))
    .filter(i => i.length > 1)
    .slice(0, 25);

  // Allergènes réglementés (14 majeurs EU)
  const ALLERGEN_MAP = {
    gluten:    /gluten|blé|orge|seigle|avoine|froment|épeautre/i,
    lait:      /lait|lactose|beurre|fromage|crème|caséine|lactos/i,
    oeufs:     /œufs?|oeuf/i,
    arachides: /arachide|cacahuète|peanut/i,
    soja:      /\bsoja\b|\bsoya\b/i,
    noix:      /\bnoix\b|noisette|amande|pistache|cajou|pécan|macadamia/i,
    poisson:   /poisson|saumon|thon|sardine|morue/i,
    crustacés: /crustacé|crevette|homard|crabe/i,
    moutarde:  /moutarde/i,
    sésame:    /sésame/i,
    sulfites:  /sulfite|anhydride\s*sulfureux/i,
  };
  const allergenes = Object.entries(ALLERGEN_MAP)
    .filter(([, re]) => re.test(text))
    .map(([name]) => name);

  const is_bio = /\bbio\b|organic|biologique/i.test(text);
  const hasBad = additifs.some(a => a.type === 'bad');
  const hasWarn = additifs.some(a => a.type === 'warn');
  const qualite_estimation = hasBad ? 'D' : hasWarn ? 'C' : additifs.length === 0 ? 'A' : 'B';

  return {
    success: true,
    data: {
      ingredients_parsed, additifs, allergenes, is_bio, qualite_estimation,
      commentaire: `${ingredients_parsed.length} ingrédient(s), ${additifs.length} additif(s) identifié(s).`
    }
  };
}

// ─── Enrichissement du résultat OCR ──────────────────────────────────────────

function enrichOCRResult(data) {
  const { computeScore } = require('./openfoodfacts');
  const score = computeScore({
    kcal:        data.kcal_per100        || 0,
    sucres:      data.sucres             || 0,
    graissesSat: data.graisses_saturees  || 0,
    sel:         data.sel                || 0,
    fibres:      data.fibres             || 0,
    proteines:   data.proteines          || 0
  });
  const COMMENTS = {
    A: 'Excellent profil nutritionnel.',
    B: 'Bon choix, à consommer régulièrement.',
    C: 'Qualité correcte — consommer avec modération.',
    D: 'À limiter dans votre alimentation quotidienne.',
    E: 'À éviter — profil nutritionnel défavorable.'
  };
  return {
    ...data,
    score,
    emoji:    guessEmojiFromName(data.name || ''),
    comment:  COMMENTS[score],
    category: 'divers',
    source:   'ocr_tesseract'
  };
}

function guessEmojiFromName(name) {
  const l = name.toLowerCase();
  if (l.includes('lait') || l.includes('milk'))              return '🥛';
  if (l.includes('yaourt') || l.includes('yog'))             return '🥛';
  if (l.includes('fromage') || l.includes('cheese'))         return '🧀';
  if (l.includes('pain') || l.includes('bread'))             return '🍞';
  if (l.includes('couscous') || l.includes('semoule'))       return '🥣';
  if (l.includes('huile') || l.includes('oil'))              return '🫙';
  if (l.includes('jus') || l.includes('juice'))              return '🧃';
  if (l.includes('biscuit') || l.includes('gateau') || l.includes('gâteau')) return '🍪';
  if (l.includes('chips') || l.includes('snack'))            return '🍿';
  if (l.includes('poisson') || l.includes('sardine') || l.includes('thon'))  return '🐟';
  if (l.includes('viande') || l.includes('poulet') || l.includes('kefta'))   return '🥩';
  if (l.includes('oeuf') || l.includes('egg'))               return '🥚';
  if (l.includes('miel') || l.includes('honey'))             return '🍯';
  if (l.includes('sucre') || l.includes('confiture'))        return '🍯';
  if (l.includes('café') || l.includes('coffee'))            return '☕';
  if (l.includes('thé') || l.includes('tea'))                return '🍵';
  if (l.includes('chocolat'))                                return '🍫';
  if (l.includes('eau') || l.includes('water'))              return '💧';
  return '🍽️';
}

module.exports = { extractNutritionFromImage, extractFromIngredientsText };
