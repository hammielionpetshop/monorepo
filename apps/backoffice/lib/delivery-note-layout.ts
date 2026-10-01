// Tata letak Nota/Surat Jalan dot-matrix sebagai grid karakter per halaman.
// Satu-satunya sumber layout: dipakai cetak ESC/P (qz-print.ts) DAN fallback cetak
// browser (bulk-sale-delivery-note-print.tsx), supaya isi kedua jalur tidak bisa
// berbeda lagi.
//
// Kertas: continuous form 9.5" x 5.5" (setengah lembar), 10 cpi, 6 lpi
// → 33 baris per lembar. Isi dijaga ≤ BODY_LINES agar tidak tercetak di perforasi.

import { formatTonaseLine } from '@/lib/delivery-note-weight'

export type DeliveryNoteItem = {
  id: string | number
  productCode: string
  productName: string
  uomCode: string
  qty: number
  unitPrice?: number
  subtotal?: number
  // Berat 1 unit UOM baris ini (gram) — sudah diselesaikan lewat resolveUomWeightGram.
  // null/undefined = produk belum punya data berat; baris itu tidak ikut dihitung tonase.
  weightGram?: number | null
}

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

export type DeliveryNoteLine = { text: string; bold?: boolean }
export type DeliveryNotePage = DeliveryNoteLine[]

/** Lebar isi (kolom) — printer narrow 80 kolom, sisakan margin agar tak terpotong kanan. */
export const NOTE_WIDTH = 76
/** Baris per lembar pada 6 lpi untuk kertas 5.5". */
export const PAGE_LINES = 33
/** Batas baris berisi per lembar; sisanya ruang aman di sekitar perforasi. */
export const BODY_LINES = 31

// Label toko dicetak hardcode di header nota (bukan nama cabang).
const STORE_LABEL = 'HAMMIELION'
const SIGN_SPACE_LINES = 3

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

/** Teks kiri & kanan dalam satu baris; teks kiri dipotong bila bertabrakan. */
function leftRight(left: string, right: string, width: number) {
  const r = truncate(right, width)
  const room = width - r.length
  if (room <= 1) return padStart(r, width)
  return padEnd(left, room - 1) + ' ' + r
}

type Col = { text: string; width: number; align?: 'l' | 'r' }
function cols(parts: Col[]) {
  return parts.map((p) => (p.align === 'r' ? padStart(p.text, p.width) : padEnd(p.text, p.width))).join(' ')
}

function threeCols(a: string, b: string, c: string, width: number) {
  const w = Math.floor(width / 3)
  return center(a, w) + center(b, w) + center(c, w)
}

function headerRow(withPrice: boolean) {
  return withPrice
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
}

function itemRow(item: DeliveryNoteItem, no: number, withPrice: boolean) {
  return withPrice
    ? cols([
        { text: String(no), width: 3 },
        { text: item.productName, width: 32 },
        { text: item.uomCode, width: 5 },
        { text: fmt(item.qty), width: 6, align: 'r' },
        { text: item.unitPrice != null ? fmt(item.unitPrice) : '-', width: 12, align: 'r' },
        { text: item.subtotal != null ? fmt(item.subtotal) : '-', width: 13, align: 'r' },
      ])
    : cols([
        { text: String(no), width: 3 },
        { text: item.productName, width: 56 },
        { text: item.uomCode, width: 6 },
        { text: fmt(item.qty), width: 8, align: 'r' },
      ])
}

/**
 * Bagi item ke halaman. Halaman tengah memuat `capFull` item; halaman terakhir
 * (yang membawa tonase/total/tanda tangan) paling banyak `capLast` item dan selalu
 * berisi minimal satu item supaya tanda tangan tidak tercetak di lembar kosong.
 */
export function paginateItems<T>(items: T[], capFull: number, capLast: number): T[][] {
  if (capFull < 1 || capLast < 1) throw new Error('Kapasitas halaman nota harus ≥ 1')
  const pages: T[][] = []
  let rest = items
  while (rest.length > capLast) {
    const take = Math.min(capFull, rest.length - 1)
    pages.push(rest.slice(0, take))
    rest = rest.slice(take)
  }
  pages.push(rest)
  return pages
}

/** Susun nota menjadi halaman-halaman berisi baris teks lebar tetap. */
export function buildDeliveryNotePages(data: DeliveryNoteData): DeliveryNotePage[] {
  const width = NOTE_WIDTH
  const withPrice = data.withPrice === true
  const rule = '-'.repeat(width)

  const header = (pageNo: number, totalPages: number): DeliveryNoteLine[] => {
    const title = center('NOTA PENJUALAN', width)
    const pageLabel = totalPages > 1 ? `Hal ${pageNo}/${totalPages}` : ''
    const lines: DeliveryNoteLine[] = [
      { text: center(STORE_LABEL, width), bold: true },
      { text: pageLabel ? title.slice(0, width - pageLabel.length) + pageLabel : title },
    ]
    if (data.isVoided) lines.push({ text: center('*** BATAL / VOID ***', width), bold: true })
    lines.push(
      { text: rule },
      { text: leftRight(`No: ${data.transactionNumber}`, `Tanggal: ${data.transactionDate}`, width) },
      {
        text: data.staffName
          ? leftRight(`Kepada: ${data.customerName}`, `Staf: ${data.staffName}`, width)
          : padEnd(`Kepada: ${data.customerName}`, width),
      },
      { text: rule },
      { text: headerRow(withPrice), bold: true },
      { text: rule },
    )
    return lines
  }

  const lastFooter: DeliveryNoteLine[] = [{ text: rule }]
  // Tonase dicetak di kedua versi (dengan & tanpa harga) — ini info serah-terima
  // barang, bukan info harga. Baris dihilangkan bila tak ada data berat sama sekali.
  const tonaseLine = formatTonaseLine(data.items)
  if (tonaseLine) lastFooter.push({ text: padStart(tonaseLine, width) })
  if (withPrice && data.grandTotal != null) {
    lastFooter.push({ text: padStart(`TOTAL: Rp ${fmt(data.grandTotal)}`, width), bold: true })
  }
  lastFooter.push({ text: '' }, { text: threeCols('Disiapkan', 'Pengantar', 'Penerima', width) })
  for (let i = 0; i < SIGN_SPACE_LINES; i++) lastFooter.push({ text: '' })
  lastFooter.push({ text: threeCols('( ............. )', '( ............. )', '( ............. )', width) })

  const continuedFooter = (nextPage: number): DeliveryNoteLine[] => [
    { text: rule },
    { text: padStart(`Bersambung ke hal. ${nextPage} ...`, width) },
  ]

  const headerLines = header(1, 1).length
  const capFull = BODY_LINES - headerLines - continuedFooter(2).length
  const capLast = BODY_LINES - headerLines - lastFooter.length

  const numbered = data.items.map((item, i) => ({ item, no: i + 1 }))
  const chunks = paginateItems(numbered, capFull, capLast)

  return chunks.map((chunk, i) => {
    const isLast = i === chunks.length - 1
    return [
      ...header(i + 1, chunks.length),
      ...chunk.map(({ item, no }) => ({ text: itemRow(item, no, withPrice) })),
      ...(isLast ? lastFooter : continuedFooter(i + 2)),
    ]
  })
}
