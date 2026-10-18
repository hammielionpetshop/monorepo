import { freeShippingSavings, type ReceiptOngkirMark, type ReceiptRow } from './ongkir'

// ── MESIN BARIS STRUK ───────────────────────────────────────────────────────────────────────
// Satu-satunya tempat aturan potongan di struk: potongan per barang di bawah barangnya, sisa
// diskon nota di bawah daftar barang, dan kalimat "Anda hemat". Tiga penyusun struk (printer
// kasir `escpos-receipt.ts`, cetak browser `receipt-print.tsx`, gambar `receipt-image.ts`)
// WAJIB lewat sini — struk pertama dan cetak ulang, dari kasir maupun Back Office, jadi sama.
// Baris ongkir tetap urusan mesin ongkir (`lib/ongkir.ts`); `ongkir-guard.test.ts` menjaga
// teks "Anda hemat" hanya ada di sini.
//
// Aturannya (angka di kertas harus bisa dijumlahkan dari atas ke bawah):
// - Baris "qty x harga" memuat nilai SEBELUM potongan baris; potongannya dicetak tepat di
//   bawahnya sebagai "Diskon -x". Jumlah semua angka barang = jumlah yang ditagih per barang.
// - "Subtotal / Diskon" di bawah daftar barang hanya untuk diskon NOTA (nota kasir lama,
//   diskon transaksi Penjualan Grosir). Potongan per barang tidak diulang di sana.
// - "Anda hemat Rp …" = potongan per barang + gratis ongkir.
// - Baris HADIAH GRATIS (beli X gratis Y / bundling, P4): nilai barisnya dipotong promo penuh
//   (tagihan 0) dan potongannya berlabel nama promo. Tampilannya khusus — kolom kanan "GRATIS"
//   dan nama promo di bawahnya (lewat `giftNoteRows`), bukan "nilai penuh lalu -nilai penuh" —
//   tetapi nilai penuhnya tetap ikut "Anda hemat". Dikenali `isGiftLine` dari angka + label-nya,
//   jadi struk pertama (keranjang kasir) dan cetak ulang (baris nota dari database) sama.

export const LINE_DISCOUNT_RECEIPT_LABEL = 'Diskon'

/** Teks di kolom kanan baris hadiah gratis (ganti angka "nilai penuh"). */
export const GIFT_RECEIPT_AMOUNT = 'GRATIS'

export interface ReceiptLineLike {
  qty: number
  unitPrice: number
  discountAmount: number
  /** Yang ditagih untuk baris ini, sesudah potongan baris. */
  subtotal: number
  ongkir?: ReceiptOngkirMark
  /**
   * Nama yang dicetak untuk potongan baris ini. Diisi nama promo bila potongannya dari promo
   * otomatis (P2e), supaya pelanggan tahu promo mana yang berlaku. Kosong = "Diskon" biasa
   * (diskon yang diketik kasir).
   */
  discountLabel?: string | null
}

/** Potongan per barang di baris ini. Baris ongkir selalu 0 — potongannya milik mesin ongkir. */
export function lineDiscountOf(item: ReceiptLineLike): number {
  if (item.ongkir) return 0
  const amount = Math.round(item.discountAmount)
  return amount > 0 ? amount : 0
}

/** Angka di baris "qty x harga": nilai baris sebelum potongannya. */
export function lineGrossAmount(item: ReceiptLineLike): number {
  return item.subtotal + lineDiscountOf(item)
}

/**
 * Baris hadiah gratis: barisnya dipotong promo PENUH (tagihan 0) dan potongannya berlabel nama
 * promo. Baris ongkir gratis bukan hadiah — potongannya milik mesin ongkir, bukan promo.
 */
export function isGiftLine(item: ReceiptLineLike): boolean {
  return !item.ongkir && item.subtotal <= 0 && lineDiscountOf(item) > 0 && !!item.discountLabel?.trim()
}

/**
 * Baris potongan di bawah barangnya (kosong bila barang tidak didiskon). Baris hadiah gratis tidak
 * mencetak baris "-nilai penuh" di sini — ia tampil "GRATIS" + nama promonya lewat `giftNoteRows`.
 */
export function lineDiscountRows(item: ReceiptLineLike): ReceiptRow[] {
  if (isGiftLine(item)) return []
  const amount = lineDiscountOf(item)
  if (amount <= 0) return []
  const label = item.discountLabel?.trim() || LINE_DISCOUNT_RECEIPT_LABEL
  return [{ label, amount: -amount }]
}

/** Keterangan di bawah barang hadiah gratis: nama promonya (tanpa angka). Kosong = bukan hadiah. */
export function giftNoteRows(item: ReceiptLineLike): string[] {
  return isGiftLine(item) ? [item.discountLabel!.trim()] : []
}

/**
 * Diskon nota yang dicetak sebagai "Subtotal / Diskon" di bawah daftar barang (0 = tidak
 * dicetak). Nota tanpa potongan per barang: diskon kepala nota apa adanya, persis seperti
 * dulu. Nota berpotongan per barang: hanya selisih antara jumlah baris dan total — di
 * Penjualan Grosir diskon kepala nota sudah memuat potongan barisnya, jadi tidak boleh
 * dicetak dua kali.
 */
export function receiptNoteDiscount(data: { items: ReceiptLineLike[]; discountAmount: number; grandTotal: number }): number {
  const head = data.discountAmount > 0 ? data.discountAmount : 0
  if (!data.items.some((item) => lineDiscountOf(item) > 0)) return head
  const rest = data.items.reduce((sum, item) => sum + item.subtotal, 0) - data.grandTotal
  return rest > 0 ? Math.min(rest, head) : 0
}

export interface ReceiptSavings {
  /** Jumlah potongan per barang. */
  discount: number
  /** Nilai gratis ongkir. */
  freeShipping: number
  total: number
}

/** Bahan baris "Anda hemat Rp …" di bawah total (`total` 0 = tidak dicetak). */
export function receiptSavings(items: ReceiptLineLike[]): ReceiptSavings {
  const discount = items.reduce((sum, item) => sum + lineDiscountOf(item), 0)
  const freeShipping = freeShippingSavings(items)
  return { discount, freeShipping, total: discount + freeShipping }
}

export function savingsText(savings: ReceiptSavings): string {
  const causes = [savings.discount > 0 ? 'diskon' : null, savings.freeShipping > 0 ? 'gratis ongkir' : null].filter(Boolean)
  return `Anda hemat Rp ${savings.total.toLocaleString('id-ID')} (${causes.join(' + ')})`
}
