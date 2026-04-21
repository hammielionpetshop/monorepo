import { eq, sql, sum } from '@petshop/db';
import { 
  purchaseOrders, 
  purchaseOrderItems, 
  productStocks, 
  productStockBatches, 
  supplierPayables,
  auditLogs
} from '@petshop/db';

export async function applyPOReceivingBatches(
  db: any,
  poId: number,
  approvedById: number
): Promise<void> {
  await db.transaction(async (tx: any) => {
    // 1. Fetch PO and items
    const po = await tx.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, poId),
      with: {
        items: true,
      },
    });

    if (!po) throw new Error('Purchase Order not found');
    if (po.status === 'FULLY_RECEIVED') throw new Error('PO already fully received');

    let totalPayableAmount = 0;

    // 2. Process each item
    for (const item of po.items) {
      const qtyNet = Number(item.qtyReceived) - Number(item.qtyDamaged);
      if (qtyNet <= 0) continue;

      const costPrice = Number(item.invoiceUnitCost ?? item.unitCost);
      const itemTotalCost = qtyNet * costPrice;
      totalPayableAmount += itemTotalCost;

      // Insert productStockBatches
      await tx.insert(productStockBatches).values({
        productId: item.productId,
        branchId: po.branchId,
        uomId: item.uomId,
        qtyReceived: qtyNet.toString(),
        qtyRemaining: qtyNet.toString(),
        costPrice: costPrice.toString(),
        receivedAt: new Date(),
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
      });

      // Upsert productStocks
      const existingStock = await tx.query.productStocks.findFirst({
        where: sql`${productStocks.productId} = ${item.productId} AND ${productStocks.branchId} = ${po.branchId} AND ${productStocks.uomId} = ${item.uomId}`,
      });

      if (existingStock) {
        await tx.update(productStocks)
          .set({ qty: (Number(existingStock.qty) + qtyNet).toString() })
          .where(eq(productStocks.id, existingStock.id));
      } else {
        await tx.insert(productStocks).values({
          productId: item.productId,
          branchId: po.branchId,
          uomId: item.uomId,
          qty: qtyNet.toString(),
        });
      }

      // Audit Log
      await tx.insert(auditLogs).values({
        userId: approvedById,
        action: 'PO_RECEIVING',
        entityType: 'product_stocks',
        entityId: item.productId,
        details: `Received ${qtyNet} ${item.productId} from PO ${po.poNumber}`,
        createdAt: new Date(),
      });
    }

    // 3. Create/Update Supplier Payables
    const existingPayable = await tx.query.supplierPayables.findFirst({
      where: eq(supplierPayables.poId, poId),
    });

    if (existingPayable) {
      await tx.update(supplierPayables)
        .set({ 
          totalAmount: totalPayableAmount.toString(),
          updatedAt: new Date(),
        })
        .where(eq(supplierPayables.id, existingPayable.id));
    } else {
      await tx.insert(supplierPayables).values({
        poId: poId,
        supplierId: po.supplierId,
        totalAmount: totalPayableAmount.toString(),
        paidAmount: '0',
        status: 'UNPAID',
        createdAt: new Date(),
      });
    }

    // 4. Update PO Status
    // Check if all items received
    const allReceived = po.items.every((item: any) => 
      Number(item.qtyReceived) >= Number(item.qtyOrdered)
    );

    await tx.update(purchaseOrders)
      .set({ 
        status: allReceived ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED',
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, poId));
  });
}
