'use client'

import { ServerCrash, Wifi, WifiOff } from 'lucide-react'
import { useConnection } from './connection-provider'

/**
 * Pil status koneksi untuk header POS. Selalu tampil (termasuk saat online)
 * supaya kasir punya rujukan tetap: kalau pilnya hijau, masalahnya bukan jaringan.
 */
export default function ConnectionIndicator() {
  const { status } = useConnection()

  if (status === 'offline') {
    return (
      <span
        role="status"
        aria-live="polite"
        title="Tidak ada koneksi ke server — transaksi tidak bisa disimpan"
        className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive print:hidden"
      >
        <WifiOff className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
        Offline
      </span>
    )
  }

  if (status === 'server-down') {
    return (
      <span
        role="status"
        aria-live="polite"
        title="Server tidak merespons — transaksi belum bisa disimpan"
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300 print:hidden"
      >
        <ServerCrash className="h-3.5 w-3.5" aria-hidden="true" />
        Server
      </span>
    )
  }

  return (
    <span
      role="status"
      aria-live="polite"
      title="Terhubung ke server"
      className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400 print:hidden"
    >
      <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
      Online
    </span>
  )
}
