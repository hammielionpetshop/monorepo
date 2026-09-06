'use client'

import { useEffect } from 'react'

/**
 * Kunci shortcut latar POS selama ada modal yang butuh input keyboard.
 *
 * Shortcut latar (F2 cari produk, buffer barcode scanner, F8/F9/F10 di pos-client)
 * dipasang di `window`, jadi tanpa kunci ini tombolnya tetap diproses walau modal
 * sedang terbuka — F2 di modal pembayaran ikut memindahkan fokus ke kotak cari produk.
 *
 * Hitungan, bukan boolean, supaya modal bertumpuk (dialog UOM di atas panel produk)
 * baru melepas kunci setelah lapis terakhir tertutup.
 */
let lockCount = 0

export function acquireShortcutLock(): () => void {
  lockCount += 1
  let released = false
  return () => {
    if (released) return
    released = true
    lockCount -= 1
  }
}

export function isShortcutLocked(): boolean {
  return lockCount > 0
}

/** Hanya dipakai test untuk mengembalikan hitungan ke nol antar kasus. */
export function resetShortcutLock(): void {
  lockCount = 0
}

/**
 * Matikan shortcut latar selama komponen terpasang. Parameter `active` untuk modal yang
 * tetap terpasang saat tertutup dan hanya menyembunyikan diri lewat prop `isOpen`.
 */
export function useShortcutLock(active = true): void {
  useEffect(() => {
    if (!active) return
    return acquireShortcutLock()
  }, [active])
}
