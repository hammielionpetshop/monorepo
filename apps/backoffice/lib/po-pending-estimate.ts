import { db, purchaseOrderItems, purchaseOrders, eq, and, inArray, sql } from '@/lib/db'
import { pricePendingSql } from './po-stage-sql'
import { loadLastCosts, lastCostKey } from './po-last-cost'

export interface PendingPriceEstimate {
  /** Jumlah barang yang sudah masuk tapi harga fakturnya belum ada. */
  pendingItems: number
  /**
   * Tambahan perkiraan di atas `supplier_payables.total_amount`. Hutang sudah memakai harga
   * rencana PO untuk barang menunggu faktur; barang yang harga rencananya juga kosong dihitung 0
   * di hutang, jadi di sini diperkirakan dari modal terakhir (harga modal lama).
   */
  extraEstimate: number
}

export async function loadPendingPriceEstimates(poIds: number[]): Promise<Map<number, PendingPriceEstimate>> {
  const result = new Map<number, PendingPriceEstimate>()
  if (poIds.length === 0) return result

  const rows = await db
    .select({
      poId: purchaseOrderItems.poId,
      branchId: purchaseOrders.branchId,
      productId: purchaseOrderItems.productId,
      uomId: purchaseOrderItems.uomId,
      qtyNet: sql<number>`(${purchaseOrderItems.qtyReceived} - ${purchaseOrderItems.qtyDamaged})::int`,
      unitCost: purchaseOrderItems.unitCost,
    })
    .from(purchaseOrderItems)
    .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderItems.poId))
    .where(and(
      inArray(purchaseOrderItems.poId, poIds),
      sql`${purchaseOrderItems.qtyReceived} - ${purchaseOrderItems.qtyDamaged} > 0`,
      pricePendingSql,
    ))

  const byBranch = new Map<number, typeof rows>()
  for (const r of rows) byBranch.set(r.branchId, [...(byBranch.get(r.branchId) ?? []), r])

  for (const [branchId, branchRows] of byBranch) {
    const lastCosts = await loadLastCosts(branchId, branchRows)
    for (const r of branchRows) {
      const cur = result.get(r.poId) ?? { pendingItems: 0, extraEstimate: 0 }
      cur.pendingItems += 1
      if (r.unitCost <= 0) {
        cur.extraEstimate += r.qtyNet * (lastCosts.get(lastCostKey(r.productId, r.uomId)) ?? 0)
      }
      result.set(r.poId, cur)
    }
  }
  return result
}
