// Service worker for handling network connectivity issues

// Cache name
const CACHE_NAME = 'finance-tracker-v1';

// Assets to cache for offline use
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/lovable-uploads/74a5a478-2c11-4188-88b3-76b7897376a9.png',
  '/lovable-uploads/1d876bba-1f25-45bf-9f5b-8f81f72d4880.png',
];

// Install event - cache basic assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  
  // Force this service worker to become active right away
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  
  // Take control of all clients immediately
  event.waitUntil(self.clients.claim());
  
  return self.clients.claim();
});

// Track client visibility to handle offline requests better
const visibleClients = new Set();

// Watch for visibility messages from clients
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.type === 'VISIBILITY_CHANGE') {
      if (event.data.state === 'visible') {
        // Tab became visible
        if (event.source && event.source.id) {
          visibleClients.add(event.source.id);
        }
      } else {
        // Tab became hidden
        if (event.source && event.source.id) {
          visibleClients.delete(event.source.id);
        }
      }
    } else if (event.data.type === 'PING') {
      // Respond to ping request
      event.ports[0].postMessage({ 
        type: 'PONG', 
        timestamp: Date.now(),
        active: true
      });
    } else if (event.data.type === 'CLEAR_CACHE') {
      // Clear cache when requested
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0].postMessage({ 
          type: 'CACHE_CLEARED', 
          timestamp: Date.now() 
        });
      });
    }
  }
});

// Helper function to check if fetch should be handled
const shouldHandleFetch = (request) => {
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return false;
  }

  // Skip certain URLs
  const url = new URL(request.url);
  if (url.pathname.includes('browser-sync') || 
      url.pathname.includes('realtime') ||
      url.pathname.includes('rest/v1') ||
      url.pathname.includes('auth/v1')) {
    return false;
  }
  
  return true;
};

// Network first, falling back to cache strategy for GET requests
self.addEventListener('fetch', (event) => {
  // Skip non-handled requests
  if (!shouldHandleFetch(event.request)) {
    return;
  }

  // Add a custom header to track if the request is from a visible client
  const hasVisibleClients = visibleClients.size > 0;
  
  event.respondWith(
    // Try to get from network first
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch((error) => {
        console.log('[ServiceWorker] Fetch failed; returning cached response instead.', error);
        
        // Try to get from cache
        return caches.match(event.request).then((cachedResponse) => {
          // Return cached response or a fallback
          if (cachedResponse) {
            // Add a header to indicate cache source
            const headers = new Headers(cachedResponse.headers);
            headers.append('X-Cache-Source', 'service-worker');
            
            // Return modified cached response 
            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers: headers
            });
          }
          
          // For navigation requests, return the offline page
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          
          // Otherwise, return a simple response
          if (event.request.url.includes('/api/') || 
              event.request.url.includes('.supabase.co')) {
            // API requests
            return new Response(
              JSON.stringify({ 
                error: 'Network error, please refresh', 
                offline: true,
                cached: false
              }),
              { 
                status: 503,
                headers: { 'Content-Type': 'application/json' } 
              }
            );
          } else {
            // Other asset requests
            return new Response(
              'Network error, please refresh the page',
              { 
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' } 
              }
            );
          }
        });
      })
  );
}); 