'use client'

import { useEffect, useState } from 'react'

export default function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')

        // SW baru sudah menunggu (mis. tab dibuka saat deploy lain berjalan).
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting)
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            // 'installed' + sudah ada controller = ini update, bukan instalasi pertama.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(installing)
            }
          })
        })
      } catch {
        // registrasi gagal — abaikan, app tetap berjalan normal
      }
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register)
      return () => window.removeEventListener('load', register)
    }
  }, [])

  if (!waitingWorker) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
      <div className="flex w-full max-w-md items-center gap-3 rounded-lg border border-amber-200 bg-white px-4 py-3 shadow-lg">
        <span className="flex-1 text-sm text-gray-700">
          Versi baru tersedia.
        </span>
        <button
          type="button"
          onClick={() => waitingWorker.postMessage('SKIP_WAITING')}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700"
        >
          Muat ulang
        </button>
      </div>
    </div>
  )
}
