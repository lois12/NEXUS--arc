// ============================================================================
// NEXUS SYSTEM | sw.js (v13 - DEV-SAFE: NETWORK-FIRST FOR CSS/JS)
// ============================================================================
const CACHE_NAME = "nexus-v13";
const STATIC_ASSETS = ["/", "/index.html", "/admin.html", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith("http"))
    return;

  const url = new URL(event.request.url);
  const isCssJs = /\.(css|js)$/i.test(url.pathname);

  // 🔹 СЕТИ ПЕРВЫЙ ДЛЯ CSS/JS (всегда свежая версия при разработке)
  if (isCssJs) {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          // Сохраняем копию в кэш для оффлайна
          const cacheCopy = networkRes.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, cacheCopy));
          return networkRes;
        })
        .catch(() => caches.match(event.request)), // Если оффлайн -> берём из кэша
    );
    return;
  }

  // 🔹 КЭШ ПЕРВЫЙ ДЛЯ ОСТАЛЬНОГО (HTML, картинки, шрифты)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        if (event.request.headers.get("accept")?.includes("text/html")) {
          return caches.match("/index.html");
        }
        return new Response("Offline", {
          status: 503,
          statusText: "Service Unavailable",
        });
      });
    }),
  );
});
