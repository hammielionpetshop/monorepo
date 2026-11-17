import { buildImagePdf } from '@/lib/image-pdf'
import { wrapLines, type PreviewImageMeta } from './cart-preview-image'
import {
  calcPreviewGrandTotal,
  calcPreviewItemCount,
  formatQty,
  formatRupiahPlain,
  type PreviewItem,
} from './cart-preview-text'

// Rincian pesanan sebagai PDF A4 berhalaman — gambar PNG satu lembar jadi terlalu panjang
// untuk nota dengan banyak barang. Halaman digambar ke canvas (150 dpi) lalu dibungkus
// buildImagePdf, sama seperti PDF PO, tanpa menambah pustaka PDF.

const PAGE_W = 1240
const PAGE_H = 1754
const MARGIN = 72
const CONTENT_W = PAGE_W - MARGIN * 2
const COL_GAP = 16

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const F_STORE = `800 34px ${FONT}`
const F_TITLE = `700 22px ${FONT}`
const F_META = `400 20px ${FONT}`
const F_HEAD = `700 17px ${FONT}`
const F_ROW = `400 21px ${FONT}`
const F_ROW_BOLD = `600 21px ${FONT}`
const F_SMALL = `400 17px ${FONT}`
const F_GRAND = `800 30px ${FONT}`

const INK = '#0f172a'
const MUTED = '#64748b'
const HAIRLINE = '#e2e8f0'

const LINE_H = 28
const ROW_PAD = 14
const FIRST_HEADER_H = 130
const NEXT_HEADER_H = 70
const COL_HEADER_H = 40
const FOOTER_H = 50
const TOTALS_H = 130

interface Column {
  key: 'no' | 'name' | 'qty' | 'price' | 'subtotal'
  label: string
  width: number
  align: 'left' | 'right'
}

function columnsFor(showPrices: boolean): Column[] {
  const fixed: Column[] = showPrices
    ? [
        { key: 'no', label: 'No', width: 50, align: 'left' },
        { key: 'qty', label: 'Qty', width: 150, align: 'right' },
        { key: 'price', label: 'Harga satuan', width: 190, align: 'right' },
        { key: 'subtotal', label: 'Subtotal', width: 200, align: 'right' },
      ]
    : [
        { key: 'no', label: 'No', width: 50, align: 'left' },
        { key: 'qty', label: 'Qty', width: 200, align: 'right' },
      ]
  const nameWidth = CONTENT_W - fixed.reduce((acc, c) => acc + c.width, 0) - COL_GAP * fixed.length
  const name: Column = { key: 'name', label: 'Nama barang', width: nameWidth, align: 'left' }
  return [fixed[0], name, ...fixed.slice(1)]
}

/**
 * Bagi baris ke halaman. Halaman pertama punya kepala lebih tinggi; blok total harus muat
 * di halaman terakhir — kalau tidak, total pindah ke halaman baru sendiri.
 * Mengembalikan indeks baris per halaman (halaman terakhir boleh kosong = hanya total).
 */
export function paginateRows(
  heights: number[],
  capacity: { first: number; next: number },
  totalsHeight: number,
): number[][] {
  const pages: number[][] = [[]]
  let used = 0
  let cap = capacity.first
  heights.forEach((h, i) => {
    if (used + h > cap && pages[pages.length - 1].length > 0) {
      pages.push([])
      used = 0
      cap = capacity.next
    }
    pages[pages.length - 1].push(i)
    used += h
  })
  if (used + totalsHeight > cap) pages.push([])
  return pages
}

function failure(): Error {
  return new Error('PDF gagal dibuat di perangkat ini')
}

export async function renderCartPreviewPdf(items: PreviewItem[], meta: PreviewImageMeta): Promise<Blob> {
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) throw failure()

  const columns = columnsFor(meta.showPrices)
  const nameCol = columns.find((c) => c.key === 'name')!
  measureCtx.font = F_ROW_BOLD
  const rows = items.map((item, index) => {
    const nameLines = wrapLines(item.productName, nameCol.width, (s) => measureCtx.measureText(s).width)
    const discount = meta.showPrices && item.discountAmount && Number(item.discountAmount) > 0 ? item.discountAmount : null
    return {
      item,
      index,
      nameLines,
      discount,
      height: (nameLines.length + (discount ? 1 : 0)) * LINE_H + ROW_PAD,
    }
  })

  const bodyTop = (first: boolean) => MARGIN + (first ? FIRST_HEADER_H : NEXT_HEADER_H) + COL_HEADER_H
  const bodyBottom = PAGE_H - MARGIN - FOOTER_H
  const pages = paginateRows(
    rows.map((r) => r.height),
    { first: bodyBottom - bodyTop(true), next: bodyBottom - bodyTop(false) },
    TOTALS_H,
  )

  const transactionDiscount = meta.showPrices && meta.transactionDiscount ? meta.transactionDiscount : null
  const pdfPages = []

  for (let p = 0; p < pages.length; p++) {
    const canvas = document.createElement('canvas')
    canvas.width = PAGE_W
    canvas.height = PAGE_H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw failure()
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, PAGE_W, PAGE_H)

    const first = p === 0
    let y = MARGIN

    // Kepala halaman
    ctx.textAlign = 'left'
    ctx.fillStyle = INK
    if (first) {
      ctx.font = F_STORE
      ctx.fillText(meta.storeName, MARGIN, y)
      if (meta.storePhone) {
        ctx.font = F_META
        ctx.fillStyle = MUTED
        ctx.fillText(meta.storePhone, MARGIN, y + 46)
      }
      ctx.textAlign = 'right'
      ctx.fillStyle = INK
      ctx.font = F_TITLE
      ctx.fillText('Rincian Pesanan', PAGE_W - MARGIN, y)
      ctx.font = F_META
      ctx.fillStyle = MUTED
      ctx.fillText(meta.dateLabel, PAGE_W - MARGIN, y + 32)
      if (meta.customerName) {
        ctx.fillStyle = INK
        ctx.font = F_TITLE
        ctx.fillText(meta.customerName, PAGE_W - MARGIN, y + 62)
      }
      y += FIRST_HEADER_H
    } else {
      ctx.font = F_TITLE
      ctx.fillText(`${meta.storeName} · Rincian Pesanan (lanjutan)`, MARGIN, y)
      ctx.textAlign = 'right'
      ctx.font = F_META
      ctx.fillStyle = MUTED
      ctx.fillText([meta.customerName, meta.dateLabel].filter(Boolean).join(' · '), PAGE_W - MARGIN, y)
      y += NEXT_HEADER_H
    }

    // Kepala tabel
    ctx.fillStyle = INK
    ctx.fillRect(MARGIN, y - 10, CONTENT_W, 2)
    ctx.font = F_HEAD
    ctx.fillStyle = MUTED
    let x = MARGIN
    for (const col of columns) {
      ctx.textAlign = col.align
      ctx.fillText(col.label.toUpperCase(), col.align === 'left' ? x : x + col.width, y)
      x += col.width + COL_GAP
    }
    y += COL_HEADER_H - 8
    ctx.fillStyle = HAIRLINE
    ctx.fillRect(MARGIN, y - 4, CONTENT_W, 1)

    // Baris barang
    for (const i of pages[p]) {
      const row = rows[i]
      const top = y + ROW_PAD / 2
      x = MARGIN
      for (const col of columns) {
        const right = x + col.width
        ctx.textAlign = col.align
        ctx.fillStyle = INK
        ctx.font = F_ROW
        if (col.key === 'no') {
          ctx.fillStyle = MUTED
          ctx.fillText(`${row.index + 1}.`, x, top)
        } else if (col.key === 'name') {
          ctx.font = F_ROW_BOLD
          row.nameLines.forEach((line, n) => ctx.fillText(line, x, top + n * LINE_H))
          if (row.discount) {
            ctx.font = F_SMALL
            ctx.fillStyle = MUTED
            ctx.fillText(`disc ${formatRupiahPlain(row.discount)}`, x, top + row.nameLines.length * LINE_H + 2)
          }
        } else if (col.key === 'qty') {
          ctx.fillText(`${formatQty(row.item.qty)} ${row.item.uomCode}`, right, top)
        } else if (col.key === 'price') {
          ctx.fillText(formatRupiahPlain(row.item.unitPrice), right, top)
        } else {
          ctx.font = F_ROW_BOLD
          ctx.fillText(formatRupiahPlain(row.item.subtotal), right, top)
        }
        x += col.width + COL_GAP
      }
      y += row.height
      ctx.fillStyle = HAIRLINE
      ctx.fillRect(MARGIN, y - 1, CONTENT_W, 1)
    }

    if (items.length === 0 && first) {
      ctx.textAlign = 'center'
      ctx.fillStyle = MUTED
      ctx.font = F_ROW
      ctx.fillText('Keranjang masih kosong.', PAGE_W / 2, y + 20)
      y += 60
    }

    // Total di halaman terakhir
    if (p === pages.length - 1) {
      y += 12
      ctx.fillStyle = INK
      ctx.fillRect(MARGIN, y, CONTENT_W, 2)
      y += 18
      if (transactionDiscount) {
        ctx.textAlign = 'left'
        ctx.fillStyle = MUTED
        ctx.font = F_ROW
        ctx.fillText('Diskon', MARGIN, y)
        ctx.textAlign = 'right'
        ctx.fillStyle = INK
        ctx.font = F_ROW_BOLD
        ctx.fillText(`-${formatRupiahPlain(transactionDiscount)}`, PAGE_W - MARGIN, y)
        y += 36
      }
      ctx.textAlign = 'left'
      ctx.fillStyle = MUTED
      ctx.font = F_ROW
      ctx.fillText(`${items.length} produk · ${formatQty(calcPreviewItemCount(items))} qty`, MARGIN, y + 6)
      if (meta.showPrices) {
        ctx.textAlign = 'right'
        ctx.fillStyle = INK
        ctx.font = F_GRAND
        ctx.fillText(formatRupiahPlain(calcPreviewGrandTotal(items, transactionDiscount ?? undefined)), PAGE_W - MARGIN, y)
      }
    }

    // Kaki halaman
    ctx.textAlign = 'left'
    ctx.fillStyle = MUTED
    ctx.font = F_SMALL
    ctx.fillText('Harga dapat berubah sewaktu-waktu.', MARGIN, PAGE_H - MARGIN - 20)
    ctx.textAlign = 'right'
    ctx.fillText(`Hal. ${p + 1} / ${pages.length}`, PAGE_W - MARGIN, PAGE_H - MARGIN - 20)

    const jpeg = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(failure())), 'image/jpeg', 0.92),
    )
    pdfPages.push({ jpeg: new Uint8Array(await jpeg.arrayBuffer()), widthPx: PAGE_W, heightPx: PAGE_H })
  }

  return new Blob([buildImagePdf(pdfPages) as BlobPart], { type: 'application/pdf' })
}
