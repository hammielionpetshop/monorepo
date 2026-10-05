// Dokumen Purchase Order untuk dikirim ke supplier (foto/PDF) sebagai grid teks monospace per
// halaman A4. SENGAJA tanpa harga satuan & subtotal: harga beli adalah urusan internal —
// supplier mengirim faktur dengan harganya sendiri, lalu admin mencocokkannya di sistem.

import { formatDateTime } from '@petshop/shared'
import { paginateItems, wrapLabeled, type DeliveryNoteLine } from '@/lib/delivery-note-layout'

export type PoDocumentItem = {
  productName: string
  productSku: string | null
  uomCode: string
  qtyOrdered: number
}

export type PoDocumentData = {
  poNumber: string
  /** Tanggal PO, sudah diformat. */
  poDate: string
  supplierName: string
  supplierPhone?: string | null
  branchName: string
  /** Target tanggal terima, sudah diformat; null = tidak ditentukan. */
  targetDate?: string | null
  notes?: string | null
  items: PoDocumentItem[]
  printedAt?: Date | string
}

export type PoDocumentPage = DeliveryNoteLine[]

/** Lebar isi (kolom) halaman A4 portrait. */
export const PO_DOC_WIDTH = 80
/** Baris per halaman A4. */
export const PO_DOC_LINES = 54

const STORE_LABEL = 'HAMMIELION'
const NOTES_MAX_LINES = 3
const SIGN_SPACE_LINES = 3

const fmt = (n: number) => n.toLocaleString('id-ID')

function padEnd(text: string, width: number) {
  const s = text ?? ''
  return (s.length > width ? s.slice(0, width) : s).padEnd(width)
}

function padStart(text: string, width: number) {
  const s = text ?? ''
  return (s.length > width ? s.slice(0, width) : s).padStart(width)
}

function center(text: string, width: number) {
  const t = text.length > width ? text.slice(0, width) : text
  const left = Math.floor((width - t.length) / 2)
  return ' '.repeat(left) + t + ' '.repeat(width - t.length - left)
}

function leftRight(left: string, right: string, width: number) {
  const room = width - right.length - 1
  return padEnd(left, room) + ' ' + right
}

export function buildPoDocumentPages(data: PoDocumentData): PoDocumentPage[] {
  const width = PO_DOC_WIDTH
  const rule = '-'.repeat(width)

  const noW = Math.max(2, String(data.items.length).length)
  const qtyW = Math.max(3, ...data.items.map((i) => fmt(i.qtyOrdered).length))
  const uomW = Math.max(6, ...data.items.map((i) => (i.uomCode ?? '').length))
  const skuW = Math.min(14, Math.max(3, ...data.items.map((i) => (i.productSku ?? '').length)))
  const nameW = width - noW - skuW - qtyW - uomW - 4

  const row = (no: string, sku: string, name: string, qty: string, uom: string) =>
    [padEnd(no, noW), padEnd(sku, skuW), padEnd(name, nameW), padStart(qty, qtyW), padEnd(uom, uomW)].join(' ')

  const infoBlock: DeliveryNoteLine[] = [
    { text: leftRight(`Kepada : ${data.supplierName}`, data.supplierPhone ? `Telp: ${data.supplierPhone}` : '', width), bold: true },
    { text: padEnd(`Kirim ke: ${data.branchName}`, width) },
  ]
  if (data.targetDate) infoBlock.push({ text: padEnd(`Target terima: ${data.targetDate}`, width) })
  if (data.notes?.trim()) {
    for (const text of wrapLabeled('Catatan: ', data.notes, width, NOTES_MAX_LINES)) infoBlock.push({ text: padEnd(text, width) })
  }

  const header = (pageNo: number, totalPages: number): DeliveryNoteLine[] => {
    const pageLabel = totalPages > 1 ? `Hal ${pageNo}/${totalPages}` : ''
    const title = center('PURCHASE ORDER', width)
    return [
      { text: center(STORE_LABEL, width), bold: true },
      { text: pageLabel ? title.slice(0, width - pageLabel.length) + pageLabel : title, bold: true },
      { text: rule },
      { text: leftRight(`No. PO: ${data.poNumber}`, `Tanggal: ${data.poDate}`, width), bold: true },
      ...(pageNo === 1 ? infoBlock : [{ text: padEnd(`Kepada : ${data.supplierName}`, width) }]),
      { text: rule },
      { text: row('No', 'SKU', 'Nama Produk', 'Qty', 'Satuan'), bold: true },
      { text: rule },
    ]
  }

  const itemRows: DeliveryNoteLine[] = data.items.map((item, i) => ({
    text: row(String(i + 1), item.productSku ?? '', item.productName, fmt(item.qtyOrdered), item.uomCode),
  }))

  const half = Math.floor(width / 2)
  const lastFooter: DeliveryNoteLine[] = [
    { text: rule },
    { text: padEnd(`Jumlah: ${data.items.length} produk`, width) },
    { text: '' },
    { text: center('Dipesan oleh', half) + center('Supplier', width - half) },
  ]
  for (let i = 0; i < SIGN_SPACE_LINES; i++) lastFooter.push({ text: '' })
  lastFooter.push(
    { text: center('( ................. )', half) + center('( ................. )', width - half) },
    { text: '' },
    { text: padEnd('* Mohon konfirmasi ketersediaan & tanggal kirim.', width) },
    { text: padEnd('* Harga mengikuti faktur supplier.', width) },
    { text: padStart(`Dicetak: ${formatDateTime(data.printedAt ?? new Date())}`, width) },
  )

  const continued = (next: number): DeliveryNoteLine[] => [{ text: rule }, { text: padStart(`Bersambung ke hal. ${next} ...`, width) }]

  const firstHeader = header(1, 1).length
  const nextHeader = header(2, 2).length
  const chunks = paginateItems(itemRows, (pageIndex, isLast) =>
    PO_DOC_LINES - (pageIndex === 0 ? firstHeader : nextHeader) - (isLast ? lastFooter.length : continued(2).length),
  )

  return chunks.map((chunk, i) => {
    const isLast = i === chunks.length - 1
    return [...header(i + 1, chunks.length), ...chunk, ...(isLast ? lastFooter : continued(i + 2))]
  })
}
