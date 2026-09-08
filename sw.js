// Tasyurek Tracker — Service Worker
// v2: NETWORK-FIRST stratejisine geçildi.
// Önceki sürüm (stale-while-revalidate) geliştirme sırasında kafa karıştırıcıydı:
// her düzeltme sonrası kullanıcı hep BİR ÖNCEKİ (eski, önbellekteki) sürümü
// görüyor, yeni kod sadece bir sonraki açılış için arka planda indiriliyordu.
// Artık: önce ağdan taze veri çekilir (varsa her zaman en güncel kod gösterilir);
// sadece ağ tamamen yoksa (gerçek offline durum) önbellekteki son bilinen
// sürüm gösterilir. Uygulama tamamen stabilize olduktan sonra tekrar
// cache-first'e geçilebilir.

const CACHE_NAME = 'tasyurek-shell-v2';
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

// NETWORK-FIRST: önce ağdan taze içerik dene; başarısız olursa (gerçek
// offline durum) önbellekteki en son bilinen sürümü göster.
self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  // Sadece kendi uygulama dosyalarımızı (aynı origin) bu stratejiyle yönet.
  // Firebase/Firestore/Auth istekleri zaten her zaman ağa gidiyor.
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(function(res) {
      if (res && res.status === 200) {
        var resClone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(req, resClone);
        });
      }
      return res;
    }).catch(function() {
      return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(req);
      });
    })
  );
});
