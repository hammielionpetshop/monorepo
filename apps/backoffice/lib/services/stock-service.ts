import Big from 'big.js';
import { db, productStocks, productStockBatches, products, productUomConversions, productUomCosts, eq, and, sql, asc } from '../db';
import { fifoDeduct } from '@petshop/shared';

export interface ProductWithStock {
  productId: number
  productName: string
  sku: string | null
  baseUomId: number
  currentQty: string  // decimal string, '0' jika tidak ada stok
}

interface AddStockOptions {
  useDefaultUomCost?: boolean
}

async function resolveInboundCostPrice(
  tx: any,
  branchId: number,
  productId: number,
  uomId: number,
  providedCostPrice: string,
  useDefaultUomCost: boolean,
): Promise<string> {
  if (!useDefaultUomCost || !new Big(providedCostPrice).eq(0)) {
    return providedCostPrice
  }

  const [defaultCost] = await tx
    .select({ costPrice: productUomCosts.costPrice })
    .from(productUomCosts)
    .where(and(
      eq(productUomCosts.productId, productId),
      eq(productUomCosts.branchId, branchId),
      eq(productUomCosts.uomId, uomId),
    ))
    .limit(1)

  return defaultCost ? String(defaultCost.costPrice) : providedCostPrice
}

export async function getProductsWithStock(branchId: number): Promise<ProductWithStock[]> {
  // Subquery: jumlahkan semua UOM row per produk di cabang ini, konversi ke base UOM
  // Base UOM tidak ada di productUomConversions → COALESCE ratio ke 1
  const stockAgg = db
    .select({
      productId: productStocks.productId,
      totalBaseQty: sql<number>`SUM(${productStocks.qty} * COALESCE(${productUomConversions.ratio}, 1))`.as('total_base_qty'),
    })
    .from(productStocks)
    .leftJoin(
      productUomConversions,
      and(
        eq(productUomConversions.productId, productStocks.productId),
        eq(productUomConversions.uomId, productStocks.uomId)
      )
    )
    .where(eq(productStocks.branchId, branchId))
    .groupBy(productStocks.productId)
    .as('stock_agg')

  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      baseUomId: products.baseUomId,
      currentQty: sql<string>`COALESCE(${stockAgg.totalBaseQty}::text, '0')`,
    })
    .from(products)
    .leftJoin(stockAgg, eq(stockAgg.productId, products.id))
    .where(eq(products.isActive, true))
    .orderBy(asc(products.name))

  return rows
}

export class StockService {
  /**
   * Deduct stock from a branch using FIFO.
   * qtyToDeduct boleh dalam UOM apapun — fungsi ini mengonversi ke base UOM secara internal.
   */
  static async deductStock(
    tx: any,
    branchId: number,
    productId: number,
    uomId: number,
    qtyToDeduct: number
  ) {
    // Resolve base UOM dan rasio konversi
    const [prod] = await tx
      .select({ baseUomId: products.baseUomId, defaultCostPrice: products.defaultCostPrice })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    const baseUomId: number = prod?.baseUomId ?? uomId
    let ratio = 1

    if (uomId !== baseUomId) {
      const [conv] = await tx
        .select({ ratio: productUomConversions.ratio })
        .from(productUomConversions)
        .where(and(
          eq(productUomConversions.productId, productId),
          eq(productUomConversions.uomId, uomId),
        ))
        .limit(1)
      ratio = conv?.ratio ?? 1
    }

    const qtyBase = Math.round(qtyToDeduct * ratio)

    // 1. Get batches sorted by received_at (tanpa filter uomId — semua batch dalam base UOM)
    const batches = await tx
      .select()
      .from(productStockBatches)
      .where(and(
        eq(productStockBatches.branchId, branchId),
        eq(productStockBatches.productId, productId),
        sql`${productStockBatches.qtyRemaining} > 0`
      ))
      .orderBy(productStockBatches.receivedAt)

    // 2. FIFO deduction dalam base UOM
    const result = fifoDeduct(
      batches.map((b: any) => ({
        batchId: b.id,
        qtyRemaining: parseFloat(b.qtyRemaining),
        costPrice: parseFloat(b.costPrice),
        receivedAt: b.receivedAt,
      })),
      qtyBase
    )

    if (!result.success) {
      throw new Error(result.error)
    }

    // Fallback HPP jika batch tidak punya harga modal
    let totalCogs = result.totalCogs
    if (totalCogs === 0 && prod?.defaultCostPrice) {
      totalCogs = new Big(prod.defaultCostPrice).times(qtyBase).toNumber()
    }

    // 3. Update batches
    for (const deduction of result.deductions) {
      await tx
        .update(productStockBatches)
        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} - ${deduction.qtyDeducted}` })
        .where(eq(productStockBatches.id, deduction.batchId))
    }

    // 4. Update aggregate — selalu row base UOM
    await tx
      .update(productStocks)
      .set({ qty: sql`${productStocks.qty} - ${qtyBase}` })
      .where(and(
        eq(productStocks.branchId, branchId),
        eq(productStocks.productId, productId),
        eq(productStocks.uomId, baseUomId)
      ))

    return { ...result, totalCogs }
  }

  /**
   * Tambah stok ke cabang — konversi ke base UOM, insert batch, update aggregate.
   * qty dan costPrice dikirim dalam uomId caller; fungsi ini mengonversi ke base UOM secara internal.
   */
  static async addStock(
    tx: any,
    branchId: number,
    productId: number,
    uomId: number,
    qty: string,
    costPrice: string,
    receivedAt?: Date,
    expiryDate?: Date | null,
    options: AddStockOptions = {},
  ): Promise<void> {
    // Resolve base UOM dan rasio konversi
    const [prod] = await tx
      .select({ baseUomId: products.baseUomId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    const baseUomId: number = prod?.baseUomId ?? uomId
    let ratio = 1

    if (uomId !== baseUomId) {
      const [conv] = await tx
        .select({ ratio: productUomConversions.ratio })
        .from(productUomConversions)
        .where(and(
          eq(productUomConversions.productId, productId),
          eq(productUomConversions.uomId, uomId),
        ))
        .limit(1)
      ratio = conv?.ratio ?? 1
    }

    const qtyBase = Math.round(new Big(qty).times(ratio).toNumber())
    const effectiveCostPrice = await resolveInboundCostPrice(
      tx,
      branchId,
      productId,
      uomId,
      costPrice,
      options.useDefaultUomCost === true,
    )
    // costPrice per unit base UOM: cost_per_uomId / ratio
    const costPriceBase = Math.round(ratio > 1
      ? new Big(effectiveCostPrice).div(ratio).toNumber()
      : new Big(effectiveCostPrice).toNumber())

    // Insert batch — uomId asli disimpan sebagai audit trail, qty dalam base UOM
    await tx.insert(productStockBatches).values({
      productId,
      branchId,
      uomId,
      qtyReceived: qtyBase,
      qtyRemaining: qtyBase,
      costPrice: costPriceBase,
      receivedAt: receivedAt ?? new Date(),
      expiryDate: expiryDate ?? null,
    })

    // Upsert aggregate — selalu ke row base UOM
    const [existing] = await tx
      .select({ id: productStocks.id })
      .from(productStocks)
      .where(and(
        eq(productStocks.productId, productId),
        eq(productStocks.branchId, branchId),
        eq(productStocks.uomId, baseUomId),
      ))
      .limit(1)

    if (existing) {
      await tx
        .update(productStocks)
        .set({ qty: sql`${productStocks.qty} + ${qtyBase}` })
        .where(eq(productStocks.id, existing.id))
    } else {
      await tx.insert(productStocks).values({ productId, branchId, uomId: baseUomId, qty: qtyBase })
    }
  }
}
