// ===========================================
// SERVICE WORKER - Progressive Web App
// ===========================================

const CACHE_NAME = 'crypto-miner-arcadia-v2';
const OFFLINE_URL = '/offline.html';

// Assets para cachear na instalação
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/modules/auth.js',
  '/modules/api.js',
  '/modules/mining.js',
  '/modules/game-manager.js',
  '/modules/inventory.js',
  '/modules/store.js',
  '/modules/ui-manager.js',
  '/modules/utils.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Roboto:wght@400;500;700;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Service Worker: Cacheando recursos...');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker: Instalação completa');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Service Worker: Erro na instalação:', error);
      })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Ativando...');
  
  // Limpar caches antigos
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('✅ Service Worker: Ativação completa');
      return self.clients.claim();
    })
  );
});

// Interceptar requisições
self.addEventListener('fetch', event => {
  // Ignorar requisições não-GET
  if (event.request.method !== 'GET') return;
  
  // Ignorar requisições de analytics
  if (event.request.url.includes('google-analytics')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Se encontrou no cache, retorna
        if (cachedResponse) {
          console.log('📦 Service Worker: Servindo do cache:', event.request.url);
          return cachedResponse;
        }
        
        // Se não encontrou, faz a requisição
        console.log('🌐 Service Worker: Fazendo requisição:', event.request.url);
        
        return fetch(event.request)
          .then(response => {
            // Verifica se a resposta é válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clona a resposta
            const responseToCache = response.clone();
            
            // Adiciona ao cache
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('💾 Service Worker: Cache atualizado:', event.request.url);
              });
            
            return response;
          })
          .catch(error => {
            console.error('❌ Service Worker: Erro na requisição:', error);
            
            // Se offline e é uma página, mostrar offline page
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            
            // Para outros recursos, retornar resposta vazia
            return new Response('', {
              status: 408,
              statusText: 'Offline'
            });
          });
      })
  );
});

// Mensagens do Service Worker
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push notifications (simplificado)
self.addEventListener('push', event => {
  console.log('📱 Service Worker: Push notification recebida');
  
  const options = {
    body: event.data?.text() || 'Nova notificação do Crypto Miner Arcadia!',
    icon: '/assets/icon-192x192.png',
    badge: '/assets/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: 'Abrir',
        icon: '/assets/checkmark.png'
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: '/assets/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Crypto Miner Arcadia', options)
  );
});

// Clique em notificação
self.addEventListener('notificationclick', event => {
  console.log('👆 Service Worker: Notificação clicada');
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // Abrir/focar a aplicação
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});