import { NextResponse } from 'next/server';
import { db, purchaseOrders, eq } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const poId = parseInt(id);
    const body = await req.json();
    const { rejectedById, rejectionNote } = body;

    const [updatedPO] = await db.update(purchaseOrders)
      .set({
        status: 'PENDING_APPROVAL', // Stay in pending but with rejection note so user can fix
        rejectedById,
        rejectedAt: new Date(),
        rejectionNote,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, poId))
      .returning();

    return NextResponse.json(updatedPO);
  } catch (error: any) {
    console.error('Reject PO error:', error);
    return NextResponse.json({ error: 'Failed to reject purchase order' }, { status: 500 });
  }
}
