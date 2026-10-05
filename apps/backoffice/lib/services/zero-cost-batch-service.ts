import {
  db,
  productStockBatches,
  products,
  branches,
  unitsOfMeasure,
  productUomCosts,
  productUomConversions,
  productPrices,
  auditLogs,
  eq,
  and,
  gt,
  inArray,
  sql,
  asc,
} from '@/lib/db'
import { proposeBatchCost, type CostProposal, type UomCostRow } from '@/lib/zero-cost-batch-proposal'

export interface ZeroCostBatch {
  batchId: number
  productId: number
  productName: string
  sku: string | null
  branchId: number
  branchName: string
  qtyRemaining: number
  baseUomCode: string
  receivedAt: string
  baseSellingPrice: number | null
  proposal: CostProposal | null
}

/**
 * Batch bersisa stok yang modalnya 0, beserta usulan modal per satuan dasar.
 * `branchIds` = cabang yang boleh dilihat pemanggil ('ALL' untuk OWNER/GM).
 */
export async function listZeroCostBatches(branchIds: number[] | 'ALL', onlyBatchIds?: number[]): Promise<ZeroCostBatch[]> {
  const batches = await db
    .select({
      batchId: productStockBatches.id,
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      baseUomId: products.baseUomId,
      baseUomCode: unitsOfMeasure.code,
      defaultCostPrice: products.defaultCostPrice,
      branchId: branches.id,
      branchName: branches.name,
      qtyRemaining: productStockBatches.qtyRemaining,
      receivedAt: productStockBatches.receivedAt,
    })
    .from(productStockBatches)
    .innerJoin(products, eq(productStockBatches.productId, products.id))
    .innerJoin(branches, eq(productStockBatches.branchId, branches.id))
    .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
    .where(
      and(
        gt(productStockBatches.qtyRemaining, 0),
        eq(productStockBatches.costPrice, 0),
        branchIds === 'ALL' ? undefined : inArray(productStockBatches.branchId, branchIds),
        onlyBatchIds ? inArray(productStockBatches.id, onlyBatchIds) : undefined,
      ),
    )
    .orderBy(asc(branches.name), asc(products.name), asc(productStockBatches.id))

  if (batches.length === 0) return []
  const productIds = Array.from(new Set(batches.map((b) => b.productId)))

  // Modal per satuan di SEMUA cabang — cabang lain dipakai sebagai sumber terakhir yang ditawarkan.
  const [costRows, priceRows, otherBatchRows, branchRows] = await Promise.all([
    db
      .select({
        productId: productUomCosts.productId,
        branchId: productUomCosts.branchId,
        uomId: productUomCosts.uomId,
        uomCode: unitsOfMeasure.code,
        costPrice: productUomCosts.costPrice,
        ratio: productUomConversions.ratio,
      })
      .from(productUomCosts)
      .innerJoin(unitsOfMeasure, eq(productUomCosts.uomId, unitsOfMeasure.id))
      .leftJoin(
        productUomConversions,
        and(
          eq(productUomConversions.productId, productUomCosts.productId),
          eq(productUomConversions.uomId, productUomCosts.uomId),
        ),
      )
      .where(inArray(productUomCosts.productId, productIds)),
    db
      .select({
        productId: productPrices.productId,
        branchId: productPrices.branchId,
        uomId: productPrices.uomId,
        price: sql<number>`MAX(${productPrices.price})`,
      })
      .from(productPrices)
      .where(inArray(productPrices.productId, productIds))
      .groupBy(productPrices.productId, productPrices.branchId, productPrices.uomId),
    db
      .select({
        productId: productStockBatches.productId,
        branchId: productStockBatches.branchId,
        minCost: sql<number>`MIN(${productStockBatches.costPrice})`,
      })
      .from(productStockBatches)
      .where(and(inArray(productStockBatches.productId, productIds), gt(productStockBatches.costPrice, 0)))
      .groupBy(productStockBatches.productId, productStockBatches.branchId),
    db.select({ id: branches.id, name: branches.name }).from(branches),
  ])

  const branchNames = new Map(branchRows.map((b) => [b.id, b.name]))
  const costsByProduct = new Map<number, UomCostRow[]>()
  for (const r of costRows) {
    const list = costsByProduct.get(r.productId) ?? []
    list.push({ branchId: r.branchId, uomId: r.uomId, uomCode: r.uomCode, costPrice: Number(r.costPrice), ratio: r.ratio == null ? null : Number(r.ratio) })
    costsByProduct.set(r.productId, list)
  }
  const minBatchCost = new Map(otherBatchRows.map((r) => [`${r.productId}:${r.branchId}`, Number(r.minCost)]))

  return batches.map((b) => {
    const basePrices = priceRows.filter((p) => p.productId === b.productId && p.uomId === b.baseUomId)
    const ownPrice = basePrices.filter((p) => p.branchId === b.branchId).map((p) => Number(p.price))
    const anyPrice = basePrices.map((p) => Number(p.price))
    const baseSellingPrice = ownPrice.length ? Math.max(...ownPrice) : anyPrice.length ? Math.max(...anyPrice) : null

    return {
      batchId: b.batchId,
      productId: b.productId,
      productName: b.productName,
      sku: b.sku,
      branchId: b.branchId,
      branchName: b.branchName,
      qtyRemaining: Number(b.qtyRemaining),
      baseUomCode: b.baseUomCode ?? '?',
      receivedAt: b.receivedAt.toISOString(),
      baseSellingPrice,
      proposal: proposeBatchCost({
        branchId: b.branchId,
        baseUomId: b.baseUomId,
        defaultCostPrice: b.defaultCostPrice == null ? null : Number(b.defaultCostPrice),
        uomCosts: costsByProduct.get(b.productId) ?? [],
        branchNames,
        baseSellingPrice,
        minOtherBatchCost: minBatchCost.get(`${b.productId}:${b.branchId}`) ?? null,
      }),
    }
  })
}

/**
 * Isi modal batch terpilih dengan usulan yang DIHITUNG ULANG di server (bukan angka kiriman
 * klien), dan hanya bila batch itu masih bermodal 0 — batch yang sudah dikoreksi orang lain
 * di antara pratinjau dan penerapan dilewati, tidak ditimpa.
 */
export async function applyZeroCostBatchCosts(params: {
  batchIds: number[]
  branchIds: number[] | 'ALL'
  userId: number
}): Promise<{ updated: number; skipped: number; totalValue: number }> {
  const rows = await listZeroCostBatches(params.branchIds, params.batchIds)
  let updated = 0
  let totalValue = 0

  await db.transaction(async (trx) => {
    for (const row of rows) {
      if (!row.proposal) continue
      const changed = await trx
        .update(productStockBatches)
        .set({ costPrice: row.proposal.costPerBase })
        .where(and(eq(productStockBatches.id, row.batchId), eq(productStockBatches.costPrice, 0)))
        .returning({ id: productStockBatches.id })
      if (changed.length === 0) continue

      await trx.insert(auditLogs).values({
        branchId: row.branchId,
        userId: params.userId,
        action: 'STOCK_BATCH_FILL_ZERO_COST',
        tableName: 'product_stock_batches',
        recordId: String(row.batchId),
        oldData: JSON.stringify({ costPrice: 0 }),
        newData: JSON.stringify({
          costPrice: row.proposal.costPerBase,
          source: row.proposal.source,
          detail: row.proposal.detail,
          flags: row.proposal.flags,
        }),
      })
      updated += 1
      totalValue += row.proposal.costPerBase * row.qtyRemaining
    }
  })

  return { updated, skipped: params.batchIds.length - updated, totalValue }
}
