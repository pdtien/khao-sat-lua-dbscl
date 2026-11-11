const CACHE_NAME = 'khao-sat-lua-pwa-v2.1';
const TILE_CACHE_NAME = 'khao-sat-lua-tiles-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/leaflet.css',
  './vendor/leaflet.js',
  './vendor/jszip.min.js',
  './vendor/xlsx.full.min.js',
  './vendor/qrcode.min.js',
  './data/presets_dbscl.js',
  './data/DanhMuc_50RuongGoc_Mau_DBSCL.json'
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
          if (key !== CACHE_NAME && key !== TILE_CACHE_NAME) {
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

  // Cache map tiles (Esri, OpenStreetMap, Carto) dynamically for field offline reuse
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

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(req).then((cachedResp) => {
      const fetchPromise = fetch(req)
        .then((netResp) => {
          if (netResp && netResp.status === 200 && url.origin === self.location.origin) {
            const respClone = netResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, respClone));
          }
          return netResp;
        })
        .catch(() => cachedResp);
      return cachedResp || fetchPromise;
    })
  );
});
