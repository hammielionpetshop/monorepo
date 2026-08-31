// Kirim laporan settlement shift ke printer termal 80mm via QZ Tray (raw ESC/POS),
// melewati dialog cetak browser. Penyusun perintahnya ada di `lib/escpos-settlement.ts`.
//
// Settlement selalu dicetak lewat aksi klik user (bukan otomatis tiap transaksi seperti
// struk), jadi modul ini tak butuh mesin caching ketersediaan seperti `lib/qz-receipt.ts`:
// satu kali sambung dengan tenggang panjang, gagal → pemanggil jatuh ke `window.print()`.
//
// Loader qz-tray.js diduplikasi tipis dari modul saudara alih-alih difaktorkan ulang —
// pola yang sama dipakai `lib/qz-print.ts` dan `lib/qz-receipt.ts`.

import { buildSettlementEscpos, type SettlementPrintData } from '@/lib/escpos-settlement'
import { getStrukPrinterName } from '@/lib/qz-receipt'
import { configureQzSecurity } from '@/lib/qz-security'

export type { SettlementPrintData } from '@/lib/escpos-settlement'

const CONNECT_TIMEOUT_MS = 8000

type QzGlobal = {
  websocket: { isActive: () => boolean; connect: (opts?: unknown) => Promise<void> }
  printers: { getDefault: () => Promise<string> }
  configs: { create: (printer: string, opts?: unknown) => unknown }
  print: (config: unknown, data: unknown[]) => Promise<void>
}

let qzLoadPromise: Promise<QzGlobal> | null = null

function loadQz(): Promise<QzGlobal> {
  if (typeof window === 'undefined') return Promise.reject(new Error('QZ Tray hanya tersedia di browser'))
  const existing = (window as unknown as { qz?: QzGlobal }).qz
  if (existing) {
    configureQzSecurity(existing)
    return Promise.resolve(existing)
  }
  if (qzLoadPromise) return qzLoadPromise

  qzLoadPromise = new Promise<QzGlobal>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/qz-tray.js'
    script.async = true
    script.onload = () => {
      const qz = (window as unknown as { qz?: QzGlobal }).qz
      if (qz) {
        configureQzSecurity(qz)
        resolve(qz)
      } else reject(new Error('qz-tray.js dimuat tapi global qz tidak tersedia'))
    }
    script.onerror = () => {
      qzLoadPromise = null
      reject(new Error('Gagal memuat qz-tray.js'))
    }
    document.head.appendChild(script)
  })
  return qzLoadPromise
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/**
 * Kirim laporan settlement sebagai raw ESC/POS. Melempar bila QZ Tray tak terpasang/aktif
 * atau printer tak ditemukan — pemanggil WAJIB menangkapnya dan jatuh ke `window.print()`.
 */
export async function printSettlementViaQz(data: SettlementPrintData): Promise<void> {
  const qz = await withTimeout(loadQz(), CONNECT_TIMEOUT_MS, 'Gagal memuat qz-tray.js tepat waktu')
  if (!qz.websocket.isActive()) {
    await withTimeout(qz.websocket.connect(), CONNECT_TIMEOUT_MS, 'QZ Tray tidak merespons')
  }
  const printer = getStrukPrinterName() || (await qz.printers.getDefault())
  if (!printer) throw new Error('Printer default tidak ditemukan di QZ Tray')

  const config = qz.configs.create(printer, { encoding: 'CP437' })
  await qz.print(config, [
    { type: 'raw', format: 'command', flavor: 'plain', data: buildSettlementEscpos(data) },
  ])
}
