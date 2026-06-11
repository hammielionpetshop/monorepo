import Big from 'big.js'
import { db, eq, and, desc, asc, sql, productStocks, productStockBatches, auditLogs, stockAdjustments, productUomCosts } from './db'
import { StockService } from './services/stock-service'

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
  costPricePerUnit?: number // HPP per unit (wajib saat penambahan stok)
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
    let costPrice = item.costPricePerUnit
    if (costPrice === undefined) {
      const [defaultCost] = await tx
        .select({ costPrice: productUomCosts.costPrice })
        .from(productUomCosts)
        .where(
          and(
            eq(productUomCosts.productId, item.productId),
            eq(productUomCosts.branchId, item.branchId),
            eq(productUomCosts.uomId, item.uomId)
          )
        )
        .limit(1)

      costPrice = defaultCost?.costPrice ?? 0
    }

    // Selalu buat batch baru agar FIFO cost tracking akurat
    await tx.insert(productStockBatches).values({
      productId: item.productId,
      branchId: item.branchId,
      uomId: item.uomId,
      qtyReceived: Math.round(delta.toNumber()),
      qtyRemaining: Math.round(delta.toNumber()),
      costPrice,
    })

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
        qty: Math.round(delta.toNumber()),
      })
    }
  }

  // Catat di stockAdjustments (immutable record)
  await tx.insert(stockAdjustments).values({
    productId: item.productId,
    branchId: item.branchId,
    adjustedById: item.adjustedById,
    previousQty: Math.round(new Big(item.previousQty).toNumber()),
    newQty: Math.round(new Big(item.newQty).toNumber()),
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
    // Kurangi stok via StockService — konversi ke base UOM ditangani di dalam
    await StockService.deductStock(
      tx,
      item.branchId,
      item.productId,
      item.uomId,
      variance.abs().toNumber()
    );
  } else {
    // Tambah stok via StockService — costPrice 0 karena ini koreksi opname, bukan pembelian
    await StockService.addStock(
      tx,
      item.branchId,
      item.productId,
      item.uomId,
      variance.toString(),
      '0',
      undefined,
      undefined,
      { useDefaultUomCost: true },
    );
  }

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
