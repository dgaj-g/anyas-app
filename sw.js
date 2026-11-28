/* Network first, so a new version always arrives; the saved copy is only used with no signal. */
const V = '8';
const CACHE = 'anya-' + V;
const CORE = ['./', 'index.html', 'css/app.css', 'fonts/quicksand.woff2', 'fonts/allura.woff2',
  'js/config.js', 'js/wordmark-data.js', 'js/fx.js', 'js/intro.js', 'js/store.js', 'js/diagram.js', 'js/questions.js',
  'js/ring.js', 'js/lessons.js', 'js/player.js', 'js/minus.js', 'js/minusplay.js', 'js/times.js', 'js/timesplay.js', 'js/app.js', 'icons/icon-192.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
