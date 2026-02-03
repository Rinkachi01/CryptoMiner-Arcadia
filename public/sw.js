// sw.js - Versão corrigida
const CACHE_NAME = 'crypto-miner-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/images/coins/cma-coin.png',
  // Adicione outros recursos essenciais aqui
];

// Instalação - cache dos recursos essenciais
self.addEventListener('install', event => {
  console.log('Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto, adicionando recursos...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Todos os recursos cacheados');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Falha na instalação do cache:', error);
      })
  );
});

// Ativação - limpa caches antigos
self.addEventListener('activate', event => {
  console.log('Service Worker ativado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Claiming clients');
      return self.clients.claim();
    })
  );
});

// Estratégia de fetch: Network First, fallback para Cache
self.addEventListener('fetch', event => {
  // Evita interceptar requisições do próprio Service Worker
  if (event.request.url.includes('/sw.js')) {
    return;
  }
  
  // Para requisições de navegação (páginas)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clona a resposta para cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Se offline, tenta servir do cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Se não tiver no cache, serve a página offline
              return caches.match('/index.html');
            });
        })
    );
    return;
  }
  
  // Para outros recursos (CSS, JS, imagens)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Tenta buscar da rede primeiro
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            // Atualiza o cache com a nova resposta
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            return networkResponse;
          })
          .catch(() => {
            // Se a rede falhar, retorna do cache se disponível
            return cachedResponse;
          });
        
        // Retorna do cache imediatamente se disponível, enquanto busca da rede
        return cachedResponse || fetchPromise;
      })
  );
});