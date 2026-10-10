import { getTableName, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { purchaseOrderItems } from '@/lib/db'

/** Kondisi SQL "harga belum ada" per baris item PO — padanan `isPricePending`. */
export const pricePendingSql = sql`(
  (${purchaseOrderItems.invoiceUnitCost} IS NOT NULL AND ${purchaseOrderItems.invoiceUnitCost} <= 0)
  OR (${purchaseOrderItems.invoiceUnitCost} IS NULL AND ${purchaseOrderItems.unitCost} <= 0)
)`

/**
 * Jumlah item PO yang barangnya sudah masuk (qty bagus > 0) tapi harganya belum ada.
 * Item yang tidak datang sama sekali tidak dihitung — tidak ada yang perlu dibayar.
 *
 * Semua kolom ditulis lengkap dengan nama tabel/alias: pada query satu tabel drizzle membuang
 * nama tabel, sehingga `po_id = id` di subquery ini diam-diam membandingkan kolom tabel item
 * dengan dirinya sendiri (ketahuan saat uji alur PO di DB salinan produksi).
 */
export function pricePendingReceivedCount(poIdColumn: AnyColumn): SQL<number> {
  const outer = sql`${sql.identifier(getTableName(poIdColumn.table))}.${sql.identifier(poIdColumn.name)}`
  return sql<number>`(
    SELECT COUNT(*)::int FROM ${purchaseOrderItems} AS poi_pending
    WHERE poi_pending.po_id = ${outer}
      AND poi_pending.qty_received - poi_pending.qty_damaged > 0
      AND (
        (poi_pending.invoice_unit_cost IS NOT NULL AND poi_pending.invoice_unit_cost <= 0)
        OR (poi_pending.invoice_unit_cost IS NULL AND poi_pending.unit_cost <= 0)
      )
  )`
}
