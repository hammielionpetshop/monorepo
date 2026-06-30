// Service worker minimal untuk PWA "installable".
// Cache aset statis (icon, _next/static) + halaman fallback offline.
// HTML & API selalu dari network agar data dashboard ber-auth tidak pernah basi;
// hanya saat network gagal, navigasi dialihkan ke halaman /offline.
const CACHE = 'hammielion-static-v2'
const OFFLINE_URL = '/offline'
// Batas jumlah aset _next/static yang disimpan agar cache tidak tumbuh tanpa batas
// setiap kali ada deploy baru (chunk ber-hash lama menumpuk).
const MAX_STATIC_ENTRIES = 100

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))
      // Tidak skipWaiting otomatis: SW baru menunggu sampai halaman memintanya
      // (lihat handler 'message' di bawah) supaya bisa muncul notifikasi update.
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icon') ||
    url.pathname === '/manifest.webmanifest'
  )
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  const overflow = keys.length - maxEntries
  if (overflow <= 0) return
  // Hapus entri terlama (FIFO) — yang penting bukan offline-url.
  let removed = 0
  for (const request of keys) {
    if (removed >= overflow) break
    if (new URL(request.url).pathname === OFFLINE_URL) continue
    await cache.delete(request)
    removed += 1
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigasi halaman: selalu network-first, fallback ke /offline saat gagal.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request)
        } catch {
          const cache = await caches.open(CACHE)
          const offline = await cache.match(OFFLINE_URL)
          return offline ?? Response.error()
        }
      })()
    )
    return
  }

  if (!isStaticAsset(url)) return

  event.respondWith(
    (async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE)
          await cache.put(request, response.clone())
          event.waitUntil(trimCache(CACHE, MAX_STATIC_ENTRIES))
        }
        return response
      } catch {
        return cached ?? Response.error()
      }
    })()
  )
})
