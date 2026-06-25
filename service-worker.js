/**
 * VoiceFlow — Service Worker
 * Стратегия: Cache First + Network Fallback (App Shell Pattern)
 * 
 * При первом посещении SW кэширует все ресурсы оболочки приложения (App Shell).
 * При последующих запросах сначала проверяется кэш, при промахе — сеть.
 * Новые ресурсы из сети также кэшируются динамически.
 */

const CACHE_NAME = 'voiceflow-v1';

/** Ресурсы App Shell — кэшируются при установке SW */
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './voice.js',
  './manifest.json',
  './icon.svg'
];

/**
 * Событие INSTALL
 * Кэшируем App Shell и сразу активируем SW (skipWaiting)
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching App Shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => self.skipWaiting())
  );
});

/**
 * Событие ACTIVATE
 * Удаляем старые кэши и захватываем контроль над всеми клиентами
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
  );
});

/**
 * Событие FETCH
 * Стратегия: Cache First + Network Fallback
 * 1. Ищем ответ в кэше
 * 2. Если нет — идём в сеть
 * 3. Успешный сетевой ответ кэшируем динамически
 * 4. Если и сеть недоступна — отдаём index.html для навигационных запросов
 */
self.addEventListener('fetch', (event) => {
  // Пропускаем не-GET запросы
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // В кэше нет — идём в сеть
        return fetch(event.request)
          .then(networkResponse => {
            // Кэшируем только успешные ответы
            if (networkResponse && networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Сеть недоступна — fallback для навигации
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            // Для остальных ресурсов — просто ошибка
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});
