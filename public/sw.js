// Service Worker for Optica Rayo PWA
const CACHE_NAME = 'optica-rayo-cache-v1'
const ASSETS_TO_CACHE = [
  '/',
  '/login',
  '/catalog',
  '/favicon.ico',
]

// 1. Install event: Cache essential assets
self.addEventListener('install', (event) => {
  const extendableEvent = event as any;
  extendableEvent.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE)
    })
  )
})

// 2. Activate event: Clean old caches
self.addEventListener('activate', (event) => {
  const extendableEvent = event as any;
  extendableEvent.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache)
          }
        })
      )
    })
  )
})

// 3. Fetch event: Cache-first strategy falling back to network
self.addEventListener('fetch', (event) => {
  const fetchEvent = event as any;
  fetchEvent.respondWith(
    caches.match(fetchEvent.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }
      return fetch(fetchEvent.request).catch(() => {
        // Return cached index as fallback if network fails
        return caches.match('/')
      })
    })
  )
})
