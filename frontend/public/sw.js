const CACHE_NAME = 'aiproces-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/aiproces-logo.svg',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve el recurso en caché si existe, sino haz fetch
        return response || fetch(event.request);
      })
  );
});
