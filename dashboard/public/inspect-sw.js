/* Inspection PWA service worker.
 *
 * Goal: let the kiosk load when Wi-Fi is down. Inspection *data* resilience is
 * handled in the app (IndexedDB queue) — this only caches the app shell and
 * static assets. It never touches /api requests or admin-surface navigations.
 */
// Derive the app base from the SW's own location so this works whatever subpath
// the platform is served under (e.g. "/level3/").
const BASE = self.location.pathname.replace(/[^/]*$/, '');
const CACHE = 'qc-inspect-v4';
const SHELL = [
  BASE + 'inspect.html',
  BASE + 'config.js',
  BASE + 'logo.png',
  BASE + 'inspect.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // mutations always hit the network (queue handles offline)

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(BASE + 'api/')) return; // never cache API calls

  // Navigations: only shell-fallback the inspection PWA; leave admin pages alone.
  if (req.mode === 'navigate') {
    if (url.pathname.startsWith(BASE + 'inspect')) {
      event.respondWith(fetch(req).catch(() => caches.match(BASE + 'inspect.html')));
    }
    return;
  }

  // Static assets (content-hashed by Vite): cache-first, then network.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        }),
    ),
  );
});
