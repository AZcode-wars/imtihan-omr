const CACHE_NAME = "imtihan-omr-shell-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/setup",
  "/students",
  "/template",
  "/scan",
  "/queue",
  "/grades",
  "/sheet-preview.png",
  "/template.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Gagal pre-cache beberapa aset:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Hanya tangani GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Jangan cache panggilan API ke engine python
  if (url.port === "8000" || url.pathname.startsWith("/v1/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return dari cache, sambil fetch di background untuk update
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).catch(() => {
        // Fallback offline bila tidak ada di cache
        return caches.match("/");
      });
    })
  );
});
