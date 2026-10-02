import { sql } from '../db'
import type { Tx } from '../stock-adjustment'

export async function lockProductStocks(tx: Tx, branchId: number, productIds: number[]): Promise<void> {
  await lockStockPairs(tx, productIds.map(productId => ({ branchId, productId })))
}

export async function lockStockPairs(tx: Tx, pairs: { branchId: number; productId: number }[]): Promise<void> {
  const unique = new Map(pairs.map(pair => [`${pair.branchId}:${pair.productId}`, pair]))
  const sorted = [...unique.values()].sort((a, b) => a.branchId - b.branchId || a.productId - b.productId)
  for (const { branchId, productId } of sorted) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('stock:' || ${branchId} || ':' || ${productId}))`)
  }
}
