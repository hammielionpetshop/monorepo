'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw, ServerCrash, WifiOff } from 'lucide-react'
import { useConnection } from './connection-provider'

interface OfflineBannerProps {
  /** Menentukan kalimat dampak — apa yang gagal bila tetap dipaksakan. */
  mode?: 'pos' | 'backoffice'
}

const COPY = {
  pos: {
    offline: 'Transaksi baru tidak bisa disimpan sampai koneksi pulih. Isi keranjang tetap aman — jangan tutup atau muat ulang halaman ini.',
    server: 'Server tidak merespons. Internet Anda normal, tetapi transaksi belum bisa disimpan. Jangan tutup atau muat ulang halaman ini.',
  },
  backoffice: {
    offline: 'Perubahan data tidak bisa disimpan sampai koneksi pulih. Angka yang tampil di layar mungkin sudah tidak terbaru.',
    server: 'Server tidak merespons. Internet Anda normal, tetapi perubahan data belum bisa disimpan.',
  },
} as const

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds} detik`
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) return `${minutes} menit`
  const hours = Math.floor(minutes / 60)
  return `${hours} jam ${minutes % 60} menit`
}

export default function OfflineBanner({ mode = 'pos' }: OfflineBannerProps) {
  const { status, isChecking, offlineSince, nextProbeAt, justRecovered, checkNow } = useConnection()
  const [now, setNow] = useState(() => Date.now())

  const isDown = status !== 'online'

  // Detak 1 detik hanya hidup saat banner tampil, supaya halaman yang sehat
  // tidak punya timer berjalan sama sekali.
  useEffect(() => {
    if (!isDown) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [isDown])

  if (!isDown) {
    if (!justRecovered) return null
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-shrink-0 items-center gap-2 border-b border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300 print:hidden"
      >
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span>Koneksi pulih. Anda bisa melanjutkan seperti biasa.</span>
      </div>
    )
  }

  const isServerDown = status === 'server-down'
  const description = isServerDown ? COPY[mode].server : COPY[mode].offline
  const retryInSeconds = nextProbeAt ? Math.max(0, Math.ceil((nextProbeAt - now) / 1000)) : null

  const tone = isServerDown
    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
    : 'border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/20'

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5 print:hidden ${tone}`}
    >
      {isServerDown ? (
        <ServerCrash className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      ) : (
        <WifiOff className="h-5 w-5 flex-shrink-0 animate-pulse" aria-hidden="true" />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight">
          {isServerDown ? 'Server tidak merespons' : 'Tidak ada koneksi internet'}
          {offlineSince && (
            <span className="ml-2 text-xs font-medium opacity-70">
              sejak {formatDuration(now - offlineSince)} lalu
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs leading-snug opacity-90">{description}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-medium tabular-nums opacity-80">
          {isChecking
            ? 'Memeriksa koneksi...'
            : retryInSeconds !== null
              ? `Coba otomatis dalam ${retryInSeconds} dtk`
              : 'Menunggu koneksi...'}
        </span>
        <button
          type="button"
          onClick={checkNow}
          disabled={isChecking}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-black/10 bg-background/60 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
        >
          {isChecking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Coba Lagi
        </button>
      </div>
    </div>
  )
}
