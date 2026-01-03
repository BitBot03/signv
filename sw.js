const CACHE_NAME = 'sign-glove-cache-v3';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/hooks/useSerial.ts',
  '/services/speechService.ts',
  '/components/icons.tsx',
  '/icon.svg',
  '/manifest.json'
];

const CDN_URLS = [
  'https://cdn.tailwindcss.com',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/'
];

// Install: Caches the app shell and external resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching app shell and CDN assets');
        const appShellPromise = cache.addAll(APP_SHELL_URLS);
        const cdnPromise = cache.addAll(CDN_URLS);
        return Promise.all([appShellPromise, cdnPromise]);
      })
      .catch(err => console.error("Cache addAll failed: ", err))
  );
});

// Activate: Cleans up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch: Serves from cache, falls back to network, and updates cache.
self.addEventListener('fetch', (event) => {
  // Ignore non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Try to get the response from the cache.
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) {
        // If it's in the cache, return it.
        return cachedResponse;
      }

      // If it's not in the cache, fetch it from the network.
      try {
        const networkResponse = await fetch(event.request);

        // Check if we received a valid response and cache it.
        // This includes opaque responses which are important for CDNs.
        if (networkResponse) {
          // Clone the response because it can only be consumed once.
          const responseToCache = networkResponse.clone();
          await cache.put(event.request, responseToCache);
        }

        return networkResponse;
      } catch (error) {
        console.error('Fetch failed:', error);
        // This is where you might return a fallback offline page if one was cached.
        // For now, re-throwing the error is sufficient.
        throw error;
      }
    })
  );
});