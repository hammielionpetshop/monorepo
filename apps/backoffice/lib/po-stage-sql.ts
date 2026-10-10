import { sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { purchaseOrderItems } from '@/lib/db'

/** Kondisi SQL "harga belum ada" per baris item PO — padanan `isPricePending`. */
export const pricePendingSql = sql`(
  (${purchaseOrderItems.invoiceUnitCost} IS NOT NULL AND ${purchaseOrderItems.invoiceUnitCost} <= 0)
  OR (${purchaseOrderItems.invoiceUnitCost} IS NULL AND ${purchaseOrderItems.unitCost} <= 0)
)`

/**
 * Jumlah item PO yang barangnya sudah masuk (qty bagus > 0) tapi harganya belum ada.
 * Item yang tidak datang sama sekali tidak dihitung — tidak ada yang perlu dibayar.
 */
export function pricePendingReceivedCount(poIdColumn: AnyColumn): SQL<number> {
  return sql<number>`(
    SELECT COUNT(*)::int FROM ${purchaseOrderItems}
    WHERE ${purchaseOrderItems.poId} = ${poIdColumn}
      AND ${purchaseOrderItems.qtyReceived} - ${purchaseOrderItems.qtyDamaged} > 0
      AND ${pricePendingSql}
  )`
}
