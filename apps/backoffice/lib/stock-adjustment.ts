import Big from 'big.js'
import { db, eq, and, desc, asc, sql, productStocks, productStockBatches, auditLogs, stockAdjustments } from './db';

// Extract the transaction type from db
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ManualAdjustmentItem {
  productId: number
  branchId: number
  uomId: number         // baseUomId produk
  previousQty: string   // qty saat ini dari productStocks (decimal string)
  newQty: string        // qty baru yang diinput owner (decimal string)
  reason: string        // wajib tidak kosong
  adjustedById: number  // userId dari JWT payload
}

export async function applyManualStockAdjustment(tx: Tx, item: ManualAdjustmentItem): Promise<void> {
  const prev = new Big(item.previousQty)
  const next = new Big(item.newQty)
  const delta = next.minus(prev)

  if (next.lt(0)) {
    throw new Error('Kuantitas baru tidak boleh negatif')
  }

  if (delta.eq(0)) {
    throw new Error('Kuantitas baru sama dengan stok saat ini, tidak ada perubahan')
  }

  // WAJIB: Pessimistic lock sebelum mutasi stok
  await tx
    .select({ id: productStocks.id })
    .from(productStocks)
    .where(
      and(
        eq(productStocks.productId, item.productId),
        eq(productStocks.branchId, item.branchId),
        eq(productStocks.uomId, item.uomId)
      )
    )
    .for('update')

  const absChange = delta.abs()

  if (delta.lt(0)) {
    // Kurangi dari batch FIFO tertua
    let remaining = absChange

    const batches = await tx
      .select()
      .from(productStockBatches)
      .where(
        and(
          eq(productStockBatches.productId, item.productId),
          eq(productStockBatches.branchId, item.branchId),
          sql`${productStockBatches.qtyRemaining} > 0`
        )
      )
      .orderBy(asc(productStockBatches.receivedAt))
      .for('update')

    // Validasi ketersediaan total stok di semua batch
    const totalAvailable = batches.reduce((sum, b) => sum.plus(new Big(b.qtyRemaining)), new Big(0))
    if (totalAvailable.lt(absChange)) {
      throw new Error(`Stok tidak cukup untuk dikurangi. Tersedia: ${totalAvailable.toString()}, Dibutuhkan: ${absChange.toString()}`)
    }

    for (const batch of batches) {
      if (remaining.lte(0)) break
      const batchQty = new Big(batch.qtyRemaining)
      const deduct = remaining.gt(batchQty) ? batchQty : remaining

      await tx
        .update(productStockBatches)
        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} - ${deduct.toString()}` })
        .where(eq(productStockBatches.id, batch.id))

      remaining = remaining.minus(deduct)
    }

    // Update aggregate
    await tx
      .update(productStocks)
      .set({ qty: sql`${productStocks.qty} - ${absChange.toString()}` })
      .where(
        and(
          eq(productStocks.productId, item.productId),
          eq(productStocks.branchId, item.branchId),
          eq(productStocks.uomId, item.uomId)
        )
      )
  } else {
    // Tambah ke batch terbaru
    const latestBatches = await tx
      .select()
      .from(productStockBatches)
      .where(
        and(
          eq(productStockBatches.productId, item.productId),
          eq(productStockBatches.branchId, item.branchId)
        )
      )
      .orderBy(desc(productStockBatches.receivedAt))
      .limit(1)

    if (latestBatches.length > 0) {
      await tx
        .update(productStockBatches)
        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} + ${delta.toString()}` })
        .where(eq(productStockBatches.id, latestBatches[0].id))
    } else {
      // Buat batch baru dengan costPrice = '0' (tidak ada info harga beli)
      await tx.insert(productStockBatches).values({
        productId: item.productId,
        branchId: item.branchId,
        uomId: item.uomId,
        qtyReceived: delta.toString(),
        qtyRemaining: delta.toString(),
        costPrice: '0',
      })
    }

    // Update atau buat aggregate
    const existingStocks = await tx
      .select()
      .from(productStocks)
      .where(
        and(
          eq(productStocks.productId, item.productId),
          eq(productStocks.branchId, item.branchId),
          eq(productStocks.uomId, item.uomId)
        )
      )
      .limit(1)

    if (existingStocks.length > 0) {
      await tx
        .update(productStocks)
        .set({ qty: sql`${productStocks.qty} + ${delta.toString()}` })
        .where(eq(productStocks.id, existingStocks[0].id))
    } else {
      await tx.insert(productStocks).values({
        productId: item.productId,
        branchId: item.branchId,
        uomId: item.uomId,
        qty: delta.toString(),
      })
    }
  }

  // Catat di stockAdjustments (immutable record)
  await tx.insert(stockAdjustments).values({
    productId: item.productId,
    branchId: item.branchId,
    adjustedById: item.adjustedById,
    previousQty: item.previousQty,
    newQty: item.newQty,
    reason: item.reason,
  })

  // Catat di auditLogs (immutable audit trail per arsitektur)
  await tx.insert(auditLogs).values({
    branchId: item.branchId,
    userId: item.adjustedById,
    action: 'MANUAL_STOCK_ADJUSTMENT',
    tableName: 'product_stocks',
    oldData: JSON.stringify({ qty: item.previousQty }),
    newData: JSON.stringify({ qty: item.newQty, reason: item.reason }),
  })
}

interface SOItem {
  productId: number;
  branchId: number;
  uomId: number;
  systemQty: number | string;
  physicalQty: number | string;
  currentUserId?: number;
}

export async function applySOStockAdjustment(tx: Tx, item: SOItem): Promise<void> {
  const systemQty = new Big(item.systemQty);
  const physicalQty = new Big(item.physicalQty);
  const variance = physicalQty.minus(systemQty);

  if (variance.eq(0)) return;

  if (variance.lt(0)) {
    // Kurangi dari batch FIFO tertua
    const absVariance = variance.abs();
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
      if (remainingToDeduct.lte(0)) break;
      const batchQty = new Big(b.qtyRemaining);
      const deduct = remainingToDeduct.gt(batchQty) ? batchQty : remainingToDeduct;

      await tx.update(productStockBatches)
        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} - ${deduct.toString()}` })
        .where(eq(productStockBatches.id, b.id));

      remainingToDeduct = remainingToDeduct.minus(deduct);
    }

    // Update aggregate stok
    await tx.update(productStocks)
      .set({ qty: sql`${productStocks.qty} - ${absVariance.toString()}` })
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
          qtyRemaining: sql`${productStockBatches.qtyRemaining} + ${variance.toString()}`,
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
        .set({ qty: sql`${productStocks.qty} + ${variance.toString()}` })
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
