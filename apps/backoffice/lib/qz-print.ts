// Cetak Surat Jalan langsung ke printer dot-matrix via QZ Tray (mode teks/ESC-P),
// bukan mode grafis browser. Jauh lebih cepat, presisi ke grid karakter, dan
// mendukung rangkap karbon. qz-tray.js di-load dari /public (vendored) sebagai
// <script> global `window.qz` — sengaja TIDAK di-import lewat bundler karena file
// itu punya cabang Node (`require('path')`) yang bikin Turbopack tersandung.
//
// Semua fungsi di sini hanya boleh dipanggil di sisi klien (event handler).

import type { DeliveryNoteItem } from '@/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-delivery-note-print'

export type DeliveryNoteData = {
  transactionNumber: string
  transactionDate: string
  branchName: string
  customerName: string
  items: DeliveryNoteItem[]
  isVoided?: boolean
  withPrice?: boolean
  grandTotal?: number
}

// ---- ESC/P (Epson-compatible) ----
const ESC = '\x1B'
const INIT = ESC + '@' // reset printer
const BOLD_ON = ESC + 'E'
const BOLD_OFF = ESC + 'F'
const CONDENSED_ON = '\x0F' // SI — ~17 cpi (untuk versi + harga agar muat)
const CONDENSED_OFF = '\x12' // DC2
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
 * Lebar kolom disesuaikan continuous form 9.5" (80 kolom); versi + harga memakai
 * condensed (~132 kolom) agar kolom harga muat.
 */
export function buildDeliveryNoteEscp(data: DeliveryNoteData): string {
  const withPrice = data.withPrice === true
  const width = withPrice ? 132 : 80
  const rule = '-'.repeat(width)

  const headerRow = withPrice
    ? cols([
        { text: 'No', width: 3 },
        { text: 'Kode', width: 14 },
        { text: 'Nama Produk', width: 65 },
        { text: 'UOM', width: 6 },
        { text: 'Qty', width: 8, align: 'r' },
        { text: 'Harga', width: 14, align: 'r' },
        { text: 'Subtotal', width: 16, align: 'r' },
      ])
    : cols([
        { text: 'No', width: 3 },
        { text: 'Kode', width: 12 },
        { text: 'Nama Produk', width: 47 },
        { text: 'UOM', width: 6 },
        { text: 'Qty', width: 8, align: 'r' },
      ])

  const itemRows = data.items.map((item, index) => {
    const base: Col[] = withPrice
      ? [
          { text: String(index + 1), width: 3 },
          { text: item.productCode, width: 14 },
          { text: item.productName, width: 65 },
          { text: item.uomCode, width: 6 },
          { text: fmt(item.qty), width: 8, align: 'r' },
          { text: item.unitPrice != null ? fmt(item.unitPrice) : '-', width: 14, align: 'r' },
          { text: item.subtotal != null ? fmt(item.subtotal) : '-', width: 16, align: 'r' },
        ]
      : [
          { text: String(index + 1), width: 3 },
          { text: item.productCode, width: 12 },
          { text: item.productName, width: 47 },
          { text: item.uomCode, width: 6 },
          { text: fmt(item.qty), width: 8, align: 'r' },
        ]
    return cols(base)
  })

  const lines: string[] = []
  lines.push(BOLD_ON + center('SURAT JALAN', width) + BOLD_OFF)
  lines.push(center(data.branchName, width))
  if (data.isVoided) lines.push(BOLD_ON + center('*** BATAL / VOID ***', width) + BOLD_OFF)
  lines.push(rule)
  const dateStr = `Tanggal: ${data.transactionDate}`
  lines.push(padEnd(`No: ${data.transactionNumber}`, width - dateStr.length) + dateStr)
  lines.push(`Kepada: ${data.customerName}`)
  lines.push(rule)
  lines.push(BOLD_ON + headerRow + BOLD_OFF)
  lines.push(rule)
  lines.push(...itemRows)
  lines.push(rule)
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
  return INIT + (withPrice ? CONDENSED_ON : '') + body + (withPrice ? CONDENSED_OFF : '') + FF
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
