import { NextResponse } from 'next/server';
import { db, purchaseOrders, eq } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const poId = parseInt(params.id);

    const [updatedPO] = await db.update(purchaseOrders)
      .set({
        status: 'IN_TRANSIT',
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, poId))
      .returning();

    return NextResponse.json(updatedPO);
  } catch (error: any) {
    console.error('Mark transit PO error:', error);
    return NextResponse.json({ error: 'Failed to update PO status' }, { status: 500 });
  }
}
