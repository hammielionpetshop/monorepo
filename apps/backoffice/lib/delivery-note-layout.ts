// Tata letak Nota/Surat Jalan dot-matrix sebagai grid karakter per halaman.
// Satu-satunya sumber layout: dipakai cetak ESC/P (qz-print.ts) DAN fallback cetak
// browser (bulk-sale-delivery-note-print.tsx), supaya isi kedua jalur tidak bisa
// berbeda lagi.
//
// Kertas: continuous form 4.75" x 5.5" (box "9.5"/2 x 11"/2" = seperempat lembar),
// 15 cpi, 6 lpi → 33 baris per lembar. Area cetak di antara lajur lubang traktor
// ±3.8" ≈ 57 kolom pada 15 cpi. Isi dijaga ≤ BODY_LINES agar tidak tercetak di perforasi.

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
  customerPhone?: string | null
  customerAddress?: string | null
  staffName?: string
  items: DeliveryNoteItem[]
  isVoided?: boolean
  withPrice?: boolean
  grandTotal?: number
}

export type DeliveryNoteLine = { text: string; bold?: boolean }
export type DeliveryNotePage = DeliveryNoteLine[]

/** Lebar isi (kolom) pada 15 cpi — sisakan margin agar tak tercetak di lajur lubang kanan. */
export const NOTE_WIDTH = 56
/** Baris per lembar pada 6 lpi untuk kertas 5.5". */
export const PAGE_LINES = 33
/** Batas baris berisi per lembar; sisanya ruang aman di sekitar perforasi. */
export const BODY_LINES = 31

// Label toko dicetak hardcode di header nota (bukan nama cabang).
const STORE_LABEL = 'HAMMIELION'
const SIGN_SPACE_LINES = 3
const ADDRESS_MAX_LINES = 2
// Catatan serah-terima di dasar lembar terakhir.
const CLOSING_NOTES = [
  '* Mohon cek jumlah & kondisi barang saat diterima.',
  '* Komplain diterima maks. 2x24 jam setelah barang tiba.',
]

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

/**
 * Bungkus teks per kata dengan label di baris pertama dan indent selebar label di
 * baris berikutnya. Kelebihan baris dipotong dengan penanda "..".
 */
export function wrapLabeled(label: string, text: string, width: number, maxLines: number): string[] {
  const indent = ' '.repeat(label.length)
  const room = width - label.length
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const piece = word.length > room ? word.slice(0, room) : word
    if (!current) current = piece
    else if (current.length + 1 + piece.length <= room) current += ' ' + piece
    else {
      lines.push(current)
      current = piece
    }
  }
  if (current) lines.push(current)
  if (lines.length > maxLines) {
    lines.length = maxLines
    const last = lines[maxLines - 1]
    lines[maxLines - 1] = (last.length + 2 > room ? last.slice(0, room - 2) : last) + '..'
  }
  return lines.map((l, i) => (i === 0 ? label : indent) + l)
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
        { text: 'Nama Produk', width: 17 },
        { text: 'Qty', width: 5, align: 'r' },
        { text: 'Satuan', width: 6 },
        { text: 'Harga', width: 9, align: 'r' },
        { text: 'Subtotal', width: 11, align: 'r' },
      ])
    : cols([
        { text: 'No', width: 3 },
        { text: 'Nama Produk', width: 37 },
        { text: 'Qty', width: 7, align: 'r' },
        { text: 'Satuan', width: 6 },
      ])
}

function itemRow(item: DeliveryNoteItem, no: number, withPrice: boolean) {
  return withPrice
    ? cols([
        { text: String(no), width: 3 },
        { text: item.productName, width: 17 },
        { text: fmt(item.qty), width: 5, align: 'r' },
        { text: item.uomCode, width: 6 },
        { text: item.unitPrice != null ? fmt(item.unitPrice) : '-', width: 9, align: 'r' },
        { text: item.subtotal != null ? fmt(item.subtotal) : '-', width: 11, align: 'r' },
      ])
    : cols([
        { text: String(no), width: 3 },
        { text: item.productName, width: 37 },
        { text: fmt(item.qty), width: 7, align: 'r' },
        { text: item.uomCode, width: 6 },
      ])
}

/**
 * Bagi item ke halaman. `capacity(pageIndex, isLast)` = jumlah item yang muat di
 * halaman itu — halaman pertama membawa blok customer, halaman terakhir membawa
 * tonase/total/tanda tangan/catatan. Halaman terakhir selalu berisi minimal satu
 * item supaya tanda tangan tidak tercetak di lembar kosong.
 */
export function paginateItems<T>(items: T[], capacity: (pageIndex: number, isLast: boolean) => number): T[][] {
  const pages: T[][] = []
  let rest = items
  for (let page = 0; ; page++) {
    const capLast = capacity(page, true)
    const capFull = capacity(page, false)
    if (capFull < 1 || capLast < 1) throw new Error('Kapasitas halaman nota harus ≥ 1')
    if (rest.length <= capLast) {
      pages.push(rest)
      return pages
    }
    const take = Math.min(capFull, rest.length - 1)
    pages.push(rest.slice(0, take))
    rest = rest.slice(take)
  }
}

function composeDeliveryNote(data: DeliveryNoteData) {
  const width = NOTE_WIDTH
  const withPrice = data.withPrice === true
  const rule = '-'.repeat(width)

  const customerBlock: DeliveryNoteLine[] = []
  if (data.customerPhone?.trim()) customerBlock.push({ text: padEnd(`Telp  : ${data.customerPhone.trim()}`, width) })
  if (data.customerAddress?.trim()) {
    for (const text of wrapLabeled('Alamat: ', data.customerAddress, width, ADDRESS_MAX_LINES)) {
      customerBlock.push({ text: padEnd(text, width) })
    }
  }

  const header = (pageNo: number, totalPages: number): DeliveryNoteLine[] => {
    // Versi dengan harga = nota penjualan; tanpa harga = surat jalan untuk sopir.
    const title = center(withPrice ? 'NOTA PENJUALAN' : 'SURAT JALAN', width)
    const pageLabel = totalPages > 1 ? `Hal ${pageNo}/${totalPages}` : ''
    const lines: DeliveryNoteLine[] = [
      { text: center(STORE_LABEL, width), bold: true },
      { text: pageLabel ? title.slice(0, width - pageLabel.length) + pageLabel : title },
    ]
    if (data.isVoided) lines.push({ text: center('*** BATAL / VOID ***', width), bold: true })
    lines.push(
      { text: rule },
      { text: leftRight(`No: ${data.transactionNumber}`, `Tgl: ${data.transactionDate}`, width) },
      {
        text: data.staffName
          ? leftRight(`Kepada: ${data.customerName}`, `Staf: ${data.staffName}`, width)
          : padEnd(`Kepada: ${data.customerName}`, width),
      },
      // Blok kontak customer cukup di lembar pertama; lembar lanjutan dipadatkan.
      ...(pageNo === 1 ? customerBlock : []),
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
  lastFooter.push({ text: '' }, ...CLOSING_NOTES.map((text) => ({ text: padEnd(text, width) })))

  const continuedFooter = (nextPage: number): DeliveryNoteLine[] => [
    { text: rule },
    { text: padStart(`Bersambung ke hal. ${nextPage} ...`, width) },
  ]

  const itemRows = data.items.map((item, i) => ({ text: itemRow(item, i + 1, withPrice) }))

  return { header, itemRows, lastFooter, continuedFooter }
}

/** Susun nota menjadi halaman-halaman berisi baris teks lebar tetap (dot-matrix continuous). */
export function buildDeliveryNotePages(data: DeliveryNoteData): DeliveryNotePage[] {
  const { header, itemRows, lastFooter, continuedFooter } = composeDeliveryNote(data)

  const firstHeaderLines = header(1, 1).length
  const nextHeaderLines = header(2, 2).length
  const capacity = (pageIndex: number, isLast: boolean) =>
    BODY_LINES -
    (pageIndex === 0 ? firstHeaderLines : nextHeaderLines) -
    (isLast ? lastFooter.length : continuedFooter(2).length)

  const chunks = paginateItems(itemRows, capacity)

  return chunks.map((chunk, i) => {
    const isLast = i === chunks.length - 1
    return [...header(i + 1, chunks.length), ...chunk, ...(isLast ? lastFooter : continuedFooter(i + 2))]
  })
}

/**
 * Nota sebagai satu gulungan tanpa pemecahan halaman — untuk printer termal 80mm
 * (Font B = 56 kolom, sama dengan NOTE_WIDTH), yang tidak punya lembar/perforasi.
 */
export function buildDeliveryNoteRoll(data: DeliveryNoteData): DeliveryNoteLine[] {
  const { header, itemRows, lastFooter } = composeDeliveryNote(data)
  return [...header(1, 1), ...itemRows, ...lastFooter]
}
