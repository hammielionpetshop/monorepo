import { NextResponse } from 'next/server';
import { db, purchaseOrders, purchaseOrderItems, eq } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const poId = parseInt(params.id);

    const result = await db.transaction(async (tx) => {
      const po = await tx.query.purchaseOrders.findFirst({
        where: eq(purchaseOrders.id, poId),
      });

      if (!po) {
        throw new Error('Purchase Order not found');
      }

      const items = await tx.query.purchaseOrderItems.findMany({
        where: eq(purchaseOrderItems.poId, poId),
      });

      const totalReceived = items.reduce((acc, item) => acc + parseFloat(item.qtyReceived), 0);
      
      const newStatus = totalReceived > 0 ? 'FULLY_RECEIVED' : 'CANCELLED';

      const [updatedPO] = await tx.update(purchaseOrders)
        .set({
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, poId))
        .returning();

      return updatedPO;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Cancel remaining PO error:', error);
    return NextResponse.json({ error: error.message || 'Failed to cancel remaining purchase order' }, { status: 500 });
  }
}
