// Minimal service worker: keep an offline page, and fall back to it when a navigation fails.
// Everything else goes straight to the network, so nothing stale is ever served.
const CACHE = "app-offline-v1";

self.addEventListener("install", (event) => {
  // If storage is unavailable the worker still installs; it just has no offline page to show.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add("/offline"))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .catch(() => {})
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const page = await caches.match("/offline").catch(() => undefined);
      return page ?? Response.error();
    }),
  );
});
