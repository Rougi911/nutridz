const QUANTITY_PATTERNS = {
  fr: {
    numbers: /(\d+(?:[.,]\d+)?)\s*(grammes?|g|kg|kilogrammes?|ml|millilitres?|litres?|l|cuillères?|cuillère|c\.|c|pièces?|morceaux?|tranches?)/i,
    words: /(un|une|deux|trois|quatre|cinq|demi|moitié|quart)/i,
  },
  en: {
    numbers: /(\d+(?:[.,]\d+)?)\s*(grams?|g|kg|kilograms?|ml|milliliters?|liters?|l|spoons?|tablespoons?|tbsp|tsp|pieces?|slices?)/i,
    words: /(one|two|three|four|five|half|quarter)/i,
  },
  ar: {
    numbers: /(\d+(?:[.,]\d+)?)\s*(غرام|كيلو|مل|لتر|ملعقة|قطعة)/i,
    words: /(واحد|اثنين|ثلاثة|نصف|ربع)/i,
  },
};

function wordToNumber(word, lang = 'fr') {
  const maps = {
    fr: { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, demi: 0.5, 'moitié': 0.5, quart: 0.25 },
    en: { one: 1, two: 2, three: 3, four: 4, five: 5, half: 0.5, quarter: 0.25 },
    ar: {
      'واحد': 1,
      'اثنين': 2,
      'ثلاثة': 3,
      'نصف': 0.5,
      'ربع': 0.25,
    },
  };
  return maps[lang]?.[word.toLowerCase()] ?? null;
}

function normalizeUnit(unit, amount) {
  const u = unit.toLowerCase().trim();

  if (['kg', 'kilogramme', 'kilogrammes', 'kilogram', 'kilograms', 'كيلو'].includes(u))
    return amount * 1000;

  if (['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'].includes(u))
    return amount;

  if (['l', 'litre', 'litres', 'liter', 'liters', 'لتر'].includes(u))
    return amount * 1000;

  if (['cuillère', 'cuillères', 'cuillere', 'cuilleres', 'spoon', 'spoons', 'tablespoon', 'tablespoons', 'tbsp', 'ملعقة'].includes(u))
    return amount * 15;

  if (['tsp', 'teaspoon', 'teaspoons'].includes(u))
    return amount * 5;

  if (['pièce', 'pièces', 'piece', 'pieces', 'morceau', 'morceaux', 'tranche', 'tranches', 'slice', 'slices', 'قطعة'].includes(u))
    return amount * 100;

  // g or unknown → as-is
  return amount;
}

function parseFoodInput(text, lang = 'fr') {
  if (!text || !text.trim()) return { items: [], raw: text };

  const items = [];
  const patterns = QUANTITY_PATTERNS[lang] || QUANTITY_PATTERNS.fr;

  const separator = lang === 'ar'
    ? /[,;]|و/
    : lang === 'en' ? /[,;]|\sand\s/i : /[,;]|\set\s/i;

  const segments = text.split(separator).map(s => s.trim()).filter(Boolean);

  for (const segment of segments) {
    // exec() gives capture groups (unlike match() with /g which drops them)
    const match = patterns.numbers.exec(segment);

    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'));
      const unit   = match[2];
      const amountInGrams = normalizeUnit(unit, amount);
      const foodName = segment.replace(match[0], '').trim();

      items.push({
        name: foodName || segment,
        amount_g: Math.round(amountInGrams),
        raw: segment,
      });
    } else {
      const wordMatch = patterns.words.exec(segment);
      if (wordMatch) {
        const amount = wordToNumber(wordMatch[1] || wordMatch[0], lang);
        if (amount !== null) {
          const foodName = segment.replace(wordMatch[0], '').trim();
          items.push({
            name: foodName || segment,
            amount_g: Math.round(amount * 100),
            raw: segment,
          });
        } else {
          items.push({ name: segment, amount_g: 100, raw: segment, estimated: true });
        }
      } else {
        items.push({ name: segment, amount_g: 100, raw: segment, estimated: true });
      }
    }
  }

  return { items, raw: text };
}

function parseWeightInput(text, lang = 'fr') {
  const patterns = {
    fr: /(\d+(?:[.,]\d+)?)\s*(?:kilos?|kg|kilogrammes?)(?:\s+(\d+))?/i,
    en: /(\d+(?:[.,]\d+)?)\s*(?:kg|kilograms?|pounds?|lbs?)/i,
    ar: /(\d+(?:[.,]\d+)?)\s*(?:كيلو|كغ)/i,
  };

  const match = (patterns[lang] || patterns.fr).exec(text);
  if (!match) return null;

  let weight = parseFloat(match[1].replace(',', '.'));

  // Handle spoken French decimals: "75 kilos 3" → 75.3
  if (lang === 'fr' && match[2] !== undefined) {
    weight = parseFloat(`${Math.trunc(weight)}.${match[2]}`);
  }

  if (lang === 'en' && /pounds?|lbs?/i.test(match[0])) {
    weight = weight * 0.453592;
  }

  return Math.round(weight * 10) / 10;
}

function parseGlucoseInput(text, lang = 'fr') {
  const patterns = {
    fr: /(\d+)\s*(?:mg|milligrammes?)?/i,
    en: /(\d+)\s*(?:mg|milligrams?)?/i,
    ar: /(\d+)\s*(?:مغ)?/i,
  };

  const match = (patterns[lang] || patterns.fr).exec(text);
  if (!match) return null;

  const glucose = parseInt(match[1]);
  if (glucose < 20 || glucose > 600) return null;

  let readingType = 'random';
  const lower = text.toLowerCase();

  if (lang === 'fr') {
    if (lower.includes('jeun'))                              readingType = 'fasting';
    else if (lower.includes('avant'))                        readingType = 'pre_meal';
    else if (lower.includes('après') || lower.includes('apres')) readingType = 'post_meal';
    else if (lower.includes('coucher'))                      readingType = 'bedtime';
  } else if (lang === 'en') {
    if (lower.includes('fasting'))                           readingType = 'fasting';
    else if (lower.includes('before') || lower.includes('pre'))  readingType = 'pre_meal';
    else if (lower.includes('after')  || lower.includes('post')) readingType = 'post_meal';
    else if (lower.includes('bedtime'))                      readingType = 'bedtime';
  }

  return { glucose_mg_dl: glucose, reading_type: readingType };
}

module.exports = { parseFoodInput, parseWeightInput, parseGlucoseInput };
