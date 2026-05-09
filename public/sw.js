const CACHE_NAME = 'frosty-v1';

self.addEventListener('install', (event) => {
  console.log('SW Installed');

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW Activated');

  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', () => {});