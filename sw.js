// Shell-only service worker.
//
// Its job is to make the page installable and to launch fast. It deliberately
// caches NOTHING from api.github.com: the page already caches API responses in
// localStorage under the ghcache: prefix with its own TTLs, and the rate-limit
// meter reads X-RateLimit-* off live responses. A second cache in front of
// either would shadow both and make the budget unreadable.
//
// Must live at the repo root. A worker's scope is capped by its own directory,
// so js/sw.js would register successfully, control nothing, and never fire
// beforeinstallprompt.

var CACHE = "dashboard-shell-v2";

var SHELL = [
  "./",
  "index.html",
  "styles.css",
  "js/util.js",
  "js/markdown.js",
  "manifest.json",
  "icons/icon.svg",
  "icons/favicon-32.png",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
});

// No skipWaiting: a new worker takes over on the next launch rather than
// reloading the page out from under an open modal.
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) {
      return k === CACHE ? undefined : caches.delete(k);
    }));
  }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  // Anything off-origin — the GitHub API, avatars, opengraph images — goes
  // straight to the network untouched. See the note at the top.
  if (new URL(req.url).origin !== self.location.origin) return;

  // Navigations are network-first so a pushed update is never hidden behind
  // the cache. This page exists to show current activity; a stale shell is
  // the one failure mode that defeats it.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match("index.html");
        });
      })
    );
    return;
  }

  // Static assets are cache-first, which is what makes launch feel instant.
  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req);
  }));
});
