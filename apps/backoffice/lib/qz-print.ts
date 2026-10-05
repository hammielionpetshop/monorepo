// Cetak Surat Jalan langsung ke printer dot-matrix via QZ Tray (mode teks/ESC-P),
// bukan mode grafis browser. Jauh lebih cepat, presisi ke grid karakter, dan
// mendukung rangkap karbon. qz-tray.js di-load dari /public (vendored) sebagai
// <script> global `window.qz` — sengaja TIDAK di-import lewat bundler karena file
// itu punya cabang Node (`require('path')`) yang bikin Turbopack tersandung.
//
// Semua fungsi di sini hanya boleh dipanggil di sisi klien (event handler).

import {
  buildDeliveryNotePages,
  PAGE_LINES,
  type DeliveryNoteData,
  type DeliveryNoteLine,
} from '@/lib/delivery-note-layout'
import { configureQzSecurity } from '@/lib/qz-security'

export type { DeliveryNoteData } from '@/lib/delivery-note-layout'

// ---- ESC/P (Epson-compatible) ----
const ESC = '\x1B'
const INIT = ESC + '@' // reset printer
const BOLD_ON = ESC + 'E'
const BOLD_OFF = ESC + 'F'
const WIDE_ON = ESC + 'W' + '\x01'
const WIDE_OFF = ESC + 'W' + '\x00'
// Condensed 17 cpi = pica 10 cpi (ESC P) + SI — sama dengan nota sistem lama; kertas
// 4.75" muat ±64 kolom (±38 di 10 cpi).
const PICA = ESC + 'P'
const CONDENSED = '\x0F' // SI
const LINE_SPACING_1_6 = ESC + '2' // 6 lpi
// Panjang lembar dalam baris (dihitung dari spasi baris yang aktif, jadi WAJIB
// dikirim setelah ESC 2). Tanpa ini printer memakai panjang bawaannya (umumnya 11")
// dan FF melompati satu lembar 5.5" penuh. Posisi kertas saat perintah ini diterima
// menjadi top-of-form.
const PAGE_LENGTH = ESC + 'C' + String.fromCharCode(PAGE_LINES)
const FF = '\x0C' // form feed → maju ke lembar berikut
const LF = '\n'

/**
 * Bangun dokumen Surat Jalan sebagai string ESC/P siap kirim raw ke printer.
 * Kertas continuous 4.75" x 5.5"; nota panjang dipecah per lembar dengan header
 * diulang (lihat delivery-note-layout.ts). Lebar 64 kolom pada condensed 17 cpi.
 */
function escpLine(line: DeliveryNoteLine): string {
  let text = line.text
  if (line.wide) text = WIDE_ON + text + WIDE_OFF
  if (line.bold) text = BOLD_ON + text + BOLD_OFF
  return text
}

export function buildDeliveryNoteEscp(data: DeliveryNoteData): string {
  const pages = buildDeliveryNotePages(data).map((page) => page.map(escpLine).join(LF) + LF + FF)
  return INIT + PICA + CONDENSED + LINE_SPACING_1_6 + PAGE_LENGTH + pages.join('')
}

/** Pesan singkat dari error QZ Tray (qz-tray.js kadang menolak dengan string, bukan Error). */
export function describeQzError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return 'alasan tidak diketahui'
}

// ---- QZ Tray koneksi & cetak ----
const PRINTER_STORAGE_KEY = 'sj_printer_name'

export function getSjPrinterName(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(PRINTER_STORAGE_KEY)
}

export function setSjPrinterName(name: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PRINTER_STORAGE_KEY, name)
}

let qzLoadPromise: Promise<QzGlobal> | null = null

type QzGlobal = {
  websocket: { isActive: () => boolean; connect: (opts?: unknown) => Promise<void> }
  printers: { getDefault: () => Promise<string> }
  configs: { create: (printer: string, opts?: unknown) => unknown }
  print: (config: unknown, data: unknown[]) => Promise<void>
}

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

/**
 * Kirim Surat Jalan ke printer via QZ Tray (raw ESC/P). Melempar bila QZ Tray tidak
 * terpasang/aktif atau printer tak ditemukan — pemanggil sebaiknya fallback ke
 * window.print() (layout HTML dot-matrix) agar tetap bisa mencetak.
 */
export async function printDeliveryNoteViaQz(data: DeliveryNoteData): Promise<void> {
  const qz = await loadQz()
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect()
  }
  const printer = getSjPrinterName() || (await qz.printers.getDefault())
  if (!printer) throw new Error('Printer default tidak ditemukan di QZ Tray')
  const config = qz.configs.create(printer, { encoding: 'CP437' })
  const escp = buildDeliveryNoteEscp(data)
  await qz.print(config, [{ type: 'raw', format: 'command', flavor: 'plain', data: escp }])
}
