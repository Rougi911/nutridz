'use strict';
// GET  /api/scanned         — liste des produits scannés de l'utilisateur
// DELETE /api/scanned/:id   — supprimer un scan
// DELETE /api/scanned       — vider tout l'historique de scans
const express = require('express');
const { getDB } = require('../db');
const auth = require('../middleware/auth');
const { classifyAdditive } = require('../services/additiveClassify');
const { resolveAdditiveName } = require('../services/additiveResolver');

// S10b : regex élargie à 0-3 lettres pour couvrir E500ii, E500iii, etc.
function normalizeCode(tag) {
  const m = String(tag).match(/[eE](\d{3,4}[a-z]{0,3})$/i);
  return m ? `E${m[1].toLowerCase()}` : null;
}

function mapAdditives(jsonStr) {
  let tags;
  try { tags = JSON.parse(jsonStr || '[]'); } catch { return []; }
  if (!Array.isArray(tags)) return [];
  return tags.map(tag => {
    const displayCode = tag.replace(/^[a-z]{2}:/, '').toUpperCase();
    const code    = normalizeCode(tag);
    const classif = code ? classifyAdditive(code) : null; // DEF-7 : repli sur le code parent
    const risk    = classif ? classif.risk : 'unknown'; // S10b : toujours 'unknown'
    const name    = code ? resolveAdditiveName(code) : displayCode;
    return { code: displayCode, name, risk };
  });
}

const router = express.Router();

// GET /api/scanned?limit=N&offset=M
router.get('/', auth, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '50',  10), 200);
  const offset = Math.max(parseInt(req.query.offset || '0',   10), 0);

  const db = getDB();
  const rows = await db.prepare(`
    SELECT id, barcode, product_name, score, verdict, nutri_score, nova,
           sugars_g, salt_g, sat_fat_g, times_this_month, scanned_at,
           additives_json, image_url
    FROM scanned_products
    WHERE user_id = ?
    ORDER BY scanned_at DESC
    LIMIT ? OFFSET ?
  `).all(req.userId, limit, offset);

  const total = (await db.prepare(
    `SELECT COUNT(*) AS n FROM scanned_products WHERE user_id = ?`
  ).get(req.userId)).n;

  const products = rows.map(r => ({
    id:               r.id,
    barcode:          r.barcode,
    name:             r.product_name,
    score:            r.score,
    verdict:          r.verdict,
    nutri_score:      r.nutri_score,
    nova:             r.nova,
    sugars_g:         r.sugars_g,
    salt_g:           r.salt_g,
    sat_fat_g:        r.sat_fat_g,
    times_this_month: r.times_this_month,
    scanned_at:       r.scanned_at,
    additives:        mapAdditives(r.additives_json),
    image_url:        r.image_url || null,
  }));

  res.json({ total, limit, offset, products });
});

// DELETE /api/scanned/:id — supprimer un scan précis
router.delete('/:id', auth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id invalide' });

  const db = getDB();
  const row = await db.prepare(
    `SELECT id FROM scanned_products WHERE id = ? AND user_id = ?`
  ).get(id, req.userId);

  if (!row) return res.status(404).json({ error: 'Scan introuvable' });

  await db.prepare(`DELETE FROM scanned_products WHERE id = ?`).run(id);
  res.json({ deleted: id });
});

// DELETE /api/scanned — vider tout l'historique (RGPD / ménage)
router.delete('/', auth, async (req, res) => {
  const db = getDB();
  const result = await db.prepare(
    `DELETE FROM scanned_products WHERE user_id = ?`
  ).run(req.userId);
  res.json({ deleted_count: result.changes });
});

module.exports = router;
