import { NextResponse } from 'next/server';
import { db, purchaseOrders, purchaseOrderItems, eq } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const poId = parseInt(id);

    const po = await db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, poId),
      with: {
        branch: true,
        supplier: true,
        items: {
          with: {
            product: true,
            uom: true,
          }
        },
      },
    });

    if (!po) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    return NextResponse.json(po);
  } catch (error: any) {
    console.error('Detail BO PO error:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase order details' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const poId = parseInt(id);
    const body = await req.json();

    // Support updating basic info if not yet received
    const result = await db.update(purchaseOrders)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, poId))
      .returning();

    return NextResponse.json(result[0]);
  } catch (error: any) {
    console.error('Update BO PO error:', error);
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 });
  }
}
