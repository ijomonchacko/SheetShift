/* SheetShift service worker — offline support.
 *
 * Strategy:
 *   - navigations: network-first, falling back to the cached app shell
 *   - build assets, fonts, icons: cache-first (hashed/immutable-ish)
 *   - tesseract CDN files (OCR engine + language model): cache-first, so
 *     OCR keeps working offline after the first successful run
 */
const CACHE = "sheetshift-v2";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheFirst(req) {
  return caches.match(req).then(
    (hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      })
  );
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // SPA navigations: network first, cached shell offline.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", clone));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const isStatic =
    sameOrigin &&
    (url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/fonts/") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".pdf") ||
      url.pathname.endsWith(".webmanifest"));
  const isTesseract = /tesseract|traineddata/i.test(url.href);

  if (isStatic || isTesseract) {
    e.respondWith(cacheFirst(e.request));
  }
});
