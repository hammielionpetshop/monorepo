import Big from 'big.js';
import { db, productStocks, productStockBatches, products, productUomConversions, productUomCosts, unitsOfMeasure, eq, and, sql, asc } from '../db';
import { fifoDeduct } from '@petshop/shared';

/**
 * Stok tidak cukup untuk dikurangi. Membawa `shortfallQty` (base UOM) agar pemanggil
 * bisa membedakan kekurangan stok dari error tak terduga tanpa mencocokkan string pesan.
 * `message` sengaja dipertahankan sama dengan versi lama demi kompatibilitas pemanggil.
 */
export class InsufficientStockError extends Error {
  constructor(
    message: string,
    readonly productId: number,
    readonly shortfallQty: number
  ) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

export interface ProductUomOption {
  uomId: number
  name: string
  ratio: number  // berapa base UOM per 1 unit UOM ini (base UOM = 1)
}

export interface ProductWithStock {
  productId: number
  productName: string
  sku: string | null
  baseUomId: number
  baseUomName: string | null  // nama satuan dasar produk (mis. "Pcs", "Kg")
  currentQty: string  // decimal string, '0' jika tidak ada stok (selalu dalam base UOM)
  uoms: ProductUomOption[]  // satuan yang tersedia: base UOM + konversi
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

interface FallbackUomCost {
  uomId: number
  costPrice: unknown
  ratio: number | null
}

// Modal per base UOM untuk fallback HPP (dipakai saat batch FIFO kosong/tanpa modal):
// prioritas cost matrix UOM dasar → cost matrix UOM besar ÷ ratio (ambil ratio terbesar
// = satuan pembelian grosir) → defaultCostPrice produk. Mengembalikan null jika tak ada sumber.
async function resolveFallbackCostPerBase(
  tx: any,
  branchId: number,
  productId: number,
  baseUomId: number,
  defaultCostPrice: unknown,
  prefetchedUomCosts?: FallbackUomCost[],
): Promise<Big | null> {
  const rows: FallbackUomCost[] = prefetchedUomCosts ?? await tx
    .select({
      uomId: productUomCosts.uomId,
      costPrice: productUomCosts.costPrice,
      ratio: productUomConversions.ratio,
    })
    .from(productUomCosts)
    .leftJoin(productUomConversions, and(
      eq(productUomConversions.productId, productUomCosts.productId),
      eq(productUomConversions.uomId, productUomCosts.uomId),
    ))
    .where(and(
      eq(productUomCosts.productId, productId),
      eq(productUomCosts.branchId, branchId),
    ))

  const validRows = rows.filter((r) => Number(r.costPrice) > 0)

  const baseRow = validRows.find((r) => r.uomId === baseUomId)
  if (baseRow) return new Big(String(baseRow.costPrice))

  const bigUomRows = validRows.filter((r) => r.uomId !== baseUomId && Number(r.ratio) > 0)
  if (bigUomRows.length > 0) {
    const best = bigUomRows.reduce((a, b) => (Number(b.ratio) > Number(a.ratio) ? b : a))
    return new Big(String(best.costPrice)).div(Number(best.ratio))
  }

  return Number(defaultCostPrice) > 0 ? new Big(String(defaultCostPrice)) : null
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
      baseUomName: unitsOfMeasure.name,
      currentQty: sql<string>`COALESCE(${stockAgg.totalBaseQty}::text, '0')`,
    })
    .from(products)
    .leftJoin(stockAgg, eq(stockAgg.productId, products.id))
    .leftJoin(unitsOfMeasure, eq(unitsOfMeasure.id, products.baseUomId))
    .where(eq(products.isActive, true))
    .orderBy(asc(products.name))

  // Ambil semua konversi UOM untuk produk aktif, lalu kelompokkan per produk
  const conversions = await db
    .select({
      productId: productUomConversions.productId,
      uomId: productUomConversions.uomId,
      name: unitsOfMeasure.name,
      ratio: productUomConversions.ratio,
    })
    .from(productUomConversions)
    .innerJoin(unitsOfMeasure, eq(unitsOfMeasure.id, productUomConversions.uomId))

  const conversionsByProduct = new Map<number, ProductUomOption[]>()
  for (const c of conversions) {
    const list = conversionsByProduct.get(c.productId) ?? []
    list.push({ uomId: c.uomId, name: c.name, ratio: c.ratio })
    conversionsByProduct.set(c.productId, list)
  }

  return rows.map((r) => ({
    ...r,
    uoms: [
      { uomId: r.baseUomId, name: r.baseUomName ?? 'Satuan dasar', ratio: 1 },
      ...(conversionsByProduct.get(r.productId) ?? []),
    ],
  }))
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
    qtyToDeduct: number,
    allowNegative = false,
    prefetched?: {
      product?: any;
      ratio?: number;
      batches?: any[];
      existingStock?: any;
      // Baris productUomCosts (cabang ini) untuk fallback HPP — array kosong = sudah
      // dicek dan memang tidak ada; undefined = belum di-prefetch (query saat dibutuhkan).
      uomCosts?: FallbackUomCost[];
      onStockCreated?: (stock: any) => void;
    }
  ) {
    // Resolve base UOM dan rasio konversi
    let prod = prefetched?.product;
    if (!prod) {
      const [p] = await tx
        .select({ baseUomId: products.baseUomId, defaultCostPrice: products.defaultCostPrice })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1)
      prod = p;
    }

    const baseUomId: number = prod?.baseUomId ?? uomId
    let ratio = 1

    if (prefetched?.ratio !== undefined) {
      ratio = prefetched.ratio;
    } else if (uomId !== baseUomId) {
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
    const batches = prefetched?.batches ?? await tx
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
      qtyBase,
      allowNegative
    )

    if (!result.success) {
      throw new InsufficientStockError(
        result.error ?? 'Stok tidak cukup.',
        productId,
        result.shortfallQty
      )
    }

    // Update in-memory batches if we are using prefetched batches
    if (prefetched?.batches) {
      for (const deduction of result.deductions) {
        const batch = prefetched.batches.find((b: any) => b.id === deduction.batchId);
        if (batch) {
          batch.qtyRemaining = String(parseFloat(batch.qtyRemaining) - deduction.qtyDeducted);
        }
      }
    }

    // Porsi qty yang melebihi stok (oversell) — tidak tertutup batch
    const shortfallQty = result.shortfallQty ?? 0
    const coveredQty = qtyBase - shortfallQty

    // HPP fallback untuk porsi tanpa batch: (a) batch tertutup tapi tanpa harga modal,
    // (b) porsi oversell/shortfall. Sumber: cost matrix (productUomCosts) → defaultCostPrice.
    let totalCogs = result.totalCogs
    const needsCostFallback = (totalCogs === 0 && coveredQty > 0) || shortfallQty > 0
    if (needsCostFallback) {
      const fallbackCost = await resolveFallbackCostPerBase(
        tx,
        branchId,
        productId,
        baseUomId,
        prod?.defaultCostPrice,
        prefetched?.uomCosts,
      )
      if (fallbackCost) {
        if (totalCogs === 0 && coveredQty > 0) {
          totalCogs = fallbackCost.times(coveredQty).toNumber()
        }
        if (shortfallQty > 0) {
          totalCogs = new Big(totalCogs).plus(fallbackCost.times(shortfallQty)).toNumber()
        }
      }
    }

    // 3. Update batches
    for (const deduction of result.deductions) {
      await tx
        .update(productStockBatches)
        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} - ${deduction.qtyDeducted}` })
        .where(eq(productStockBatches.id, deduction.batchId))
    }

    // 4. Update aggregate — selalu row base UOM. Upsert agar stok minus tetap
    //    tercatat meski row aggregate belum ada (produk belum pernah punya stok).
    let existingAgg = prefetched?.existingStock;
    if (existingAgg === undefined) {
      const [agg] = await tx
        .select({ id: productStocks.id })
        .from(productStocks)
        .where(and(
          eq(productStocks.branchId, branchId),
          eq(productStocks.productId, productId),
          eq(productStocks.uomId, baseUomId)
        ))
        .limit(1)
      existingAgg = agg;
    }

    if (existingAgg) {
      await tx
        .update(productStocks)
        .set({ qty: sql`${productStocks.qty} - ${qtyBase}` })
        .where(eq(productStocks.id, existingAgg.id))
    } else {
      const [newStock] = await tx.insert(productStocks).values({ productId, branchId, uomId: baseUomId, qty: -qtyBase }).returning();
      if (prefetched?.onStockCreated) {
        prefetched.onStockCreated(newStock);
      }
    }

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
