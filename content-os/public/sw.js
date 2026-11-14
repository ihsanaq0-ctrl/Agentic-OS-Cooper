// Agentic OS Service Worker for PWA offline shell & caching
const CACHE_NAME = "agentic-os-v1";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/hud/hud.js",
  "/hud/globe.js",
  "/manifest.json",
  "/icon-192.svg",
  "/icon-512.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Always network-first for API, SSE, and storage
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/storage") || e.request.headers.get("accept")?.includes("text/event-stream")) {
    return;
  }

  // Stale-while-revalidate for static shell assets
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
