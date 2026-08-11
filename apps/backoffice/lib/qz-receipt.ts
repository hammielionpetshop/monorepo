// Kirim struk kasir ke printer termal 80mm via QZ Tray (raw ESC/POS), melewati dialog
// cetak browser sepenuhnya. Penyusun perintahnya ada di `lib/escpos-receipt.ts`.
//
// Modul saudara `lib/qz-print.ts` (surat jalan, ESC/P dot-matrix). Loader qz-tray.js
// sengaja diduplikasi tipis alih-alih memfaktorkan ulang berkas itu: berkas itu sudah
// tervalidasi di printer nyata lewat dua putaran uji cetak, dan tidak ada alasan
// mengusiknya demi menghemat dua puluh baris.
//
// Semua fungsi di sini hanya boleh dipanggil di sisi klien (event handler / efek).

import { buildReceiptEscpos, type EscposReceiptData } from '@/lib/escpos-receipt'

export type { EscposReceiptData as ReceiptPrintData } from '@/lib/escpos-receipt'

const PRINTER_STORAGE_KEY = 'struk_printer_name'

/**
 * Batas tunggu koneksi. QZ Tray yang tidak jalan tidak menolak seketika — tanpa batas ini
 * kasir menunggu beberapa detik di setiap penjualan sebelum dialog cetak muncul.
 */
const CONNECT_TIMEOUT_MS = 2500

export function getStrukPrinterName(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(PRINTER_STORAGE_KEY)
}

export function setStrukPrinterName(name: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PRINTER_STORAGE_KEY, name)
}

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
  if (existing) return Promise.resolve(existing)
  if (qzLoadPromise) return qzLoadPromise

  qzLoadPromise = new Promise<QzGlobal>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/qz-tray.js'
    script.async = true
    script.onload = () => {
      const qz = (window as unknown as { qz?: QzGlobal }).qz
      if (qz) resolve(qz)
      else reject(new Error('qz-tray.js dimuat tapi global qz tidak tersedia'))
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

export type QzAvailability = 'unknown' | 'available' | 'unavailable'

// Hasil probe disimpan selama halaman hidup. Struk dicetak tiap transaksi, jadi menunggu
// koneksi gagal berulang kali di stasiun tanpa QZ berarti menghukum kasir di setiap
// penjualan — cukup sekali tahu, sesudahnya langsung ke jalur cadangan tanpa jeda.
let availability: QzAvailability = 'unknown'
let probeInFlight: Promise<boolean> | null = null

export function getQzAvailability(): QzAvailability {
  return availability
}

/** Untuk pengujian & pemulihan manual — memaksa probe berikutnya menyambung ulang. */
export function resetQzAvailability(): void {
  availability = 'unknown'
  probeInFlight = null
}

async function connectQz(): Promise<QzGlobal> {
  const qz = await withTimeout(loadQz(), CONNECT_TIMEOUT_MS, 'Gagal memuat qz-tray.js tepat waktu')
  if (!qz.websocket.isActive()) {
    await withTimeout(qz.websocket.connect(), CONNECT_TIMEOUT_MS, 'QZ Tray tidak merespons')
  }
  return qz
}

/**
 * Cek sekali apakah QZ Tray bisa dipakai, idealnya saat halaman POS dimuat sehingga
 * cetak pertama tidak menanggung ongkos koneksi. Aman dipanggil berkali-kali.
 */
export async function probeQzAvailability(): Promise<boolean> {
  if (availability !== 'unknown') return availability === 'available'
  if (probeInFlight) return probeInFlight

  probeInFlight = connectQz()
    .then(() => {
      availability = 'available'
      return true
    })
    .catch(() => {
      availability = 'unavailable'
      return false
    })
    .finally(() => {
      probeInFlight = null
    })

  return probeInFlight
}

/**
 * Kirim struk sebagai raw ESC/POS. Melempar bila QZ Tray tak terpasang/aktif atau printer
 * tak ditemukan — pemanggil WAJIB menangkapnya dan jatuh ke `window.print()` supaya struk
 * tetap bisa keluar.
 */
export async function printReceiptViaQz(data: EscposReceiptData): Promise<void> {
  // Sudah diketahui tidak ada: gagal seketika, jangan buat kasir menunggu timeout lagi.
  if (availability === 'unavailable') throw new Error('QZ Tray tidak tersedia di stasiun ini')

  try {
    const qz = await connectQz()
    const printer = getStrukPrinterName() || (await qz.printers.getDefault())
    if (!printer) throw new Error('Printer default tidak ditemukan di QZ Tray')

    const config = qz.configs.create(printer, { encoding: 'CP437' })
    await qz.print(config, [
      { type: 'raw', format: 'command', flavor: 'plain', data: buildReceiptEscpos(data) },
    ])
    availability = 'available'
  } catch (error) {
    availability = 'unavailable'
    throw error
  }
}
