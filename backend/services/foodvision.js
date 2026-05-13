const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Analyse une photo de plat et estime sa composition nutritionnelle
 * Spécialisé sur la cuisine algérienne
 */
async function analyzeDishPhoto(base64Image, mediaType = 'image/jpeg', context = {}) {
  const { weight = 70, goal = 'maintien', mealType = null } = context;

  const prompt = `Tu es un expert en nutrition spécialisé dans la cuisine algérienne et méditerranéenne. Analyse cette photo de plat/repas.

Ta mission :
1. Identifier tous les aliments visibles
2. Estimer visuellement les quantités en grammes (utilise la taille des assiettes, couverts, mains comme référence)
3. Calculer les valeurs nutritionnelles totales
4. Donner une fourchette basse/haute pour tenir compte de l'incertitude visuelle

Réponds UNIQUEMENT avec du JSON valide (sans markdown) :
{
  "plat_identifie": "nom du plat principal",
  "cuisine": "algérienne|méditerranéenne|internationale|inconnue",
  "confiance": "haute|moyenne|faible",
  "aliments": [
    {
      "nom": "couscous",
      "nom_ar": "كسكسي",
      "quantite_g": 200,
      "fourchette": {"min": 150, "max": 250},
      "kcal": 712,
      "glucides": 144,
      "proteines": 24,
      "lipides": 4,
      "fibres": 10,
      "emoji": "🥣",
      "est_principal": true
    }
  ],
  "totaux": {
    "kcal": 0,
    "kcal_min": 0,
    "kcal_max": 0,
    "glucides": 0,
    "proteines": 0,
    "lipides": 0,
    "fibres": 0,
    "sel_estime": 0
  },
  "score_nutritionnel": "A|B|C|D",
  "conseil": "commentaire nutritionnel personnalisé en français",
  "tags": ["riche en fibres", "plat complet", "protéiné"],
  "plats_similaires": ["couscous au poulet", "couscous aux légumes"],
  "erreur": null
}

Plats algériens courants à reconnaître : couscous, chakhchoukha, rechta, chorba, harira, tajine, dolma, merguez, kefta, méchoui, bourek, brik, kalb el louz, makroud, chebakia, lham lahlou, garantita, fricassée, berkoukes, tcharek...

Si ce n'est pas un plat/aliment, retourne {"erreur": "pas un plat alimentaire"}.
Si l'image est trop floue, retourne {"erreur": "image insuffisante", "conseil": "Prenez la photo de plus près avec une bonne lumière"}.`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
          { type: 'text', text: prompt }
        ]
      }]
    });

    const text = response.content[0].text.trim()
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(text);

    if (parsed.erreur) return { success: false, error: parsed.erreur, conseil: parsed.conseil };

    // Enrichir avec des calculs supplémentaires
    return { success: true, data: enrichAnalysis(parsed, weight) };

  } catch (err) {
    console.error('[FoodVision] Erreur:', err.message);
    if (err instanceof SyntaxError) {
      return { success: false, error: 'Analyse impossible. Essayez une photo plus nette et bien éclairée.' };
    }
    return { success: false, error: 'Erreur lors de l\'analyse du plat.' };
  }
}

/**
 * Mode multi-photos : analyse plusieurs angles du même plat
 * pour une meilleure précision
 */
async function analyzeMultiplePhotos(images, context = {}) {
  const prompt = `Tu es un expert en nutrition. On t'envoie ${images.length} photos du même repas prises sous différents angles.
Combine les informations de toutes les photos pour une estimation plus précise.

Réponds avec le même format JSON que pour une photo unique, mais utilise toutes les vues pour affiner les quantités.
Indique confiance="haute" seulement si les photos sont complémentaires et claires.`;

  try {
    const imageContent = images.map(({ base64, mediaType }) => ({
      type: 'image',
      source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: base64 }
    }));

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [...imageContent, { type: 'text', text: prompt }]
      }]
    });

    const text = response.content[0].text.trim()
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(text);
    if (parsed.erreur) return { success: false, error: parsed.erreur };

    return { success: true, data: enrichAnalysis(parsed, context.weight || 70) };
  } catch (err) {
    return { success: false, error: 'Analyse multi-photos impossible.' };
  }
}

/**
 * Affine une analyse existante avec un commentaire vocal/texte de l'utilisateur
 * Ex: "Il y avait aussi du pain" ou "La portion était plus petite"
 */
async function refineAnalysis(previousAnalysis, userCorrection) {
  const prompt = `Un utilisateur a analysé un plat avec les résultats suivants :
${JSON.stringify(previousAnalysis, null, 2)}

L'utilisateur apporte la correction suivante : "${userCorrection}"

Mets à jour l'analyse en tenant compte de cette correction. Retourne le même format JSON avec les valeurs corrigées.
Explique les changements dans le champ "conseil".`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.trim()
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    return { success: true, data: JSON.parse(text) };
  } catch {
    return { success: false, error: 'Impossible d\'affiner l\'analyse.' };
  }
}

/**
 * Enrichit l'analyse avec des métriques supplémentaires
 */
function enrichAnalysis(data, weightKg = 70) {
  const totaux = data.totaux || {};

  // Temps d'effort physique pour brûler ce repas
  const effortPhysique = {
    marche: calcEffort(totaux.kcal, 3.5, weightKg),
    velo: calcEffort(totaux.kcal, 6.0, weightKg),
    course: calcEffort(totaux.kcal, 9.0, weightKg),
    natation: calcEffort(totaux.kcal, 7.0, weightKg)
  };

  // Indice de satiété estimé (protéines + fibres = satiété)
  const satietePts = (totaux.proteines || 0) * 0.4 + (totaux.fibres || 0) * 0.6;
  const satiete = satietePts > 20 ? 'Très rassasiant' : satietePts > 12 ? 'Rassasiant' : satietePts > 6 ? 'Modérément rassasiant' : 'Peu rassasiant';

  // Répartition des macros en %
  const totalKcalMacros = (totaux.glucides || 0) * 4 + (totaux.proteines || 0) * 4 + (totaux.lipides || 0) * 9;
  const macrosPct = totalKcalMacros > 0 ? {
    glucides: Math.round((totaux.glucides * 4 / totalKcalMacros) * 100),
    proteines: Math.round((totaux.proteines * 4 / totalKcalMacros) * 100),
    lipides: Math.round((totaux.lipides * 9 / totalKcalMacros) * 100)
  } : { glucides: 0, proteines: 0, lipides: 0 };

  return {
    ...data,
    effort_physique: effortPhysique,
    satiete,
    macros_pct: macrosPct,
    incertitude_pct: data.confiance === 'haute' ? 10 : data.confiance === 'moyenne' ? 20 : 35
  };
}

function calcEffort(kcal, met, weightKg) {
  if (!kcal || !weightKg) return 0;
  return Math.round(kcal / (met * weightKg * 3.5 / 200));
}

module.exports = { analyzeDishPhoto, analyzeMultiplePhotos, refineAnalysis };
