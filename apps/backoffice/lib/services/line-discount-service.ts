import { db, transactionItemDiscounts } from '../db'
import {
  DISCOUNT_KIND_MANUAL,
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
}

const toCheckLine = (item: SaleItemLike) => ({
  qty: Math.round(Number(item.qty)),
  unitPrice: Math.round(Number(item.unitPrice)),
  discountAmount: Math.round(Number(item.discountAmount)),
  subtotal: Math.round(Number(item.subtotal)),
  manualDiscount: item.manualDiscount ?? null,
  hasOtherDiscount: item.delivery?.freeShipping === true,
})

/** Dijalankan sebelum nota ditulis: satu baris tidak sah = seluruh nota ditolak. */
export function assertManualDiscounts(items: SaleItemLike[], totals: ManualDiscountTotals): void {
  const lines = items.map(toCheckLine)
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
    createdById: params.cashierId ?? null,
  })
}
