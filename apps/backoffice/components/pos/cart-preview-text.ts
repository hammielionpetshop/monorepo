import Big from 'big.js'

/**
 * Bentuk minimal satu baris preview. `CartItem` web POS sudah memenuhinya apa adanya;
 * Bulk Sale memetakan barisnya ke sini (angkanya number, jadi di-stringify dulu).
 * `subtotal` sudah dipotong diskon item.
 */
export interface PreviewItem {
  productName: string
  qty: number
  uomCode: string
  unitPrice: string
  discountAmount?: string
  subtotal: string
}

export interface CartPreviewMeta {
  storeName: string
  dateLabel: string
  customerName?: string | null
  storePhone?: string | null
  /** Sembunyikan seluruh angka harga — dipakai saat kasir hanya ingin mengirim daftar barang. */
  showPrices?: boolean
  /** Diskon nominal level transaksi (Bulk Sale), dipotong dari jumlah subtotal item. */
  transactionDiscount?: string
}

function hasDiscount(value: string | undefined): value is string {
  return value !== undefined && new Big(value).gt(0)
}

export function calcPreviewItemCount(items: PreviewItem[]): number {
  return items.reduce((acc, item) => acc + item.qty, 0)
}

export function calcPreviewGrandTotal(items: PreviewItem[], transactionDiscount?: string): string {
  const itemsTotal = items.reduce((acc, item) => acc.plus(item.subtotal), new Big(0))
  const discount = hasDiscount(transactionDiscount) ? new Big(transactionDiscount) : new Big(0)
  const total = itemsTotal.minus(discount)
  return (total.lt(0) ? new Big(0) : total).round(0).toString()
}

/** Teks qty × harga satuan, plus potongan diskon item bila ada. */
export function formatPreviewDetail(item: PreviewItem, showPrices: boolean, times = '×'): string {
  const qty = `${formatQty(item.qty)} ${item.uomCode}`
  if (!showPrices) return qty
  const disc = hasDiscount(item.discountAmount) ? ` - disc ${formatRupiahPlain(item.discountAmount)}` : ''
  return `${qty} ${times} ${formatRupiahPlain(item.unitPrice)}${disc}`
}

export function getTransactionDiscount(meta: Pick<CartPreviewMeta, 'transactionDiscount'>): string | null {
  return hasDiscount(meta.transactionDiscount) ? meta.transactionDiscount : null
}

/**
 * Rupiah tanpa `Intl`. Salinan teks dibaca di WhatsApp, bukan di browser, dan
 * `Intl.NumberFormat` menyisipkan spasi tak-putus (U+00A0) yang di sebagian
 * ponsel muncul sebagai karakter aneh saat teksnya ditempel.
 */
export function formatRupiahPlain(value: string): string {
  const rounded = new Big(value).round(0).toFixed(0)
  const negative = rounded.startsWith('-')
  const digits = negative ? rounded.slice(1) : rounded
  return `${negative ? '-' : ''}Rp ${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

export function formatQty(qty: number): string {
  return String(qty).replace('.', ',')
}

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Nama berkas untuk "Simpan PDF". Browser memakai `document.title` sebagai nama
 * bawaan di dialog Save as PDF, jadi judulnya dipinjam sebentar saat mencetak —
 * tanpa ini semua berkas tersimpan sebagai "Hammielion POS.pdf" dan kasir harus
 * mengetik ulang namanya tiap kali.
 */
export function buildPreviewFileName(opts: {
  storeName: string
  customerName?: string | null
  at: Date
}): string {
  const stamp = `${opts.at.getFullYear()}${pad(opts.at.getMonth() + 1)}${pad(opts.at.getDate())}-${pad(opts.at.getHours())}${pad(opts.at.getMinutes())}`
  return ['Rincian-Pesanan', slug(opts.storeName), opts.customerName ? slug(opts.customerName) : '', stamp]
    .filter(Boolean)
    .join('_')
}

/**
 * Isi keranjang sebagai teks siap kirim ke WhatsApp — pasangan dari tampilan
 * preview yang di-screenshot. Sebagian pelanggan reseller lebih suka teks:
 * bisa disalin ulang jadi pesanan tanpa mengetik nama produk satu per satu.
 */
export function buildCartPreviewText(items: PreviewItem[], meta: CartPreviewMeta): string {
  const showPrices = meta.showPrices !== false
  const lines: string[] = [`*${meta.storeName}*`, meta.dateLabel]

  if (meta.customerName) lines.push(`Pelanggan: ${meta.customerName}`)
  lines.push('')

  if (items.length === 0) {
    lines.push('(keranjang kosong)')
  } else {
    items.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.productName}`)
      lines.push(
        showPrices
          ? `   ${formatPreviewDetail(item, true, 'x')} = ${formatRupiahPlain(item.subtotal)}`
          : `   ${formatPreviewDetail(item, false)}`
      )
    })
    lines.push('')
    lines.push(`${items.length} produk`)
    const discount = getTransactionDiscount(meta)
    if (showPrices && discount) lines.push(`Diskon: -${formatRupiahPlain(discount)}`)
    if (showPrices) lines.push(`*TOTAL: ${formatRupiahPlain(calcPreviewGrandTotal(items, meta.transactionDiscount))}*`)
  }

  lines.push('')
  lines.push('Harga dapat berubah sewaktu-waktu.')
  if (meta.storePhone) lines.push(`Pesan: ${meta.storePhone}`)

  return lines.join('\n')
}
