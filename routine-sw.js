// Bump this version number any time you edit routine.html / routine-manifest.json
// so the service worker knows to refresh the cache.
const CACHE_NAME = "routine-12c-v1";

const CORE_ASSETS = [
  "/routine.html",
  "/routine-manifest.json",
  "/routine-icon-192.png",
  "/routine-icon-512.png",
  "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap"
];

// Install: pre-cache the core files so the routine page works fully offline
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use individual add() calls so one failing request (e.g. a font
      // fetch blocked by CORS) doesn't stop the rest from caching.
      return Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(new Request(url, { mode: "no-cors" })).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate: clean up old cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first, falling back to network, falling back to cached routine.html
// NOTE: because this service worker is registered with scope "/routine.html",
// it will only ever intercept requests for that page — index.html, notes.html,
// and books.html are completely untouched.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy).catch(() => {});
          });
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("/routine.html");
          }
        });
    })
  );
});
