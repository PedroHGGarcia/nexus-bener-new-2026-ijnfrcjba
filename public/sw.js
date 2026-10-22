/**
 * Service Worker para Bener Nexus (Bener Máquinas)
 * Estratégia de cache:
 * 1. App Shell e estáticos (JS, CSS, fontes, ícones, imagens estáticas locais): Stale-While-Revalidate com cache persistente.
 * 2. Navegação HTML (SPA App Shell): Network-first com fallback para index.html em cache offline.
 * 3. NUNCA CACHEAR:
 *    - Requisições ao Supabase (*.supabase.co, /rest/v1/*, /auth/v1/*, /functions/v1/*)
 *    - APIs externas de cotação / chatbot / upload de arquivos / websockets
 *    - Qualquer método não-GET (POST, PUT, PATCH, DELETE)
 * 4. Atualização: skipWaiting no install e clients.claim no activate para nova versão disponível.
 */

const CACHE_NAME = 'bener-nexus-v1'

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon-32x32.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/maskable-icon-192x192.png',
  '/maskable-icon-512x512.png',
  '/apple-touch-icon.png',
]

// Instalação do Service Worker - Pré-cache do shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS)
      })
      .then(() => {
        return self.skipWaiting()
      }),
  )
})

// Ativação do Service Worker - Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name)
            }
          }),
        )
      })
      .then(() => {
        return self.clients.claim()
      }),
  )
})

// Interceptação de requisições de rede
self.addEventListener('fetch', (event) => {
  const request = event.request

  // 1. Apenas requisições GET são elegíveis para cache
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  // 2. NUNCA CACHEAR chamadas do Supabase, Edge Functions, Chatbot, Cotações ou Auth
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/rest/v1') ||
    url.pathname.startsWith('/auth/v1') ||
    url.pathname.startsWith('/storage/v1') ||
    url.pathname.startsWith('/functions/v1') ||
    url.pathname.includes('/realtime/') ||
    url.hostname.includes('api.') ||
    url.hostname.includes('economia.awesomeapi.com.br') ||
    url.hostname.includes('viacep.com.br') ||
    url.hostname.includes('brasilapi.com.br') ||
    url.hostname.includes('cdn.sheetjs.com')
  ) {
    return
  }

  // Ignorar extensões de browser ou esquemas não http/https
  if (!url.protocol.startsWith('http')) {
    return
  }

  // 3. Navegações do usuário (SPA App Shell) - Network First com fallback para cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME)
          const cachedNav = await cache.match(request)
          if (cachedNav) return cachedNav
          const cachedIndex = await cache.match('/index.html')
          if (cachedIndex) return cachedIndex
          return cache.match('/')
        }),
    )
    return
  }

  // 4. Arquivos estáticos da mesma origem (JS, CSS, imagens locais, fontes) - Stale While Revalidate
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.woff2') ||
      url.pathname.endsWith('.woff') ||
      url.pathname.endsWith('.webmanifest'))
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
            }
            return networkResponse
          })
          .catch(() => cachedResponse)

        return cachedResponse || fetchPromise
      }),
    )
    return
  }

  // 5. Imagens do CDN Skip / curling
  if (url.hostname.includes('img.usecurling.com')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request)
          .then((resp) => {
            if (resp && resp.status === 200) {
              const copy = resp.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
            }
            return resp
          })
          .catch(() => cached)
      }),
    )
  }
})

// Mensagens vindas do app (ex.: SKIP_WAITING para forçar atualização)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
