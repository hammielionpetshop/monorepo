// Tata letak Nota/Surat Jalan dot-matrix sebagai grid karakter per halaman.
// Satu-satunya sumber layout: dipakai cetak ESC/P (qz-print.ts) DAN fallback cetak
// browser (bulk-sale-delivery-note-print.tsx), supaya isi kedua jalur tidak bisa
// berbeda lagi.
//
// Kertas: continuous form 4.75" x 5.5" (box "9.5"/2 x 11"/2" = seperempat lembar),
// condensed 17 cpi, 6 lpi → 33 baris per lembar. Area cetak di antara lajur lubang
// traktor ±3.8" ≈ 64 kolom pada 17 cpi — sama dengan nota sistem lama. Isi dijaga
// ≤ BODY_LINES agar tidak tercetak di perforasi.
//
// Lebar kolom angka (No/Qty/Satuan/Harga/Subtotal) dihitung dari isi nota itu sendiri;
// sisa lebar seluruhnya untuk Nama Produk, dan angka tidak pernah dipotong.

import { formatDateTime } from '@petshop/shared'
import { formatTonaseLine } from '@/lib/delivery-note-weight'
import { sortItemsForPrint } from '@/lib/print-item-order'

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
  /** Waktu cetak (WIB) di kanan bawah; default saat nota disusun — cetak ulang ikut waktu ulang. */
  printedAt?: Date | string
}

/**
 * `wide` = dicetak lebar ganda (ESC W 1 / GS !): tiap karakter memakan 2 kolom, jadi
 * panjang `text` baris itu maksimal setengah lebar nota.
 */
export type DeliveryNoteLine = { text: string; bold?: boolean; wide?: boolean }
export type DeliveryNotePage = DeliveryNoteLine[]

/** Lebar isi dot-matrix (kolom) pada 17 cpi — muat di antara lajur lubang traktor. */
export const NOTE_WIDTH = 64
/** Lebar isi printer termal 80mm (Font B). */
export const ROLL_WIDTH = 56
/** Batas bawah lebar Nama Produk bila kolom angka sangat lebar. */
const MIN_NAME_WIDTH = 12
/** Baris per lembar pada 6 lpi untuk kertas 5.5". */
export const PAGE_LINES = 33
/** Batas baris berisi per lembar; sisanya ruang aman di sekitar perforasi. */
export const BODY_LINES = 31

// Label toko dicetak hardcode di header nota (bukan nama cabang).
const STORE_LABEL = 'HAMMIELION'
const SIGN_SPACE_LINES = 3
const ADDRESS_MAX_LINES = 2
const CUSTOMER_NAME_MAX_LINES = 2
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

export type ItemColumnWidths = {
  no: number
  name: number
  qty: number
  uom: number
  price: number
  subtotal: number
}

const longest = (texts: string[], min: number) => texts.reduce((m, t) => Math.max(m, t.length), min)

/**
 * Lebar kolom tabel item untuk nota ini. Kolom angka selebar isi terpanjangnya (minimal
 * selebar judul kolom) sehingga tidak pernah terpotong; Nama Produk mendapat sisanya.
 */
export function itemColumnWidths(items: DeliveryNoteItem[], withPrice: boolean, width: number): ItemColumnWidths {
  const no = longest([String(items.length)], 'No'.length)
  const qty = longest(items.map((i) => fmt(i.qty)), 'Qty'.length)
  const uom = longest(items.map((i) => i.uomCode ?? ''), 'Satuan'.length)
  const price = withPrice ? longest(items.map((i) => (i.unitPrice != null ? fmt(i.unitPrice) : '-')), 'Harga'.length) : 0
  const subtotal = withPrice
    ? longest(items.map((i) => (i.subtotal != null ? fmt(i.subtotal) : '-')), 'Subtotal'.length)
    : 0
  const separators = withPrice ? 5 : 3
  const name = Math.max(MIN_NAME_WIDTH, width - no - qty - uom - price - subtotal - separators)
  return { no, name, qty, uom, price, subtotal }
}

function headerRow(w: ItemColumnWidths, withPrice: boolean) {
  const base: Col[] = [
    { text: 'No', width: w.no },
    { text: 'Nama Produk', width: w.name },
    { text: 'Qty', width: w.qty, align: 'r' },
    { text: 'Satuan', width: w.uom },
  ]
  return cols(
    withPrice
      ? [...base, { text: 'Harga', width: w.price, align: 'r' }, { text: 'Subtotal', width: w.subtotal, align: 'r' }]
      : base,
  )
}

function itemRow(item: DeliveryNoteItem, no: number, w: ItemColumnWidths, withPrice: boolean) {
  const base: Col[] = [
    { text: String(no), width: w.no },
    { text: item.productName, width: w.name },
    { text: fmt(item.qty), width: w.qty, align: 'r' },
    { text: item.uomCode, width: w.uom },
  ]
  return cols(
    withPrice
      ? [
          ...base,
          { text: item.unitPrice != null ? fmt(item.unitPrice) : '-', width: w.price, align: 'r' },
          { text: item.subtotal != null ? fmt(item.subtotal) : '-', width: w.subtotal, align: 'r' },
        ]
      : base,
  )
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

function composeDeliveryNote(source: DeliveryNoteData, width: number) {
  const data = { ...source, items: sortItemsForPrint(source.items) }
  const withPrice = data.withPrice === true
  const colWidths = itemColumnWidths(data.items, withPrice, width)
  const rule = '-'.repeat(width)

  // Nama konsumen dicetak lebar ganda supaya mudah ditangkap mata sopir/gudang.
  const wideWidth = Math.floor(width / 2)
  const customerNameLines: DeliveryNoteLine[] = wrapLabeled(
    'Kepada: ',
    data.customerName,
    wideWidth,
    CUSTOMER_NAME_MAX_LINES,
  ).map((text) => ({ text: padEnd(text, wideWidth), bold: true, wide: true }))
  const staffLine: DeliveryNoteLine[] = data.staffName ? [{ text: padEnd(`Staf  : ${data.staffName}`, width) }] : []

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
      ...customerNameLines,
      ...staffLine,
      // Blok kontak customer cukup di lembar pertama; lembar lanjutan dipadatkan.
      ...(pageNo === 1 ? customerBlock : []),
      { text: rule },
      { text: headerRow(colWidths, withPrice), bold: true },
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
  lastFooter.push({ text: padStart(`Dicetak: ${formatDateTime(data.printedAt ?? new Date())}`, width) })

  const continuedFooter = (nextPage: number): DeliveryNoteLine[] => [
    { text: rule },
    { text: padStart(`Bersambung ke hal. ${nextPage} ...`, width) },
  ]

  const itemRows = data.items.map((item, i) => ({ text: itemRow(item, i + 1, colWidths, withPrice) }))

  return { header, itemRows, lastFooter, continuedFooter }
}

/** Susun nota menjadi halaman-halaman berisi baris teks lebar tetap (dot-matrix continuous). */
export function buildDeliveryNotePages(data: DeliveryNoteData): DeliveryNotePage[] {
  const { header, itemRows, lastFooter, continuedFooter } = composeDeliveryNote(data, NOTE_WIDTH)

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
 * (Font B = 56 kolom), yang tidak punya lembar/perforasi.
 */
export function buildDeliveryNoteRoll(data: DeliveryNoteData): DeliveryNoteLine[] {
  const { header, itemRows, lastFooter } = composeDeliveryNote(data, ROLL_WIDTH)
  return [...header(1, 1), ...itemRows, ...lastFooter]
}
