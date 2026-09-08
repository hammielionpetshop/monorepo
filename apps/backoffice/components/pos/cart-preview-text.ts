import Big from 'big.js'
import type { CartItem } from './cart-store'
import { calcGrandTotal } from './cart-store'

export interface CartPreviewMeta {
  storeName: string
  dateLabel: string
  customerName?: string | null
  storePhone?: string | null
  /** Sembunyikan seluruh angka harga — dipakai saat kasir hanya ingin mengirim daftar barang. */
  showPrices?: boolean
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
export function buildCartPreviewText(items: CartItem[], meta: CartPreviewMeta): string {
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
          ? `   ${formatQty(item.qty)} ${item.uomCode} x ${formatRupiahPlain(item.unitPrice)} = ${formatRupiahPlain(item.subtotal)}`
          : `   ${formatQty(item.qty)} ${item.uomCode}`
      )
    })
    lines.push('')
    lines.push(`${items.length} produk`)
    if (showPrices) lines.push(`*TOTAL: ${formatRupiahPlain(calcGrandTotal(items))}*`)
  }

  lines.push('')
  lines.push('Harga dapat berubah sewaktu-waktu.')
  if (meta.storePhone) lines.push(`Pesan: ${meta.storePhone}`)

  return lines.join('\n')
}
