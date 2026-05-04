import { NextResponse } from 'next/server';
import { db, purchaseOrders, purchaseOrderItems, poReceivingLogs, poReceivingItems, eq, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const poId = parseInt(id);
    const body = await req.json();
    const { receivedById, invoiceReceived, note, items } = body;

    if (!poId || !receivedById || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required payload' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Create receiving log header
      const [log] = await tx.insert(poReceivingLogs).values({
        poId,
        receivedById,
        invoiceReceived: !!invoiceReceived,
        note,
        receivedAt: new Date(),
      }).returning();

      // 2. Process each item
      for (const item of items) {
        // Create receiving item detail
        await tx.insert(poReceivingItems).values({
          logId: log.id,
          poItemId: item.poItemId,
          qtyReceived: item.qtyReceived.toString(),
          qtyDamaged: (item.qtyDamaged || 0).toString(),
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          note: item.note,
        });

        // Update PO item qty_received and qty_damaged
        await tx.update(purchaseOrderItems)
          .set({
            qtyReceived: sql`${purchaseOrderItems.qtyReceived} + ${item.qtyReceived.toString()}`,
            qtyDamaged: sql`${purchaseOrderItems.qtyDamaged} + ${(item.qtyDamaged || 0).toString()}`,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : purchaseOrderItems.expiryDate,
          })
          .where(eq(purchaseOrderItems.id, item.poItemId));
      }

      // 3. Update PO status
      // We'll mark as IN_TRANSIT -> PARTIALLY_RECEIVED for now.
      // Final FULLY_RECEIVED will be decided later after comparing total ordered vs total received.
      await tx.update(purchaseOrders)
        .set({ 
          status: 'PARTIALLY_RECEIVED', // Default status after receiving before BO approval
          updatedAt: new Date() 
        })
        .where(eq(purchaseOrders.id, poId));

      return log;
    });

    return NextResponse.json({
      success: true,
      message: 'Items received successfully',
      log: result,
    });

  } catch (error: any) {
    console.error('Receive PO error:', error);
    return NextResponse.json({ error: 'Failed to record receiving' }, { status: 500 });
  }
}
