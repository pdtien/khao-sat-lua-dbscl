const CACHE_NAME = 'khao-sat-lua-3vung-v4.0';
const TILE_CACHE_NAME = 'khao-sat-lua-3vung-tiles-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css?v=4.0',
  './app.js?v=4.0',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/leaflet.css',
  './vendor/leaflet.js',
  './vendor/jszip.min.js',
  './vendor/xlsx.full.min.js',
  './vendor/qrcode.min.js',
  './data/region_bounds.js?v=4.0',
  './data/presets_dbscl.js?v=4.0'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('khao-sat-lua-3vung-') && key !== CACHE_NAME && key !== TILE_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cache map tiles dynamically for offline field reuse
  if (
    url.hostname.includes('arcgisonline.com') ||
    url.hostname.includes('openstreetmap.org') ||
    url.hostname.includes('basemaps.cartocdn.com')
  ) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((cache) => {
        return cache.match(req).then((cachedResp) => {
          const networkFetch = fetch(req)
            .then((netResp) => {
              if (netResp && (netResp.status === 200 || netResp.type === 'opaque')) {
                cache.put(req, netResp.clone());
              }
              return netResp;
            })
            .catch(() => cachedResp);
          return cachedResp || networkFetch;
        });
      })
    );
    return;
  }

  // Network-first for HTML/JS/CSS so updates appear immediately when online, fallback to cache when offline
  event.respondWith(
    fetch(req)
      .then((netResp) => {
        if (netResp && netResp.status === 200 && url.origin === self.location.origin) {
          const respClone = netResp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, respClone));
        }
        return netResp;
      })
      .catch(() => caches.match(req))
  );
});
