/**
 * 🔹 NEXUS SYSTEM | Service Worker (v2)
 * 🔹 Кэширование с версионированием + обход для index.html
 */

const CACHE_VERSION = "nexus-v2"; // 🔹 УВЕЛИЧЬ ЭТО ЧИСЛО при каждом обновлении!
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// 🔹 Файлы для пре-кэширования (без index.html!)
const PRECACHE_ASSETS = [
  "/",
  "/css/style.css",
  "/nexus-js/main.js",
  "/nexus-js/utils.js",
  "/nexus-js/auth-security.js",
  "/nexus-js/decision.js",
  "/nexus-js/documents.js", // 🔹 Новый модуль
  // Добавь другие критичные файлы при необходимости
];

// 🔹 Установить SW и закэшировать статику
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("[SW] Pre-caching:", PRECACHE_ASSETS);
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting()), // 🔹 Активировать сразу
  );
});

// 🔹 Удалить старые кэши при активации
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
            .map((key) => {
              console.log("[SW] Deleting old cache:", key);
              return caches.delete(key);
            }),
        );
      })
      .then(() => self.clients.claim()), // 🔹 Взять под контроль все вкладки сразу
  );
});

// 🔹 Стратегия: Network First для HTML, Cache First для статики
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 🔹 HTML-страницы (index.html, admin.html) — всегда с сети + обновление кэша
  if (request.mode === "navigate" || url.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 🔹 Клонировать ответ для кэша
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => {
          // 🔹 Фоллбэк на кэш, если оффлайн
          return caches.match(request);
        }),
    );
    return;
  }

  // 🔹 API-запросы — только сеть, не кэшировать
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // 🔹 Статика (CSS, JS, изображения) — Cache First, потом сеть
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // 🔹 Не кэшировать ошибки и чанки
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const clone = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, clone);
        });
        return response;
      });
    }),
  );
});

// 🔹 Фоновая синхронизация (опционально, для будущих фич)
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-documents") {
    event.waitUntil(
      // Логика синхронизации при появлении соединения
      console.log("[SW] Background sync: documents"),
    );
  }
});

// 🔹 Push-уведомления (заглушка для будущего)
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  self.registration.showNotification(data.title || "NEXUS", {
    body: data.body || "Новое уведомление",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
  });
});
