import Big from 'big.js';
import { db, productStocks, productStockBatches, products, eq, and, sql, asc } from '../db';
import { fifoDeduct } from '@petshop/shared';

export interface ProductWithStock {
  productId: number
  productName: string
  sku: string | null
  baseUomId: number
  currentQty: string  // decimal string, '0' jika tidak ada stok
}

export async function getProductsWithStock(branchId: number): Promise<ProductWithStock[]> {
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      baseUomId: products.baseUomId,
      currentQty: sql<string>`COALESCE(${productStocks.qty}, '0')`,
    })
    .from(products)
    .leftJoin(
      productStocks,
      and(
        eq(productStocks.productId, products.id),
        eq(productStocks.branchId, branchId),
        eq(productStocks.uomId, products.baseUomId)
      )
    )
    .where(eq(products.isActive, true))
    .orderBy(asc(products.name))

  return rows
}

export class StockService {
  /**
   * Deduct stock from a branch using FIFO.
   */
  static async deductStock(
    tx: any, // Drizzle transaction
    branchId: number,
    productId: number,
    uomId: number,
    qtyToDeduct: number // in Base UOM
  ) {
    // 1. Get batches sorted by received_at
    const batches = await tx
      .select()
      .from(productStockBatches)
      .where(
        and(
          eq(productStockBatches.branchId, branchId),
          eq(productStockBatches.productId, productId),
          sql`${productStockBatches.qtyRemaining} > 0`
        )
      )
      .orderBy(productStockBatches.receivedAt);

    // 2. Run FIFO deduction logic (using shared logic)
    const result = fifoDeduct(
      batches.map((b: any) => ({
        batchId: b.id,
        qtyRemaining: parseFloat(b.qtyRemaining),
        costPrice: parseFloat(b.costPrice),
        receivedAt: b.receivedAt,
      })),
      qtyToDeduct
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    // Fallback HPP: jika totalCogs 0 (batch tanpa harga modal), pakai defaultCostPrice produk
    let totalCogs = result.totalCogs
    if (totalCogs === 0) {
      const [prod] = await tx
        .select({ defaultCostPrice: products.defaultCostPrice })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1)
      if (prod?.defaultCostPrice) {
        totalCogs = new Big(prod.defaultCostPrice).times(qtyToDeduct).toNumber()
      }
    }

    // 3. Update batches in DB
    for (const deduction of result.deductions) {
      await tx
        .update(productStockBatches)
        .set({
          qtyRemaining: sql`${productStockBatches.qtyRemaining} - ${deduction.qtyDeducted}`,
        })
        .where(eq(productStockBatches.id, deduction.batchId));
    }

    // 4. Update overall stock (total qty in Base UOM)
    // Note: productStocks table currently stores qty per UOM. 
    // Usually, we only track total stock in Base UOM for convenience.
    // Let's update the base UOM record in productStocks.
    await tx
      .update(productStocks)
      .set({
        qty: sql`${productStocks.qty} - ${qtyToDeduct}`,
      })
      .where(and(
        eq(productStocks.branchId, branchId), 
        eq(productStocks.productId, productId),
        eq(productStocks.uomId, uomId) // This should be the base UOM
      ));

    return { ...result, totalCogs };
  }

  /**
   * Tambah stok ke cabang — insert batch baru dan update aggregate.
   * Digunakan oleh PO receiving dan stock reversal (retur).
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
  ): Promise<void> {
    // 1. Insert batch baru
    await tx.insert(productStockBatches).values({
      productId,
      branchId,
      uomId,
      qtyReceived: qty,
      qtyRemaining: qty,
      costPrice,
      receivedAt: receivedAt ?? new Date(),
      expiryDate: expiryDate ?? null,
    });

    // 2. Upsert aggregate productStocks
    const [existing] = await tx
      .select({ id: productStocks.id, qty: productStocks.qty })
      .from(productStocks)
      .where(
        and(
          eq(productStocks.productId, productId),
          eq(productStocks.branchId, branchId),
          eq(productStocks.uomId, uomId),
        )
      )
      .limit(1);

    if (existing) {
      await tx
        .update(productStocks)
        .set({ qty: new Big(existing.qty).plus(qty).toString() })
        .where(eq(productStocks.id, existing.id));
    } else {
      await tx.insert(productStocks).values({ productId, branchId, uomId, qty });
    }
  }
}
