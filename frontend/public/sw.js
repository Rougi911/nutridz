const CACHE_NAME = 'nutridz-v1';
const STATIC_ASSETS = [
  '/',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/manifest.json',
  '/icons/icon-192.png'
];

// Installation : mise en cache des assets statiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activation : supprimer les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : cache-first pour les assets, network-first pour l'API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // L'API ne passe jamais par le cache
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Mettre en cache les nouvelles ressources statiques
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Hors ligne : renvoyer la page principale
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
