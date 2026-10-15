// Spremljevalec dela brez povezave: lupina strani je v predpomnilniku.
const PREDPOMNILNIK = 'wayfare-spremljevalec-1';
const LUPINA = ['./', 'index.html', 'telefon.js', 'manifest.webmanifest', 'ikona-180.png', 'ikona-192.png', 'ikona-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(PREDPOMNILNIK).then(c => c.addAll(LUPINA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== PREDPOMNILNIK).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});
// Najprej splet (sveza razlicica), brez povezave predpomnilnik.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const kopija = r.clone();
    caches.open(PREDPOMNILNIK).then(c => c.put(e.request, kopija)).catch(() => {});
    return r;
  }).catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match('index.html'))));
});
