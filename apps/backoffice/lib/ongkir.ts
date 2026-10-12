import Big from 'big.js'

// ── MESIN ONGKIR ────────────────────────────────────────────────────────────────────────────
// Satu-satunya tempat aturan & tampilan ongkos kirim (permintaan owner 2026-10-12, spec jasa
// grooming butir 28–38). Layar bayar, tab Grooming, server, struk (termasuk cetak ulang), dan
// laporan WAJIB lewat sini. `ongkir-guard.test.ts` gagal bila ada kode lain yang mengenali
// atau menghitung ongkir sendiri.
//
// Aturan bisnisnya:
// - Ongkir = baris nota biasa dari produk berjenis JASA_ONGKIR, harga Rp 1.000 × qty
//   (ongkir standar Rp 10.000, ada juga 8 rb / 15 rb). Satu baris per nota, wajib pengantar.
// - Gratis ongkir: nilainya SELALU ongkir standar dari Pengaturan (bukan jarak), dipotong
//   penuh di baris itu (pelanggan bayar Rp 0), pengantar tanpa bonus.
// - Struk: "Ongkos kirim 15.000"; gratis → "Ongkos kirim 10.000 / GRATIS ONGKIR -10.000" dan
//   "Anda hemat Rp 10.000" di bawah total (kalimatnya disusun mesin baris struk,
//   `lib/receipt-lines.ts`, karena digabung dengan potongan per barang).

export const ONGKIR_KIND = 'JASA_ONGKIR'
export const FREE_SHIPPING_SETTING_KEY = 'free_shipping_value'
export const DEFAULT_FREE_SHIPPING_VALUE = 10000
export const FREE_SHIPPING_VALUE_MAX = 1_000_000

export const ONGKIR_RECEIPT_LABEL = 'Ongkos kirim'
export const FREE_SHIPPING_RECEIPT_LABEL = 'GRATIS ONGKIR'

interface OngkirLike {
  productKind?: string | null
  ongkirFree?: boolean
  delivery?: { freeShipping?: boolean } | null
}

interface LineLike {
  qty: number
  unitPrice: string | number
  discountAmount: string | number
  subtotal: string | number
}

export function isOngkirKind(kind: string | null | undefined): boolean {
  return kind === ONGKIR_KIND
}

export function isOngkirItem(item: OngkirLike): boolean {
  return isOngkirKind(item.productKind)
}

export function isFreeOngkirItem(item: OngkirLike): boolean {
  return isOngkirItem(item) && (item.ongkirFree === true || item.delivery?.freeShipping === true)
}

/** Nilai pengaturan → rupiah bulat; kosong / rusak → ongkir standar bawaan. */
export function parseFreeShippingValue(raw: string | null | undefined): number {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 && n <= FREE_SHIPPING_VALUE_MAX ? n : DEFAULT_FREE_SHIPPING_VALUE
}

/** Pesan galat bila nilai standar baru tidak sah (null = sah). */
export function validateFreeShippingValue(value: number): string | null {
  if (!Number.isInteger(value) || value <= 0) return 'Nilai gratis ongkir harus angka rupiah lebih dari 0'
  if (value > FREE_SHIPPING_VALUE_MAX) return 'Nilai gratis ongkir terlalu besar'
  if (value % 1000 !== 0) return 'Nilai gratis ongkir harus kelipatan Rp 1.000 (harga ongkir per qty)'
  return null
}

/** Qty ongkir untuk nilai standar (Rp 10.000 ÷ Rp 1.000 = 10). Null bila harganya tidak membagi pas. */
export function freeShippingQty(standardValue: number, unitPrice: string | number): number | null {
  const price = Number(unitPrice)
  if (!(price > 0)) return null
  const qty = standardValue / price
  return Number.isInteger(qty) && qty > 0 ? qty : null
}

/**
 * Baris ongkir dijadikan gratis: qty = nilai standar ÷ harga, dipotong penuh (subtotal 0),
 * bertanda `ongkirFree`. Baris lain tidak disentuh. Melempar galat bila harga ongkir tidak
 * membagi nilai standar dengan pas (mis. harga ongkir diubah menjadi 3.000).
 */
export function applyFreeShipping<T extends LineLike>(item: T, standardValue: number): T & { ongkirFree: true } {
  const qty = freeShippingQty(standardValue, item.unitPrice)
  if (qty == null) {
    throw new Error(`Harga ongkir Rp ${Number(item.unitPrice).toLocaleString('id-ID')} tidak cocok dengan nilai gratis ongkir Rp ${standardValue.toLocaleString('id-ID')} — hubungi Owner`)
  }
  const gross = new Big(item.unitPrice).times(qty).round(0).toString()
  const asString = typeof item.subtotal === 'string'
  return {
    ...item,
    qty,
    discountAmount: (asString ? gross : Number(gross)) as T['discountAmount'],
    subtotal: (asString ? '0' : 0) as T['subtotal'],
    ongkirFree: true,
  }
}

/**
 * Pemeriksaan server untuk baris ongkir yang membawa data pengantaran. Null = sah.
 * `lineGross` = qty × harga; `lineTotal` = yang ditagih.
 */
export function checkOngkirLine(params: { free: boolean; lineGross: number; lineTotal: number; standardValue: number }): string | null {
  if (params.free) {
    if (params.lineTotal !== 0) return 'Gratis ongkir tidak boleh ditagih ke pelanggan'
    if (params.lineGross !== params.standardValue) {
      return `Nilai gratis ongkir sekarang Rp ${params.standardValue.toLocaleString('id-ID')}. Muat ulang halaman, lalu ulangi.`
    }
    return null
  }
  if (params.lineTotal <= 0) return 'Ongkos kirim Rp 0 harus ditandai Gratis ongkir'
  return null
}

// ── Struk ──────────────────────────────────────────────────────────────────────────────────

export interface ReceiptRow {
  label: string
  /** Rupiah; negatif untuk potongan. */
  amount: number
}

/** Penanda ongkir yang dibawa data struk (dari keranjang atau dari nota yang dicetak ulang). */
export interface ReceiptOngkirMark {
  free: boolean
}

export function receiptOngkirMark(item: OngkirLike): ReceiptOngkirMark | undefined {
  return isOngkirItem(item) ? { free: isFreeOngkirItem(item) } : undefined
}

/** Baris struk untuk satu baris ongkir: tanpa "qty SATUAN x harga" (satuan ongkir membingungkan pelanggan). */
export function ongkirReceiptRows(item: { qty: number; unitPrice: number; subtotal: number; ongkir?: ReceiptOngkirMark }): ReceiptRow[] {
  if (item.ongkir?.free) {
    const gross = Math.round(item.qty * item.unitPrice)
    return [
      { label: ONGKIR_RECEIPT_LABEL, amount: gross },
      { label: FREE_SHIPPING_RECEIPT_LABEL, amount: -gross },
    ]
  }
  return [{ label: ONGKIR_RECEIPT_LABEL, amount: item.subtotal }]
}

/** Jumlah gratis ongkir di nota — bagian ongkir dari baris "Anda hemat Rp …" (lihat `lib/receipt-lines.ts`). */
export function freeShippingSavings(items: { qty: number; unitPrice: number; ongkir?: ReceiptOngkirMark }[]): number {
  return items.reduce((sum, i) => sum + (i.ongkir?.free ? Math.round(i.qty * i.unitPrice) : 0), 0)
}

/**
 * Field keranjang untuk mencetak ulang nota dari riwayat: jenis produk & tanda gratis dibaca
 * dari data nota (lihat `ongkir-server.ts`), supaya struk ulang sama dengan struk pertama.
 */
export function ongkirCartFields(item: { productKind?: string | null; ongkirFree?: boolean | null }): { productKind?: string; ongkirFree?: boolean } {
  if (!isOngkirKind(item.productKind)) return {}
  return { productKind: ONGKIR_KIND, ongkirFree: item.ongkirFree === true }
}

// ── Laporan ────────────────────────────────────────────────────────────────────────────────

export interface DeliverySummaryInput {
  cancelled: boolean
  free: boolean
  /** Ongkir yang ditagih sesudah diskon nota. */
  netFee: number
  /** Nilai gratis ongkir (ditanggung toko). */
  freeValue: number
  bonus: number
}

export function summarizeDeliveries(rows: DeliverySummaryInput[]) {
  const s = { count: 0, paidCount: 0, freeCount: 0, cancelledCount: 0, netTotal: 0, freeTotal: 0, bonus: 0 }
  for (const r of rows) {
    if (r.cancelled) {
      s.cancelledCount += 1
      continue
    }
    s.count += 1
    s.bonus += r.bonus
    if (r.free) {
      s.freeCount += 1
      s.freeTotal += r.freeValue
    } else {
      s.paidCount += 1
      s.netTotal += r.netFee
    }
  }
  return s
}
