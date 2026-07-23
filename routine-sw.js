// Bump this version number any time you edit routine.html / routine-manifest.json
// so the service worker knows to refresh the cache.
const CACHE_NAME = "routine-12c-v3";

// Files that should always be re-checked against the network first
// (the content that actually changes when you update the routine).
const NETWORK_FIRST_ASSETS = [
  "/routine.html",
  "/routine-manifest.json",
];

// Files that rarely/never change — safe to serve straight from cache.
const CACHE_FIRST_ASSETS = [
  "/routine-icon-192.png",
  "/routine-icon-512.png",
  "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap"
];

const CORE_ASSETS = [...NETWORK_FIRST_ASSETS, ...CACHE_FIRST_ASSETS];

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

// Activate: clean up old cache versions and take control of open tabs right away
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

// Allow the page to explicitly ask a waiting worker to activate immediately.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isNetworkFirst(url) {
  let pathname;
  try {
    pathname = new URL(url).pathname;
  } catch (e) {
    pathname = url;
  }
  return NETWORK_FIRST_ASSETS.some((path) => pathname.endsWith(path));
}

// Fetch:
//  - routine.html / routine-manifest.json  -> NETWORK-FIRST
//       Always try the live server first so routine edits show up
//       immediately. Only fall back to the cached copy if the request
//       fails (i.e. the visitor is offline).
//  - everything else (icons, fonts)        -> CACHE-FIRST
//       These don't change, so serving from cache first is fine and
//       faster, with network as a fallback.
//
// NOTE: because this service worker is registered with scope "/routine.html",
// it will only ever intercept requests for that page — index.html, notes.html,
// and books.html are completely untouched.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const isNavigation = req.mode === "navigate";

  if (isNavigation || isNetworkFirst(req.url)) {
    event.respondWith(
      fetch(req, { cache: "no-store" }) // bypass the browser's HTTP cache, not just our own Cache Storage
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, copy).catch(() => {});
          });
          return response;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("/routine.html")))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, copy).catch(() => {});
          });
          return response;
        })
        .catch(() => {});
    })
  );
});
