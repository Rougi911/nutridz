const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Analyse une image d'étiquette nutritionnelle avec Claude Vision
 * Retourne un objet normalisé prêt pour la DB
 */
async function extractNutritionFromImage(base64Image, mediaType = 'image/jpeg') {
  const prompt = `Tu es un expert en nutrition. Analyse cette image d'étiquette alimentaire et extrais TOUTES les informations nutritionnelles présentes.

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans backticks), avec cette structure exacte :
{
  "name": "nom du produit",
  "brand": "marque (vide si absente)",
  "kcal_per100": 0,
  "glucides": 0,
  "sucres": 0,
  "proteines": 0,
  "lipides": 0,
  "graisses_saturees": 0,
  "fibres": 0,
  "sel": 0,
  "sodium": 0,
  "ingredients": ["liste", "des", "ingrédients"],
  "additifs": [{"name": "E471", "type": "warn"}],
  "portion_size": 100,
  "portions_per_pack": null,
  "allergens": ["gluten", "lait"],
  "is_bio": false,
  "conservation": "",
  "confiance": "haute|moyenne|faible"
}

Règles :
- Si une valeur est absente de l'étiquette, mets 0 ou null
- Les valeurs nutritionnelles doivent être POUR 100g (convertis si nécessaire)
- Si l'étiquette est en arabe ou français, extrais quand même les chiffres
- Pour les additifs : type "bad" si controversé (E621, E951...), "warn" si modéré (E471...), "ok" si inoffensif
- confiance = "haute" si tu vois clairement les valeurs, "faible" si l'image est floue
- Si ce n'est pas une étiquette alimentaire, retourne {"erreur": "pas une étiquette alimentaire"}`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Image }
          },
          { type: 'text', text: prompt }
        ]
      }]
    });

    const text = response.content[0].text.trim();

    // Nettoyer si Claude a quand même ajouté des backticks
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(clean);

    if (parsed.erreur) {
      return { success: false, error: parsed.erreur };
    }

    return { success: true, data: enrichOCRResult(parsed) };

  } catch (err) {
    console.error('[Claude OCR] Erreur:', err.message);
    if (err instanceof SyntaxError) {
      return { success: false, error: 'Impossible de lire les données nutritionnelles. Essayez une image plus nette.' };
    }
    return { success: false, error: 'Erreur lors de l\'analyse de l\'image.' };
  }
}

/**
 * Analyse le texte libre des ingrédients (OCR texte brut)
 */
async function extractFromIngredientsText(text) {
  const prompt = `Analyse cette liste d'ingrédients d'un produit alimentaire algérien et extrais les informations suivantes.

Liste d'ingrédients : "${text}"

Réponds UNIQUEMENT avec du JSON valide :
{
  "ingredients_parsed": ["ingrédient 1", "ingrédient 2"],
  "additifs": [{"name": "E471", "type": "warn", "role": "émulsifiant"}],
  "allergenes": ["gluten", "lait"],
  "is_bio": false,
  "qualite_estimation": "A|B|C|D",
  "commentaire": "brève analyse qualitative"
}

Types d'additifs : "bad" = à éviter (E102, E110, E621, E951...), "warn" = modéré (E471, E330...), "ok" = inoffensif`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    });

    const clean = response.content[0].text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return { success: true, data: JSON.parse(clean) };
  } catch (err) {
    return { success: false, error: 'Analyse des ingrédients impossible.' };
  }
}

/**
 * Enrichit le résultat OCR avec le score et le commentaire
 */
function enrichOCRResult(data) {
  const { computeScore } = require('./openfoodfacts');

  const score = computeScore({
    kcal: data.kcal_per100 || 0,
    sucres: data.sucres || 0,
    graissesSat: data.graisses_saturees || 0,
    sel: data.sel || 0,
    fibres: data.fibres || 0,
    proteines: data.proteines || 0
  });

  const scoreComments = {
    A: 'Excellent profil nutritionnel.',
    B: 'Bon choix, à consommer régulièrement.',
    C: 'Qualité correcte — consommer avec modération.',
    D: 'À limiter dans votre alimentation quotidienne.',
    E: 'À éviter — profil nutritionnel défavorable.'
  };

  // Emoji selon le nom
  const emoji = guessEmojiFromName(data.name || '');

  return {
    ...data,
    score,
    emoji,
    comment: scoreComments[score],
    category: 'divers',
    source: 'ocr_claude'
  };
}

function guessEmojiFromName(name) {
  const lower = name.toLowerCase();
  if (lower.includes('lait') || lower.includes('milk')) return '🥛';
  if (lower.includes('yaourt') || lower.includes('yog')) return '🥛';
  if (lower.includes('fromage') || lower.includes('cheese')) return '🧀';
  if (lower.includes('pain') || lower.includes('bread')) return '🍞';
  if (lower.includes('couscous') || lower.includes('semoule')) return '🥣';
  if (lower.includes('huile') || lower.includes('oil')) return '🫙';
  if (lower.includes('jus') || lower.includes('juice')) return '🧃';
  if (lower.includes('biscuit') || lower.includes('gateau') || lower.includes('gâteau')) return '🍪';
  if (lower.includes('chips') || lower.includes('snack')) return '🍿';
  if (lower.includes('poisson') || lower.includes('sardine') || lower.includes('thon')) return '🐟';
  if (lower.includes('viande') || lower.includes('poulet') || lower.includes('kefta')) return '🥩';
  if (lower.includes('oeuf') || lower.includes('egg')) return '🥚';
  if (lower.includes('miel') || lower.includes('honey')) return '🍯';
  if (lower.includes('sucre') || lower.includes('confiture')) return '🍯';
  if (lower.includes('café') || lower.includes('coffee')) return '☕';
  if (lower.includes('thé') || lower.includes('tea')) return '🍵';
  if (lower.includes('chocolat')) return '🍫';
  if (lower.includes('eau') || lower.includes('water')) return '💧';
  return '🍽️';
}

module.exports = { extractNutritionFromImage, extractFromIngredientsText };
