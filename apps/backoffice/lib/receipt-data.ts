// Jembatan dari props `ReceiptPrint` (layout HTML) ke data penyusun ESC/POS.
//
// Sengaja satu tempat, bukan dipetakan ulang di tiap pemanggil: jalur QZ dan jalur cetak
// browser harus selalu memperlihatkan angka yang sama. Kalau pemetaan ini tersebar di
// empat berkas, cepat atau lambat salah satunya tertinggal saat struk berubah — dan
// bedanya baru ketahuan kalau ada yang membandingkan dua lembar kertas dari stasiun
// yang berbeda.

import { formatWIB } from '@petshop/shared'
import type { CartItem } from '@/components/pos/cart-store'
import type { ReceiptPrintData } from '@/lib/qz-receipt'
import { receiptOngkirMark } from '@/lib/ongkir'

/**
 * Potongan promo satu baris untuk struk (P2e): nama promo + jumlah potongannya. Dipakai
 * mengganti "Diskon" biasa dengan nama promo dan menurunkan nilai baris. Selaras urutan `items`;
 * elemen null/absen = baris tanpa promo.
 */
export interface ReceiptItemPromo {
  name: string
  amount: number
}

export interface ReceiptSource {
  receiptNumber: string
  items: CartItem[]
  /** Potongan promo per baris (selaras urutan `items`). Absen = tidak ada promo di nota ini. */
  promos?: (ReceiptItemPromo | null)[]
  grandTotal: string
  amountPaid: string
  kembalian: string
  paymentMethodName: string
  storeName: string
  storeAddress?: string | null
  storePhone?: string | null
  transactionDate: Date
  cashierName: string
  discountAmount?: string
  customerName?: string | null
  isReprint?: boolean
  isVoided?: boolean
  payments?: { name: string; amount: string }[]
}

/** Nilai uang di seluruh POS berupa string integer rupiah; yang tak terbaca dianggap nol. */
function toNumber(value: string | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Format tanggal disamakan persis dengan `receipt-print.tsx` supaya dua jalur tidak berbeda. */
function formatReceiptDate(date: Date): string {
  return formatWIB(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Satu baris keranjang → baris struk berangka (dipakai juga oleh cetak browser). Bila baris ini
 * kena promo (P2e), potongan promo menggantikan diskon manual: nilai baris turun sebesar promo,
 * nama promo dicetak di bawah barangnya alih-alih "Diskon". Server memang menyimpan promo di
 * `discount_amount` baris, jadi cetak ulang dari database tetap menampilkan angka yang sama.
 */
export function toReceiptItem(item: CartItem, promo?: ReceiptItemPromo | null): ReceiptPrintData['items'][number] {
  if (promo) {
    const gross = toNumber(item.unitPrice) * item.qty
    return {
      productName: item.productName,
      uomCode: item.uomCode,
      qty: item.qty,
      unitPrice: toNumber(item.unitPrice),
      discountAmount: promo.amount,
      subtotal: gross - promo.amount,
      discountLabel: promo.name,
      ongkir: receiptOngkirMark(item),
    }
  }
  return {
    productName: item.productName,
    uomCode: item.uomCode,
    qty: item.qty,
    unitPrice: toNumber(item.unitPrice),
    discountAmount: toNumber(item.discountAmount),
    subtotal: toNumber(item.subtotal),
    ongkir: receiptOngkirMark(item),
  }
}

export function toReceiptPrintData(src: ReceiptSource): ReceiptPrintData {
  return {
    storeName: src.storeName,
    storeAddress: src.storeAddress ?? null,
    storePhone: src.storePhone ?? null,
    receiptNumber: src.receiptNumber,
    transactionDate: formatReceiptDate(src.transactionDate),
    cashierName: src.cashierName,
    customerName: src.customerName ?? null,
    items: src.items.map((item, index) => toReceiptItem(item, src.promos?.[index])),
    discountAmount: toNumber(src.discountAmount),
    grandTotal: toNumber(src.grandTotal),
    amountPaid: toNumber(src.amountPaid),
    change: toNumber(src.kembalian),
    paymentMethodName: src.paymentMethodName,
    payments: src.payments?.map((p) => ({ name: p.name, amount: toNumber(p.amount) })),
    isReprint: src.isReprint,
    isVoided: src.isVoided,
  }
}
