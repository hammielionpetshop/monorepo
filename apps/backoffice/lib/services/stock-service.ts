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

    return result;
  }
}
