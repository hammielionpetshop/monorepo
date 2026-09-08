import type { CartItem } from './cart-store'
import { calcGrandTotal, calcItemCount } from './cart-store'
import { formatQty, formatRupiahPlain } from './cart-preview-text'

export interface PreviewImageMeta {
  storeName: string
  storePhone: string | null
  dateLabel: string
  customerName: string | null
  showPrices: boolean
}

const WIDTH = 720
const PAD = 32
// Digambar 2× lalu diperkecil oleh penampil — hasilnya tetap tajam saat gambarnya
// di-zoom di WhatsApp, dan 1440px masih di bawah batas kompresi WhatsApp.
const SCALE = 2

const FONT_STORE = '800 26px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const FONT_META = '400 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const FONT_META_BOLD = '700 15px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const FONT_NAME = '600 16px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const FONT_DETAIL = '400 15px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const FONT_SUBTOTAL = '700 15px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const FONT_GRAND = '800 24px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const FONT_NOTE = '400 12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

const INK = '#0f172a'
const MUTED = '#64748b'
const HAIRLINE = '#e2e8f0'

const NAME_INDENT = 26
const NAME_LINE_HEIGHT = 21
const DETAIL_LINE_HEIGHT = 21
const ROW_GAP = 13

/**
 * Pemenggal baris untuk teks di canvas — canvas tidak punya pembungkus teks bawaan.
 * `measure` disuntik supaya bisa diuji tanpa DOM.
 *
 * Kata yang lebih panjang dari satu baris (nama produk tanpa spasi, mis. kode
 * varian panjang) dipotong per huruf; kalau tidak, satu kata seperti itu meluber
 * keluar gambar tanpa ada yang menahannya.
 */
export function wrapLines(
  text: string,
  maxWidth: number,
  measure: (s: string) => number
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (measure(candidate) <= maxWidth) {
      current = candidate
      continue
    }

    if (current) {
      lines.push(current)
      current = ''
    }

    if (measure(word) <= maxWidth) {
      current = word
      continue
    }

    let chunk = ''
    for (const ch of word) {
      if (chunk && measure(chunk + ch) > maxWidth) {
        lines.push(chunk)
        chunk = ch
      } else {
        chunk += ch
      }
    }
    current = chunk
  }

  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

/**
 * Isi keranjang digambar sendiri ke canvas, bukan lewat pustaka penangkap DOM.
 * Dua alasannya: tidak menambah dependensi ke bundel POS, dan Tailwind v4
 * mengeluarkan warna `oklch` yang tidak dipahami html2canvas.
 */
export async function renderCartPreviewPng(
  items: CartItem[],
  meta: PreviewImageMeta
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const contentWidth = WIDTH - PAD * 2
  const nameWidth = contentWidth - NAME_INDENT

  // Tahap 1 — ukur. Tinggi gambar baru diketahui setelah semua nama produk dipenggal.
  ctx.font = FONT_NAME
  const rows = items.map((item) => ({
    item,
    nameLines: wrapLines(item.productName, nameWidth, (s) => ctx.measureText(s).width),
  }))

  const headerHeight = 34 + (meta.storePhone ? 20 : 0)
  const metaHeight = 21 + 19 + (meta.customerName ? 20 : 0)
  const rowsHeight = rows.reduce(
    (acc, row) => acc + row.nameLines.length * NAME_LINE_HEIGHT + DETAIL_LINE_HEIGHT + ROW_GAP,
    0
  )
  const height =
    PAD +
    Math.max(headerHeight, metaHeight) +
    18 +
    (rows.length === 0 ? 40 : rowsHeight) +
    22 +
    36 +
    26 +
    PAD

  canvas.width = WIDTH * SCALE
  canvas.height = Math.ceil(height) * SCALE
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'top'

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, height)

  // Tahap 2 — gambar.
  let y = PAD

  ctx.textAlign = 'left'
  ctx.fillStyle = INK
  ctx.font = FONT_STORE
  ctx.fillText(meta.storeName, PAD, y)
  if (meta.storePhone) {
    ctx.fillStyle = MUTED
    ctx.font = FONT_META
    ctx.fillText(meta.storePhone, PAD, y + 34)
  }

  ctx.textAlign = 'right'
  ctx.fillStyle = INK
  ctx.font = FONT_META_BOLD
  ctx.fillText('Rincian Pesanan', WIDTH - PAD, y)
  ctx.fillStyle = MUTED
  ctx.font = FONT_META
  ctx.fillText(meta.dateLabel, WIDTH - PAD, y + 21)
  if (meta.customerName) {
    ctx.fillStyle = INK
    ctx.font = FONT_META_BOLD
    ctx.fillText(meta.customerName, WIDTH - PAD, y + 40)
  }

  y += Math.max(headerHeight, metaHeight)
  ctx.fillStyle = INK
  ctx.fillRect(PAD, y, contentWidth, 1.5)
  y += 18

  if (rows.length === 0) {
    ctx.textAlign = 'center'
    ctx.fillStyle = MUTED
    ctx.font = FONT_DETAIL
    ctx.fillText('Keranjang masih kosong.', WIDTH / 2, y + 8)
    y += 40
  } else {
    rows.forEach((row, idx) => {
      const { item, nameLines } = row

      ctx.textAlign = 'left'
      ctx.fillStyle = MUTED
      ctx.font = FONT_DETAIL
      ctx.fillText(`${idx + 1}.`, PAD, y + 1)

      ctx.fillStyle = INK
      ctx.font = FONT_NAME
      nameLines.forEach((line, n) => {
        ctx.fillText(line, PAD + NAME_INDENT, y + n * NAME_LINE_HEIGHT)
      })

      const detailY = y + nameLines.length * NAME_LINE_HEIGHT
      ctx.fillStyle = MUTED
      ctx.font = FONT_DETAIL
      const qtyLine = meta.showPrices
        ? `${formatQty(item.qty)} ${item.uomCode} × ${formatRupiahPlain(item.unitPrice)}`
        : `${formatQty(item.qty)} ${item.uomCode}`
      ctx.fillText(qtyLine, PAD + NAME_INDENT, detailY)

      if (meta.showPrices) {
        ctx.textAlign = 'right'
        ctx.fillStyle = INK
        ctx.font = FONT_SUBTOTAL
        ctx.fillText(formatRupiahPlain(item.subtotal), WIDTH - PAD, detailY)
      }

      y = detailY + DETAIL_LINE_HEIGHT + ROW_GAP
      if (idx < rows.length - 1) {
        ctx.fillStyle = HAIRLINE
        ctx.fillRect(PAD, y - ROW_GAP / 2, contentWidth, 1)
      }
    })
  }

  ctx.fillStyle = INK
  ctx.fillRect(PAD, y, contentWidth, 2)
  y += 22

  ctx.textAlign = 'left'
  ctx.fillStyle = MUTED
  ctx.font = FONT_DETAIL
  ctx.fillText(`${items.length} produk · ${formatQty(calcItemCount(items))} qty`, PAD, y + 8)

  if (meta.showPrices) {
    ctx.textAlign = 'right'
    ctx.fillStyle = INK
    ctx.font = FONT_GRAND
    ctx.fillText(formatRupiahPlain(calcGrandTotal(items)), WIDTH - PAD, y)
  }
  y += 36

  ctx.textAlign = 'left'
  ctx.fillStyle = MUTED
  ctx.font = FONT_NOTE
  ctx.fillText('Harga dapat berubah sewaktu-waktu.', PAD, y)

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
