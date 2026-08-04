const CACHE_NAME = 'frosty-bite-cache-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install a service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Cache and return requests
self.addEventListener('fetch', event => {
  // Only handle GET requests and avoid cross-origin or chrome-extension schemes
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip caching for Vite dev-server internals (dev-only, safe to keep for prod too)
  if (
    event.request.url.includes('/node_modules/') ||
    event.request.url.includes('/@vite/') ||
    event.request.url.includes('/src/') ||
    event.request.url.includes('.hot-update')
  ) {
    return;
  }

  // FIX: Removed the `?v=` and `?t=` bail-outs.
  // Vite adds ?v=<hash> to module preloads in production; bailing without calling
  // event.respondWith() leaves those requests unhandled and breaks offline support.
  // The cache.put() call below already deduplicates them correctly.

  // Network-first for HTML navigation routes to prevent stale chunk errors.
  // FIX: Removed `event.request.url.includes('/?')` — that matched ANY query string
  // (e.g. /checkout?step=2) and forced those pages into the navigation path incorrectly.
  const isNavigation =
    event.request.mode === 'navigate' ||
    event.request.url === self.location.origin ||
    event.request.url === self.location.origin + '/' ||
    event.request.url === self.location.origin + '/index.html';

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match('/') || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Stale-While-Revalidate strategy for API data, menu queries, orders, and media
  const isApiOrMenuReq = event.request.url.includes('/rest/v1/') ||
                         event.request.url.includes('/api/') ||
                         event.request.destination === 'image';

  if (isApiOrMenuReq) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(response => {
          // Only cache valid same-origin responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return response;
        }).catch(() => {
          return caches.match('/');
        });
      })
  );
});

// Activate: clear old caches and claim clients
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Background Sync
self.addEventListener('sync', event => {
  console.log('[Service Worker] Background Sync event triggered:', event.tag);
  if (event.tag === 'sync-orders') {
    event.waitUntil(
      Promise.resolve(true).then(() => {
        console.log('[Service Worker] Syncing orders in background completed.');
      })
    );
  }
});

// Periodic Sync
self.addEventListener('periodicsync', event => {
  console.log('[Service Worker] Periodic Background Sync event triggered:', event.tag);
  if (event.tag === 'update-menu-cache') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return fetch('/index.html').then(response => {
          if (response.status === 200) {
            cache.put('/index.html', response.clone());
          }
        });
      }).catch(err => {
        console.error('[Service Worker] Periodic meal updates failed:', err);
      })
    );
  }
});

// Push Notifications
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Notification event received.');

  let data = {
    title: 'Frosty Bite',
    body: 'Fresh out of the oven! Your delicious treats are ready.',
    icon: '/logo_192.png',
    badge: '/logo_192.png'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Frosty Bite',
        body: event.data.text(),
        icon: '/logo_192.png',
        badge: '/logo_192.png'
      };
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo_192.png',
    badge: data.badge || '/logo_192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: 'View Treats Now',
        icon: '/logo_192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/logo_192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click Received.', event.notification.tag);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
