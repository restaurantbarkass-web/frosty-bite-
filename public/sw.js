const CACHE_NAME = "frosty-cache-v3";

const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json"
];

// Install → cache files
self.addEventListener("install", event => {
  self.skipWaiting(); // activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Activate → delete old cache
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch → network first (best for updates)
self.addEventListener("fetch", event => {
  // Only handle GET requests and local/standard protocols to avoid issues with chrome-extension:// etc.
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then(res => {
        // Cache successful responses
        if (res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, resClone);
          });
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
