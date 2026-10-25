// Network-first service worker: caches the static shell for flaky venue Wi-Fi.
const CACHE = "countmein-v2";
// Only public-ish pages are kept for offline use; private pages (/me, /inbox, /space, …) are never cached.
const OFFLINE_OK = (p) => p === "/" || p.startsWith("/e/") || p.startsWith("/p/");
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) return;
  const isStatic = url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons");
  if (isStatic) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    })));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok && OFFLINE_OK(url.pathname)) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match("/"))));
  }
});
