import {
  db,
  sql,
  eq,
  and,
  asc,
  productStocks,
  productStockBatches,
  productUomConversions,
} from '@/lib/db'
import { calculateFIFOCost } from '@petshop/shared/utils/fifo-shrinkage'

type DbOrTrx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface VarianceInput {
  productId: number
  uomId: number
  physicalQty: number
}

export interface VarianceResult {
  productId: number
  uomId: number
  systemQty: number
  physicalQty: number
  varianceQty: number
  varianceCostValue: number
}

/**
 * Hitung selisih stok untuk satu item SO tanpa menyimpan apa pun.
 * systemQty diagregasi dari seluruh UOM stok produk, dikonversi ke item.uomId.
 * varianceCostValue dihitung FIFO bila ada selisih.
 */
export async function computeItemVariance(
  executor: DbOrTrx,
  branchId: number,
  item: VarianceInput
): Promise<VarianceResult> {
  // Agregasi semua UOM stok, konversi ke item.uomId untuk systemQty akurat
  const allStocks = await executor
    .select({
      uomId: productStocks.uomId,
      qty: productStocks.qty,
      ratio: productUomConversions.ratio,
    })
    .from(productStocks)
    .leftJoin(
      productUomConversions,
      and(
        eq(productUomConversions.productId, productStocks.productId),
        eq(productUomConversions.uomId, productStocks.uomId)
      )
    )
    .where(
      and(
        eq(productStocks.productId, item.productId),
        eq(productStocks.branchId, Number(branchId))
      )
    )

  const [itemConv] = await executor
    .select({ ratio: productUomConversions.ratio })
    .from(productUomConversions)
    .where(
      and(
        eq(productUomConversions.productId, item.productId),
        eq(productUomConversions.uomId, item.uomId)
      )
    )
    .limit(1)

  const itemUomRatio = itemConv?.ratio ?? 1
  const totalBaseQty = allStocks.reduce(
    (sum: number, s: { qty: unknown; ratio: number | null }) =>
      sum + Number(s.qty) * (s.ratio ?? 1),
    0
  )
  const systemQty = Math.floor(totalBaseQty / itemUomRatio)
  const physicalQty = parseFloat(String(item.physicalQty))
  const varianceQty = physicalQty - systemQty

  let varianceCostValue = 0
  if (varianceQty !== 0) {
    const allBatches = await executor
      .select({
        id: productStockBatches.id,
        qtyRemaining: productStockBatches.qtyRemaining,
        costPrice: productStockBatches.costPrice,
        receivedAt: productStockBatches.receivedAt,
        ratio: productUomConversions.ratio,
      })
      .from(productStockBatches)
      .leftJoin(
        productUomConversions,
        and(
          eq(productUomConversions.productId, productStockBatches.productId),
          eq(productUomConversions.uomId, productStockBatches.uomId)
        )
      )
      .where(
        and(
          eq(productStockBatches.productId, item.productId),
          eq(productStockBatches.branchId, Number(branchId)),
          sql`${productStockBatches.qtyRemaining} > 0`
        )
      )
      .orderBy(asc(productStockBatches.receivedAt))

    const mappedBatches = allBatches.map(
      (b: { id: number; qtyRemaining: unknown; costPrice: unknown; ratio: number | null }) => {
        const r = b.ratio ?? 1
        return {
          id: b.id,
          qty: Number(b.qtyRemaining) * r,
          costPrice: r > 1 ? Number(b.costPrice) / r : Number(b.costPrice),
        }
      }
    )

    const varianceBase = Math.abs(varianceQty) * itemUomRatio
    const fifoResult = calculateFIFOCost(mappedBatches, varianceBase)
    varianceCostValue = Math.round(fifoResult.totalCost)
  }

  return {
    productId: item.productId,
    uomId: item.uomId,
    systemQty: Math.round(systemQty),
    physicalQty: Math.round(physicalQty),
    varianceQty: Math.round(varianceQty),
    varianceCostValue,
  }
}

/**
 * Hitung selisih untuk banyak item sekaligus.
 */
export async function computeVariance(
  executor: DbOrTrx,
  branchId: number,
  items: VarianceInput[]
): Promise<VarianceResult[]> {
  const results: VarianceResult[] = []
  for (const item of items) {
    results.push(await computeItemVariance(executor, branchId, item))
  }
  return results
}
