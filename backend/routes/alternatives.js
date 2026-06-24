'use strict';
/**
 * S12 — « Alternatives plus saines ».
 * GET /api/alternatives/:barcode (auth) : propose des produits mieux notés (Nutri-Score)
 * de la même catégorie OFF que le produit scanné. Tout en live OFF, aucun stockage.
 * Robuste : OFF KO ou pas de catégorie → 200 avec alternatives:[] (jamais 500).
 * Vocabulaire non clinique (« mieux noté »).
 */
const express = require('express');
const axios = require('axios');
const auth = require('../middleware/auth');

const router = express.Router();
const OFF_PRODUCT = 'https://world.openfoodfacts.org/api/v0/product';
const OFF_SEARCH  = 'https://world.openfoodfacts.org/api/v2/search';

const GRADE_RANK = { a: 1, b: 2, c: 3, d: 4, e: 5 };
const rank = (g) => GRADE_RANK[String(g || '').toLowerCase()] || 6; // inconnu = pire

router.get('/:barcode', auth, async (req, res) => {
  const { barcode } = req.params;
  if (!/^\d{4,14}$/.test(String(barcode))) {
    return res.status(400).json({ error: 'Code-barres invalide (4–14 chiffres requis)' });
  }
  const empty = (category = null) => ({ source_barcode: String(barcode), category, alternatives: [] });

  // 1. Produit d'origine → catégorie principale (la plus spécifique) + son grade
  let product;
  try {
    const { data } = await axios.get(`${OFF_PRODUCT}/${barcode}.json?fields=categories_tags,nutriscore_grade`, { timeout: 10000 });
    if (!data.status || !data.product) return res.json(empty());
    product = data.product;
  } catch (err) {
    console.error('[alternatives] OFF product error:', err.code || err.response?.status);
    return res.json(empty());
  }

  const cats = product.categories_tags || [];
  const category = cats.length ? cats[cats.length - 1] : null;
  if (!category) return res.json(empty());
  const originRank = rank(product.nutriscore_grade);

  // 2. Recherche OFF v2 sur la catégorie, triée par meilleur Nutri-Score
  let products;
  try {
    const { data } = await axios.get(OFF_SEARCH, {
      params: {
        categories_tags: category,
        fields: 'code,product_name,nutriscore_grade,image_front_small_url,nutriscore_score',
        sort_by: 'nutriscore_score',
        page_size: 12,
      },
      timeout: 10000,
    });
    products = (data && data.products) || [];
  } catch (err) {
    console.error('[alternatives] OFF search error:', err.code || err.response?.status);
    return res.json(empty(category));
  }

  // 3. Filtrer : origine exclue, grade strictement meilleur, nom + image présents ; top 5 triés
  const alternatives = products
    .filter(p => String(p.code) !== String(barcode))
    .filter(p => p.product_name && p.image_front_small_url)
    .filter(p => GRADE_RANK[String(p.nutriscore_grade || '').toLowerCase()] && rank(p.nutriscore_grade) < originRank)
    .map(p => ({ barcode: String(p.code), name: p.product_name, nutriScore: p.nutriscore_grade, imageUrl: p.image_front_small_url }))
    .sort((a, b) => rank(a.nutriScore) - rank(b.nutriScore))
    .slice(0, 5);

  res.json({ source_barcode: String(barcode), category, alternatives });
});

module.exports = router;
