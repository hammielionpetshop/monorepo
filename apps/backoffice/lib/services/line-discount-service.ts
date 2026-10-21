import { db, transactionItemDiscounts, transactions, transactionItems, eq, and, inArray, sql } from '../db'
import {
  DISCOUNT_KIND_MANUAL,
  checkManualDiscountAllowed,
  checkManualDiscountLine,
  checkManualDiscountTotals,
  type ManualDiscountInput,
  type ManualDiscountTotals,
} from '../manual-discount'

// Catatan potongan per baris nota (tabel `transaction_item_discounts`) — pintu tulisnya.
// Aturannya sendiri ada di mesin `lib/manual-discount.ts`; berkas ini hanya menjalankan mesin
// itu saat nota disimpan dan mencatat hasilnya.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export class LineDiscountError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'LineDiscountError'
  }
}

interface SaleItemLike {
  qty: number | string
  unitPrice: number | string
  discountAmount: number | string
  subtotal: number | string
  manualDiscount?: ManualDiscountInput | null
  delivery?: { freeShipping?: boolean } | null
  promo?: unknown
}

const toCheckLine = (item: SaleItemLike) => ({
  qty: Math.round(Number(item.qty)),
  unitPrice: Math.round(Number(item.unitPrice)),
  discountAmount: Math.round(Number(item.discountAmount)),
  subtotal: Math.round(Number(item.subtotal)),
  manualDiscount: item.manualDiscount ?? null,
  hasOtherDiscount: item.delivery?.freeShipping === true || item.promo != null,
})

/** Dijalankan sebelum nota ditulis: satu baris tidak sah = seluruh nota ditolak. */
export function assertManualDiscounts(items: SaleItemLike[], totals: ManualDiscountTotals, nota: { internalPo: boolean }): void {
  const lines = items.map(toCheckLine)
  const notAllowed = checkManualDiscountAllowed(lines, nota)
  if (notAllowed) throw new LineDiscountError(notAllowed)
  for (const line of lines) {
    const error = checkManualDiscountLine(line)
    if (error) throw new LineDiscountError(error)
  }
  const totalsError = checkManualDiscountTotals(lines, {
    subtotal: Math.round(Number(totals.subtotal)),
    discountTotal: Math.round(Number(totals.discountTotal)),
    grandTotal: Math.round(Number(totals.grandTotal)),
  })
  if (totalsError) throw new LineDiscountError(totalsError)
}

/** Mencatat diskon manual satu baris nota (sudah lolos `assertManualDiscounts`). */
export async function recordManualDiscountInTx(tx: Tx, params: {
  transactionId: number
  transactionItemId: number
  manualDiscount?: ManualDiscountInput | null
  cashierId?: number | null
}): Promise<void> {
  const manual = params.manualDiscount
  if (!manual) return
  const note = manual.reasonNote?.trim() || null
  await tx.insert(transactionItemDiscounts).values({
    transactionId: params.transactionId,
    transactionItemId: params.transactionItemId,
    kind: DISCOUNT_KIND_MANUAL,
    amount: manual.amount,
    reasonCode: manual.reasonCode,
    reasonNote: note,
    percent: manual.percent ?? null,
    createdById: params.cashierId ?? null,
  })
}

type Reader = Pick<typeof db, 'select'>

/**
 * Jumlah potongan per barang yang tercatat, per nota — untuk "Total Diskon" shift. Diskon kepala
 * nota kasir tidak memuat potongan per barang, jadi rekap shift menjumlahkan keduanya. Baris yang
 * sudah dikeluarkan lewat Koreksi tidak dihitung; gratis ongkir bukan diskon (tidak tercatat di
 * tabel potongan).
 */
export async function recordedLineDiscountByTransaction(runner: Reader, shiftIds: number[]): Promise<Map<number, number>> {
  if (shiftIds.length === 0) return new Map()
  const rows = await runner
    .select({
      transactionId: transactionItemDiscounts.transactionId,
      amount: sql<number>`COALESCE(SUM(${transactionItemDiscounts.amount}), 0)::integer`,
    })
    .from(transactionItemDiscounts)
    .innerJoin(transactions, eq(transactions.id, transactionItemDiscounts.transactionId))
    .innerJoin(transactionItems, eq(transactionItems.id, transactionItemDiscounts.transactionItemId))
    .where(and(
      inArray(transactions.shiftId, shiftIds),
      eq(transactions.status, 'COMPLETED'),
      eq(transactionItems.isRemoved, false),
    ))
    .groupBy(transactionItemDiscounts.transactionId)
  return new Map(rows.map((r) => [r.transactionId, Number(r.amount)]))
}

/** Diskon satu nota untuk rekap shift = diskon kepala nota + potongan per barang yang tercatat. */
export function shiftDiscountOf(trx: { id: number; discountAmount: number | string }, recorded: Map<number, number>): number {
  return Number(trx.discountAmount) + (recorded.get(trx.id) ?? 0)
}

/** Id baris nota yang punya catatan potongan (diskon manual / promo) — dikunci dari Koreksi. */
export async function recordedDiscountItemIds(runner: Reader, transactionId: number): Promise<Set<number>> {
  const rows = await runner
    .select({ itemId: transactionItemDiscounts.transactionItemId })
    .from(transactionItemDiscounts)
    .where(eq(transactionItemDiscounts.transactionId, transactionId))
  return new Set(rows.map((r) => r.itemId))
}
