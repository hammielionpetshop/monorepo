import Big from 'big.js';
import { eq } from '@petshop/db';
import {
  purchaseOrders,
  purchaseOrderItems,
  supplierPayables,
  auditLogs
} from '@petshop/db';
import { StockService } from './services/stock-service';

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
      .limit(1);

    if (!po) throw new Error('Purchase Order not found');
    if (po.status === 'FULLY_RECEIVED') throw new Error('PO already fully received');

    // 2. Fetch PO items
    const items = await tx
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, poId));

    let totalPayableAmount = new Big(0);

    // 3. Process each item
    for (const item of items) {
      const qtyNet = new Big(item.qtyReceived).minus(item.qtyDamaged);
      if (qtyNet.lte(0)) continue;

      const costPrice = new Big(item.invoiceUnitCost ?? item.unitCost);
      totalPayableAmount = totalPayableAmount.plus(qtyNet.times(costPrice));

      await StockService.addStock(
        tx,
        po.branchId,
        item.productId,
        item.uomId,
        qtyNet.toString(),
        costPrice.toString(),
        new Date(),
        item.expiryDate ? new Date(item.expiryDate) : null,
      );

      await tx.insert(auditLogs).values({
        userId: approvedById,
        action: 'PO_RECEIVING',
        entityType: 'product_stocks',
        entityId: item.productId,
        details: `Received ${qtyNet.toString()} of product ${item.productId} from PO ${po.poNumber}`,
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
        .set({ totalAmount: totalPayableAmount.toString() })
        .where(eq(supplierPayables.id, existingPayable.id));
    } else {
      await tx.insert(supplierPayables).values({
        poId,
        supplierId: po.supplierId,
        totalAmount: totalPayableAmount.toString(),
        paidAmount: '0',
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
