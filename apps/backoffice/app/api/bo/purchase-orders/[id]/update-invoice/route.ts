import { NextResponse } from 'next/server';
import { db, purchaseOrders, purchaseOrderItems, supplierPayables, eq, sql } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const poId = parseInt(params.id);
    const body = await req.json();
    const { invoiceNumber, items } = body; // items: [{ id: poItemId, invoiceUnitCost: number }]

    if (!invoiceNumber || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Missing invoiceNumber or items' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Update PO header
      await tx.update(purchaseOrders)
        .set({
          invoiceNumber,
          invoiceUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, poId));

      // 2. Update each PO item invoice cost
      for (const item of items) {
        await tx.update(purchaseOrderItems)
          .set({
            invoiceUnitCost: item.invoiceUnitCost.toString(),
          })
          .where(eq(purchaseOrderItems.id, item.id));
      }

      // 3. Recalculate Supplier Payable Total Amount
      // Total amount is based on qtyReceived * (invoiceUnitCost || unitCost)
      const allItems = await tx.query.purchaseOrderItems.findMany({
        where: eq(purchaseOrderItems.poId, poId),
      });

      let newTotalAmount = 0;
      for (const item of allItems) {
        const cost = item.invoiceUnitCost || item.unitCost;
        newTotalAmount += parseFloat(item.qtyReceived) * parseFloat(cost);
      }

      // Check if payable exists, update it. 
      // If not exists (e.g. PO not yet received), we might not have a payable yet depending on the flow.
      // But typically payable is created when status becomes FULLY_RECEIVED or approved-receiving.
      await tx.update(supplierPayables)
        .set({
          totalAmount: newTotalAmount.toString(),
        })
        .where(eq(supplierPayables.poId, poId));

      return { success: true, newTotalAmount };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Update invoice error:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}
