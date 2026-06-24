const CACHE_NAME = 'aiproces-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/aiproces-logo.svg',
  '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force the new service worker to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all clients immediately
  );
});

self.addEventListener('fetch', event => {
  // Ignore API requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Explicitly ignore any backend API calls (Vercel proxies /api/)
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Use Network First strategy for HTML (navigation) to ensure latest index.html
  if (event.request.mode === 'navigate' || event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Stale-while-revalidate for other assets
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      })
  );
});
