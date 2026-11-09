const CACHE_NAME = 'hogucut-v2.7.0';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon.jpg',
  './assets/kids_shoes.png',
  './assets/s26_case.png',
  './assets/watch_product.png',
  './assets/breezyp_product.png',
  './assets/toocki_product.png',
  './assets/ugreen_product.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/') || e.request.url.includes('cors') || e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request).then((networkRes) => {
      if (networkRes && networkRes.status === 200) {
        const resClone = networkRes.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
      }
      return networkRes;
    }).catch(() => caches.match(e.request))
  );
});
