import { db, eq, and, desc, asc, sql, productStocks, productStockBatches, auditLogs } from './db';


// Extract the transaction type from db
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface SOItem {
  productId: number;
  branchId: number;
  uomId: number;
  systemQty: number | string;
  physicalQty: number | string;
  currentUserId?: number;
}

export async function applySOStockAdjustment(tx: Tx, item: SOItem): Promise<void> {
  const systemQty = Number(item.systemQty);
  const physicalQty = Number(item.physicalQty);
  const variance = physicalQty - systemQty;

  if (variance === 0) return;

  if (variance < 0) {
    // Kurangi dari batch FIFO tertua
    const absVariance = Math.abs(variance);
    let remainingToDeduct = absVariance;

    const batches = await tx.select()
      .from(productStockBatches)
      .where(and(
        eq(productStockBatches.productId, item.productId),
        eq(productStockBatches.branchId, item.branchId),
        eq(productStockBatches.uomId, item.uomId),
        sql`${productStockBatches.qtyRemaining} > 0`
      ))
      .orderBy(asc(productStockBatches.receivedAt));

    for (const b of batches) {
      if (remainingToDeduct <= 0) break;
      const deduct = Math.min(Number(b.qtyRemaining), remainingToDeduct);
      
      await tx.update(productStockBatches)
        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} - ${deduct}` })
        .where(eq(productStockBatches.id, b.id));
      
      remainingToDeduct -= deduct;
    }
    
    // Update aggregate stok
    await tx.update(productStocks)
      .set({ qty: sql`${productStocks.qty} - ${absVariance}` })
      .where(and(
        eq(productStocks.productId, item.productId),
        eq(productStocks.branchId, item.branchId),
        eq(productStocks.uomId, item.uomId)
      ));

  } else {
    // Tambah ke batch terbaru (jika ada selisih lebih)
    const batches = await tx.select()
      .from(productStockBatches)
      .where(and(
        eq(productStockBatches.productId, item.productId),
        eq(productStockBatches.branchId, item.branchId),
        eq(productStockBatches.uomId, item.uomId)
      ))
      .orderBy(desc(productStockBatches.receivedAt))
      .limit(1);
    
    if (batches.length > 0) {
      await tx.update(productStockBatches)
        .set({ 
          qtyRemaining: sql`${productStockBatches.qtyRemaining} + ${variance}`,
        })
        .where(eq(productStockBatches.id, batches[0].id));
    } else {
      // Buat batch baru jika belum ada sama sekali
      await tx.insert(productStockBatches).values({
        productId: item.productId,
        branchId: item.branchId,
        uomId: item.uomId,
        qtyReceived: variance.toString(),
        qtyRemaining: variance.toString(),
        costPrice: "0",
      });
    }

    // Update aggregate stok
    const existingStock = await tx.select()
      .from(productStocks)
      .where(and(
        eq(productStocks.productId, item.productId),
        eq(productStocks.branchId, item.branchId),
        eq(productStocks.uomId, item.uomId)
      ))
      .limit(1);

    if (existingStock.length > 0) {
      await tx.update(productStocks)
        .set({ qty: sql`${productStocks.qty} + ${variance}` })
        .where(eq(productStocks.id, existingStock[0].id));
    } else {
      await tx.insert(productStocks).values({
        productId: item.productId,
        branchId: item.branchId,
        uomId: item.uomId,
        qty: variance.toString()
      });
    }
  }

  // Insert audit log
  if (item.currentUserId) {
    await tx.insert(auditLogs).values({
      branchId: item.branchId,
      userId: item.currentUserId,
      action: 'STOCK_OPNAME_ADJUSTMENT',
      tableName: 'product_stocks',
      oldData: JSON.stringify({ systemQty }),
      newData: JSON.stringify({ physicalQty, variance }),
    });
  }
}
