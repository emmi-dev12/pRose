// Offline support for the pRose PWA. All notebook data lives in IndexedDB (not
// here) — this only caches the app shell.
//
// Strategy:
//   • navigations / HTML  → network-first (so a new deploy applies immediately;
//     falls back to cache when offline)
//   • hashed assets, etc. → stale-while-revalidate
const CACHE = 'prose-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      // drop older caches so a stale bundle can't linger
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const isNav = req.mode === 'navigate' || req.destination === 'document';

  if (isNav) {
    // network-first for the page itself
    e.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return (await cache.match(req)) || (await cache.match('./index.html')) || Response.error();
        }
      })(),
    );
    return;
  }

  // stale-while-revalidate for everything else (hashed assets are immutable)
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});
