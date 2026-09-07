// Tasyurek Tracker — Service Worker
// Amaç: uygulama kabuğunu (index.html + app-bundle.js) cihaza önbellekleyip
// sonraki açılışları anında (ağ beklemeden) yapmak.

const CACHE_NAME = 'tasyurek-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './app-bundle.js'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(SHELL_FILES);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

// Cache-first, arka planda güncelle (stale-while-revalidate):
// Kullanıcı önbellekten ANINDA içerik görür; aynı anda ağdan taze
// sürüm çekilip önbellek güncellenir, bir sonraki açılışta o kullanılır.
self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  // Sadece kendi uygulama dosyalarımızı (aynı origin) bu stratejiyle yönet.
  // Firebase/Firestore/Auth istekleri her zaman ağa gitsin (canlı veri).
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(req).then(function(cached) {
        var networkFetch = fetch(req).then(function(res) {
          if (res && res.status === 200) {
            cache.put(req, res.clone());
          }
          return res;
        }).catch(function() { return cached; });
        return cached || networkFetch;
      });
    })
  );
});
