'use strict';
/**
 * P1-8 / S7e — Cache des produits OpenFoodFacts, clé = code-barres.
 *
 * Deux niveaux :
 *  - mémoire (rapide, process-local) ;
 *  - base Postgres `off_cache(barcode, payload, fetched_at)` → persistant à travers
 *    les spin-down/redéploiements Render (le cache mémoire seul était perdu, donc
 *    inefficace en free tier).
 *
 * Le cache est best-effort : toute erreur DB est avalée (on retombe sur le réseau OFF).
 * Les fonctions sont asynchrones (la lecture/écriture DB l'impose).
 */

const { getDB } = require('../db');

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
const MAX_ENTRIES = 1000;               // borne mémoire simple (FIFO)

const cache = new Map(); // barcode → { product, ts }

function setMemory(barcode, product) {
  const key = String(barcode);
  if (!cache.has(key) && cache.size >= MAX_ENTRIES) {
    cache.delete(cache.keys().next().value); // évince la plus ancienne
  }
  cache.set(key, { product, ts: Date.now() });
}

// Hit frais (< TTL). Mémoire d'abord, puis base (qu'on recharge en mémoire).
async function getFresh(barcode) {
  const key = String(barcode);
  const mem = cache.get(key);
  if (mem && Date.now() - mem.ts <= TTL_MS) return mem.product;

  try {
    const row = await getDB().prepare(
      'SELECT payload, fetched_at FROM off_cache WHERE barcode = ?'
    ).get(key);
    if (row && (Date.now() - new Date(row.fetched_at).getTime() <= TTL_MS)) {
      setMemory(key, row.payload); // payload JSONB déjà parsé par pg
      return row.payload;
    }
  } catch (_) { /* cache best-effort : on ignore l'erreur DB */ }
  return null;
}

// Entrée éventuellement périmée — repli quand OFF est indisponible.
async function getStale(barcode) {
  const key = String(barcode);
  const mem = cache.get(key);
  if (mem) return mem.product;

  try {
    const row = await getDB().prepare('SELECT payload FROM off_cache WHERE barcode = ?').get(key);
    if (row) return row.payload;
  } catch (_) { /* ignore */ }
  return null;
}

// Écrit en mémoire (synchrone) + persiste en base (fire-and-forget).
function set(barcode, product) {
  const key = String(barcode);
  setMemory(key, product);
  getDB().prepare(`
    INSERT INTO off_cache (barcode, payload, fetched_at)
    VALUES (?, ?, now())
    ON CONFLICT (barcode) DO UPDATE SET payload = excluded.payload, fetched_at = now()
  `).run(key, JSON.stringify(product)).catch(() => { /* persistance best-effort */ });
}

function clear() { cache.clear(); }

module.exports = { getFresh, getStale, set, clear, TTL_MS };
