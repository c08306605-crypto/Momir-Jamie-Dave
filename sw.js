/*
 * Network first, cache only as a fallback.
 *
 * A cache-first worker would keep serving last week's app until it happened
 * to update itself, which on a page that changes as often as this one means
 * printing from stale code without knowing it. So every request goes to the
 * network and the cache is only consulted when that fails — the cache exists
 * to let the app open at a table with no signal, not to make it faster.
 */
const CACHE = 'momir-v1';

/* Only what the app needs to boot. Card data and art are always live. */
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      /* One missing file would reject addAll and fail the whole install */
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  /* Scryfall and the CDN are somebody else's to cache */
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(
        (hit) => hit || caches.match('./index.html')
      ))
  );
});
