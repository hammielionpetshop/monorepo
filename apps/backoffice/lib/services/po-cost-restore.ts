import Big from 'big.js'
import { productStockBatches, auditLogs, eq, and, gt, inArray } from '@/lib/db'
import { currentCostPerBase, loadCurrentCosts, loadProductUoms } from './cost-sync-service'

type Tx = any

export interface BatchCostFixResult {
  /** Jumlah batch (sisa stok) yang HPP-nya diubah. */
  batches: number
  /** Nilai sisa stok batch PO ini sebelum/sesudah, rupiah. */
  valueBefore: number
  valueAfter: number
}

/**
 * Bagian kedua "Kembalikan Modal": HPP sisa stok dari PO ini disamakan dengan modal per satuan
 * dasar yang berlaku di cabang (sesudah modal dikembalikan), supaya nilai stok & untung sisa barang
 * memakai modal, bukan harga beli PO. Barang di `skipProductIds` (dulu belum bermodal) dibiarkan.
 * Batch yang sudah habis tidak diubah — HPP penjualan yang sudah terjadi tetap seperti saat terjual.
 */
export async function fixPoBatchCostsToModal(
  tx: Tx,
  input: { poId: number; poNumber: string; branchId: number; actorUserId: number; reason: string; skipProductIds: number[] },
): Promise<BatchCostFixResult> {
  const { poId, poNumber, branchId, actorUserId, reason, skipProductIds } = input
  const batches: { id: number; productId: number; qtyRemaining: number; costPrice: number }[] = await tx
    .select({
      id: productStockBatches.id,
      productId: productStockBatches.productId,
      qtyRemaining: productStockBatches.qtyRemaining,
      costPrice: productStockBatches.costPrice,
    })
    .from(productStockBatches)
    .where(and(
      eq(productStockBatches.purchaseOrderId, poId),
      eq(productStockBatches.branchId, branchId),
      gt(productStockBatches.qtyRemaining, 0),
    ))
    .for('update')

  const skip = new Set(skipProductIds)
  const targetByProduct = new Map<number, number | null>()
  let valueBefore = new Big(0)
  let valueAfter = new Big(0)
  const changes: { id: number; productId: number; qtyRemaining: number; oldCost: number; newCost: number }[] = []

  for (const b of batches) {
    if (!targetByProduct.has(b.productId)) {
      let target: number | null = null
      if (!skip.has(b.productId)) {
        const product = await loadProductUoms(tx, b.productId)
        if (product) {
          const costs = await loadCurrentCosts(tx, branchId, b.productId)
          target = currentCostPerBase(product.uoms, costs, product.baseUomId)
        }
      }
      targetByProduct.set(b.productId, target && target > 0 ? target : null)
    }
    const target = targetByProduct.get(b.productId) ?? null
    const newCost = target ?? b.costPrice
    valueBefore = valueBefore.plus(new Big(b.qtyRemaining).times(b.costPrice))
    valueAfter = valueAfter.plus(new Big(b.qtyRemaining).times(newCost))
    if (newCost !== b.costPrice) {
      changes.push({ id: b.id, productId: b.productId, qtyRemaining: b.qtyRemaining, oldCost: b.costPrice, newCost })
    }
  }

  const byCost = new Map<number, number[]>()
  for (const c of changes) byCost.set(c.newCost, [...(byCost.get(c.newCost) ?? []), c.id])
  for (const [cost, ids] of byCost) {
    await tx.update(productStockBatches).set({ costPrice: cost }).where(inArray(productStockBatches.id, ids))
  }

  if (changes.length > 0) {
    await tx.insert(auditLogs).values({
      branchId,
      userId: actorUserId,
      action: 'PO_RESTORE_BATCH_COST',
      tableName: 'product_stock_batches',
      recordId: String(poId),
      oldData: JSON.stringify(changes.map(c => ({ id: c.id, productId: c.productId, qtyRemaining: c.qtyRemaining, costPrice: c.oldCost }))),
      newData: JSON.stringify({ poNumber, reason, batches: changes.map(c => ({ id: c.id, costPrice: c.newCost })) }),
    })
  }

  return {
    batches: changes.length,
    valueBefore: Number(valueBefore.round(0)),
    valueAfter: Number(valueAfter.round(0)),
  }
}
