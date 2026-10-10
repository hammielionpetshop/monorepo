import { StockConflictError } from './services/stock-validation'
import { lockProductStocks } from './services/stock-lock'
import Big from 'big.js';
import { eq } from '@petshop/db';
import {
  purchaseOrders,
  purchaseOrderItems,
  supplierPayables,
  auditLogs
} from '@petshop/db';
import { StockService } from './services/stock-service';
import { syncCostFromInbound } from './services/cost-sync-service';

export async function applyPOReceivingBatches(
  db: any,
  poId: number,
  approvedById: number
): Promise<void> {
  await db.transaction(async (tx: any) => {
    // 1. Fetch PO header
    const [po] = await tx
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, poId))
      .for('update').limit(1);

    if (!po) throw new StockConflictError('Purchase Order tidak ditemukan');
    if (po.status === 'COMPLETED') throw new StockConflictError('Penerimaan PO sudah disetujui');
    if (po.status !== 'PARTIALLY_RECEIVED') throw new StockConflictError('Status PO tidak valid untuk persetujuan penerimaan');

    // 2. Fetch PO items
    const items = await tx
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, poId));

    await lockProductStocks(tx, po.branchId, items.map((item: any) => item.productId))

    let totalPayableAmount = new Big(0);

    // 3. Process each item
    for (const item of items) {
      const qtyNet = new Big(item.qtyReceived).minus(item.qtyDamaged);
      if (qtyNet.lte(0)) continue;

      // invoiceUnitCost 0 = belum diisi, jatuh ke harga PO (bisa 0 juga bila harga menyusul).
      const costPrice = new Big(item.invoiceUnitCost || item.unitCost);
      const pricePending = costPrice.lte(0);
      totalPayableAmount = totalPayableAmount.plus(qtyNet.times(costPrice));

      // settleShortfalls: true — barang genuinely baru dari luar perusahaan (penerimaan PO dari
      // supplier), jadi qty yang masuk melunasi shortfall terbuka produk ini dulu (FIFO) sebelum
      // sisanya dianggap stok baru. Lihat AddStockOptions di StockService untuk jalur lain.
      await StockService.addStock(
        tx,
        po.branchId,
        item.productId,
        item.uomId,
        qtyNet.toString(),
        costPrice.toString(),
        new Date(),
        item.expiryDate ? new Date(item.expiryDate) : null,
        { settleShortfalls: true, settleShortfallsReferenceId: poId, purchaseOrderId: poId, estimateCostWhenZero: true },
      );

      await syncCostFromInbound(tx, {
        branchId: po.branchId,
        productId: item.productId,
        uomId: item.uomId,
        unitCost: costPrice.toNumber(),
        sourceType: 'PO_RECEIVING',
        sourceId: poId,
        sourceRef: po.poNumber,
        actorUserId: approvedById,
      });

      await tx.insert(auditLogs).values({
        userId: approvedById,
        action: 'PO_RECEIVING',
        branchId: po.branchId,
        tableName: 'purchase_orders',
        recordId: String(poId),
        newData: JSON.stringify({ productId: item.productId, qtyReceived: qtyNet.toNumber(), poNumber: po.poNumber, pricePending }),
        createdAt: new Date(),
      });
    }

    // 4. Create/Update Supplier Payables
    const [existingPayable] = await tx
      .select()
      .from(supplierPayables)
      .where(eq(supplierPayables.poId, poId))
      .limit(1);

    if (existingPayable) {
      await tx.update(supplierPayables)
        .set({ totalAmount: Math.round(totalPayableAmount.toNumber()) })
        .where(eq(supplierPayables.id, existingPayable.id));
    } else {
      await tx.insert(supplierPayables).values({
        poId,
        supplierId: po.supplierId,
        totalAmount: Math.round(totalPayableAmount.toNumber()),
        paidAmount: 0,
        status: 'UNPAID',
        createdAt: new Date(),
      });
    }

    // 5. Update PO Status — COMPLETED setelah BO approve receiving
    await tx.update(purchaseOrders)
      .set({ status: 'COMPLETED', updatedAt: new Date() })
      .where(eq(purchaseOrders.id, poId));
  });
}
