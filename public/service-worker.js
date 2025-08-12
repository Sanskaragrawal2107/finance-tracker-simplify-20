const CACHE_NAME = 'finance-tracker-cache-v2';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(err => console.error('[ServiceWorker] Installation failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const reqUrl = event.request.url || '';

  // Skip chrome-extension and other unsupported schemes early
  if (reqUrl.startsWith('chrome-extension://')) {
    return;
  }

  const supabaseUrl = 'bpyzpnioddmzniuikbsn.supabase.co';

  // Ignore non-HTTP(S) schemes (e.g., chrome-extension://)
  let url;
  try {
    url = new URL(reqUrl);
  } catch {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Exclude GPT Engineer script from SW handling and caching
  if (reqUrl.includes('cdn.gpteng.co/gptengineer.js')) {
    return; // Let the browser handle without caching
  }

  // If the request is for the Supabase API, always go to the network.
  if (reqUrl.includes(supabaseUrl)) {
    return; // Let the browser handle the request.
  }

  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  // Always network-first for JS and CSS to avoid stale hashed bundles
  if (event.request.destination === 'script' || event.request.destination === 'style') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // For navigation requests, use a network-first strategy.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For all other requests, use a cache-first strategy.
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // If we have a cached response, return it.
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise, fetch from the network.
        return fetch(event.request).then((networkResponse) => {
          // Only cache valid http(s) 200 responses
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (url.protocol === 'http:' || url.protocol === 'https:')
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Best-effort cache put, ignore failures (e.g., chrome-extension requests)
                try {
                  if (!reqUrl.startsWith('chrome-extension://')) {
                    cache.put(event.request, responseToCache).catch(() => {});
                  }
                } catch {}
              });
          }
          return networkResponse;
        });
      })
  );
});