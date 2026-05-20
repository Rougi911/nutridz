const express = require('express');
const { CATEGORIES, findById, localizeModifier } = require('../data/dishModifiers');
const defaults = require('../data/cuisineDefaults.json');

const router = express.Router();

const SUPPORTED_LANGS = ['fr', 'ar', 'en'];

function getLang(req) {
  const q = req.query.lang;
  if (q && SUPPORTED_LANGS.includes(q)) return q;
  const al = (req.headers['accept-language'] || '').slice(0, 2).toLowerCase();
  return SUPPORTED_LANGS.includes(al) ? al : 'fr';
}

// GET /api/modifiers — catalogue complet localisé
router.get('/', (req, res) => {
  const lang = getLang(req);
  const result = {};
  for (const [cat, items] of Object.entries(CATEGORIES)) {
    result[cat] = items.map(mod => localizeModifier(mod, lang));
  }
  res.json(result);
});

// GET /api/modifiers/defaults/:cuisine — modifiers par défaut pour une cuisine
router.get('/defaults/:cuisine', (req, res) => {
  const lang = getLang(req);
  const cuisine = req.params.cuisine;
  const list = defaults[cuisine] || [];
  const result = list.map(({ id, amount_g }) => {
    const mod = findById(id);
    if (!mod) return null;
    return { ...localizeModifier(mod, lang), amount_g };
  }).filter(Boolean);
  res.json(result);
});

module.exports = router;
