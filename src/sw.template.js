/* ASF service worker — generated at build time from src/sw.template.js (see vite.config.ts).
 *
 * - App shell (HTML, JS, CSS, icons) is precached, so the app opens and plays with no network.
 *   Your uploads live in IndexedDB and downloaded songs in the audio cache, so they play offline.
 * - Hashed /assets/* are cache-first; pages are network-first with the cached shell as fallback.
 * - Fonts are self-hosted and precached; images are cached as they're used. Downloaded audio lives in its own cache
 *   ("asf-audio-v1") that is never purged on update; the app reads it directly.
 * - API calls always go to the network.
 */
const VERSION = '__VERSION__';
const PRECACHE = '__PRECACHE__';
const SHELL = `asf-shell-${VERSION}`;
const RUNTIME = 'asf-runtime-v1';
const KEEP = new Set([SHELL, RUNTIME, 'asf-audio-v1', 'asf-media-v1']);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!KEEP.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirstPage(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(SHELL)).put('/', res.clone());
    return res;
  } catch {
    return (await caches.match('/', { cacheName: SHELL })) || Response.error();
  }
}

async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') (await caches.open(cacheName)).put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  const update = fetch(req)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || update;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    if (req.mode === 'navigate') return event.respondWith(networkFirstPage(req));
    if (url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(req, RUNTIME));
    if (req.headers.has('range')) return; // media streams
    return event.respondWith(staleWhileRevalidate(req));
  }
});
