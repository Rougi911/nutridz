/* Service Worker NutriVita.
 * Stratégie :
 *  - Navigations / index.html : NETWORK-FIRST (jamais de HTML périmé après déploiement).
 *  - Assets hashés /static/ (immutables CRA) : CACHE-FIRST.
 *  - API : jamais mise en cache.
 *  - Fallback hors-ligne : dernière index.html connue.
 * Les handlers push vivent dans sw-push.js, importé ici pour être réellement chargés.
 */
importScripts('/sw-push.js');

// Incrémenté à chaque déploiement pour purger l'ancien cache (fix bundle périmé).
const CACHE_NAME = 'nutridz-v2';
const OFFLINE_URL = '/index.html';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // cross-origin (CDN, API externe) : laisser passer
  if (url.pathname.startsWith('/api/')) return;     // l'API ne passe jamais par le cache

  // Navigations (HTML) : network-first → toujours le dernier index.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_URL, clone));
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL).then((c) => c || caches.match('/')))
    );
    return;
  }

  // Assets hashés immutables : cache-first.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
