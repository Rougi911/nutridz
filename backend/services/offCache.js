'use strict';
/**
 * P1-8 — Cache mémoire des produits OpenFoodFacts, clé = code-barres.
 *
 * - Hit frais (< TTL) → pas d'appel réseau OFF (latence ÷ et quota économisé).
 * - Sert aussi de repli : si OFF est indisponible, on renvoie l'entrée même périmée.
 *
 * Cache process-local (suffisant : le coût visé est l'appel réseau redondant ;
 * la persistance inter-redémarrage est couverte par le keep-warm + le tier Render).
 */

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
const MAX_ENTRIES = 1000;               // borne mémoire simple (FIFO)

const cache = new Map(); // barcode → { product, ts }

function getFresh(barcode) {
  const e = cache.get(String(barcode));
  if (!e) return null;
  if (Date.now() - e.ts > TTL_MS) return null;
  return e.product;
}

// Entrée éventuellement périmée — repli quand OFF est indisponible.
function getStale(barcode) {
  const e = cache.get(String(barcode));
  return e ? e.product : null;
}

function set(barcode, product) {
  const key = String(barcode);
  if (!cache.has(key) && cache.size >= MAX_ENTRIES) {
    cache.delete(cache.keys().next().value); // évince la plus ancienne
  }
  cache.set(key, { product, ts: Date.now() });
}

function clear() { cache.clear(); }

module.exports = { getFresh, getStale, set, clear, TTL_MS };
