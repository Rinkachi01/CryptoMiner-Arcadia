const CACHE_NAME = 'crypto-miner-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/modules/auth.js',
  '/modules/api.js',
  '/modules/game-manager.js',
  '/modules/mining.js',
  '/modules/inventory.js',
  '/modules/store.js',
  '/modules/ui-manager.js',
  '/modules/utils.js',
  '/modules/game-engines/coin-clicker.js',
  '/modules/game-engines/flappy-rocket.js',
  '/modules/game-engines/crypto-2048.js',
  '/assets/images/favicon.ico',
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Roboto:wght@400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - retorna resposta
        if (response) {
          return response;
        }

        // Clona a requisição
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Verifica se a resposta é válida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clona a resposta
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});