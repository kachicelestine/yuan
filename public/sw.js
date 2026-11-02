// Minimal service worker: keep an offline page, fall back to it when a navigation fails, and
// show alerts. Everything else goes straight to the network, so nothing stale is ever served.
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

self.addEventListener("push", (event) => {
  let alert = {};
  try {
    alert = event.data?.json() ?? {};
  } catch {
    // Not one of ours; browsers still expect something to be shown.
  }
  event.waitUntil(self.registration.showNotification(alert.title || "New notification", { body: alert.body, icon: "/icon/192", data: { link: alert.link } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = new URL(event.notification.data?.link || "/notifications", self.location.origin);
  const url = link.origin === self.location.origin ? link.href : new URL("/notifications", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(async (tabs) => {
      const tab = tabs[0];
      if (!tab) return self.clients.openWindow(url);
      const opened = await tab.navigate(url);
      return (opened ?? tab).focus();
    }),
  );
});
