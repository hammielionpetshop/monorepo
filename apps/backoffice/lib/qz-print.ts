// Cetak Surat Jalan langsung ke printer dot-matrix via QZ Tray (mode teks/ESC-P),
// bukan mode grafis browser. Jauh lebih cepat, presisi ke grid karakter, dan
// mendukung rangkap karbon. qz-tray.js di-load dari /public (vendored) sebagai
// <script> global `window.qz` — sengaja TIDAK di-import lewat bundler karena file
// itu punya cabang Node (`require('path')`) yang bikin Turbopack tersandung.
//
// Semua fungsi di sini hanya boleh dipanggil di sisi klien (event handler).

import type { DeliveryNoteItem } from '@/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-delivery-note-print'
import { formatTonaseLine } from '@/lib/delivery-note-weight'

export type DeliveryNoteData = {
  transactionNumber: string
  transactionDate: string
  branchName: string
  customerName: string
  staffName?: string
  items: DeliveryNoteItem[]
  isVoided?: boolean
  withPrice?: boolean
  grandTotal?: number
}

// Label toko dicetak hardcode di header nota (bukan nama cabang).
const STORE_LABEL = 'HAMMIELION'

// ---- ESC/P (Epson-compatible) ----
const ESC = '\x1B'
const INIT = ESC + '@' // reset printer
const BOLD_ON = ESC + 'E'
const BOLD_OFF = ESC + 'F'
const PICA = ESC + 'P' // pilih 10 cpi (pica) eksplisit — jangan andalkan default printer
const CANCEL_CONDENSED = '\x12' // DC2 — pastikan condensed mati (printer narrow 80 kolom)
const FF = '\x0C' // form feed → maju ke lembar berikut
const LF = '\n'

function fmt(value: number) {
  return value.toLocaleString('id-ID')
}

function truncate(text: string, width: number) {
  const s = text ?? ''
  return s.length > width ? s.slice(0, width) : s
}

function padEnd(text: string, width: number) {
  return truncate(text, width).padEnd(width)
}

function padStart(text: string, width: number) {
  return truncate(text, width).padStart(width)
}

function center(text: string, width: number) {
  const t = truncate(text, width)
  const total = width - t.length
  const left = Math.floor(total / 2)
  return ' '.repeat(Math.max(0, left)) + t + ' '.repeat(Math.max(0, total - left))
}

type Col = { text: string; width: number; align?: 'l' | 'r' }
function cols(parts: Col[]) {
  return parts.map((p) => (p.align === 'r' ? padStart(p.text, p.width) : padEnd(p.text, p.width))).join(' ')
}

function threeCols(a: string, b: string, c: string, width: number) {
  const w = Math.floor(width / 3)
  return center(a, w) + center(b, w) + center(c, w)
}

/**
 * Bangun dokumen Surat Jalan sebagai string ESC/P siap kirim raw ke printer.
 * Lebar total dijaga 76 kolom (10 cpi) agar muat di printer dot-matrix narrow
 * 80 kolom tanpa terpotong kanan; versi + harga memakai kolom ringkas (tanpa
 * condensed karena sering di-abaikan / di-cancel printer).
 */
export function buildDeliveryNoteEscp(data: DeliveryNoteData): string {
  const withPrice = data.withPrice === true
  const width = 76
  const rule = '-'.repeat(width)

  const headerRow = withPrice
    ? cols([
        { text: 'No', width: 3 },
        { text: 'Nama Produk', width: 32 },
        { text: 'UOM', width: 5 },
        { text: 'Qty', width: 6, align: 'r' },
        { text: 'Harga', width: 12, align: 'r' },
        { text: 'Subtotal', width: 13, align: 'r' },
      ])
    : cols([
        { text: 'No', width: 3 },
        { text: 'Nama Produk', width: 56 },
        { text: 'UOM', width: 6 },
        { text: 'Qty', width: 8, align: 'r' },
      ])

  const itemRows = data.items.map((item, index) => {
    const base: Col[] = withPrice
      ? [
          { text: String(index + 1), width: 3 },
          { text: item.productName, width: 32 },
          { text: item.uomCode, width: 5 },
          { text: fmt(item.qty), width: 6, align: 'r' },
          { text: item.unitPrice != null ? fmt(item.unitPrice) : '-', width: 12, align: 'r' },
          { text: item.subtotal != null ? fmt(item.subtotal) : '-', width: 13, align: 'r' },
        ]
      : [
          { text: String(index + 1), width: 3 },
          { text: item.productName, width: 56 },
          { text: item.uomCode, width: 6 },
          { text: fmt(item.qty), width: 8, align: 'r' },
        ]
    return cols(base)
  })

  const lines: string[] = []
  lines.push(BOLD_ON + center(STORE_LABEL, width) + BOLD_OFF)
  lines.push(center('NOTA PENJUALAN', width))
  if (data.isVoided) lines.push(BOLD_ON + center('*** BATAL / VOID ***', width) + BOLD_OFF)
  lines.push(rule)
  const dateStr = `Tanggal: ${data.transactionDate}`
  lines.push(padEnd(`No: ${data.transactionNumber}`, width - dateStr.length) + dateStr)
  lines.push(`Kepada: ${data.customerName}`)
  if (data.staffName) lines.push(`Staf  : ${data.staffName}`)
  lines.push(rule)
  lines.push(BOLD_ON + headerRow + BOLD_OFF)
  lines.push(rule)
  lines.push(...itemRows)
  lines.push(rule)
  // Tonase dicetak di kedua versi (dengan & tanpa harga) — ini info serah-terima
  // barang, bukan info harga. Baris dihilangkan bila tak ada data berat sama sekali.
  const tonaseLine = formatTonaseLine(data.items)
  if (tonaseLine) {
    lines.push(padStart(tonaseLine, width))
  }
  if (withPrice && data.grandTotal != null) {
    lines.push(padStart(`TOTAL: Rp ${fmt(data.grandTotal)}`, width))
  }
  lines.push('')
  lines.push('')
  lines.push(threeCols('Disiapkan', 'Pengantar', 'Penerima', width))
  lines.push('')
  lines.push('')
  lines.push('')
  lines.push(threeCols('( ............. )', '( ............. )', '( ............. )', width))

  const body = lines.join(LF) + LF
  return INIT + PICA + CANCEL_CONDENSED + body + FF
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
