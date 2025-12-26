// Service worker cache
const CACHE_NAME = 'foodwatch-cache-v2';
const OFFLINE_URLS = [
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/db.js',
  'js/scanner.js',
  'js/notifications.js',
  'js/aiPriceAgent.js',
  'img/icon-192.png',
  'img/icon-512.png'
];

self.addEventListener('install', event => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => (key !== CACHE_NAME ? caches.delete(key) : null))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.hostname.includes('openfoodfacts')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return (
        response ||
        fetch(event.request).then(fetchRes =>
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchRes.clone());
            return fetchRes;
          })
        )
      );
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientsArr => {
        if (clientsArr.length > 0) {
          return clientsArr[0].focus();
        } else {
          return clients.openWindow('./');
        }
      })
  );
});
