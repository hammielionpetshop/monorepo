import { NextResponse } from 'next/server';
import { db, purchaseOrders, eq } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const poId = parseInt(id);
    const body = await req.json();
    const { approvedById, notes } = body;

    const po = await db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, poId),
    });

    if (!po) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    // Role check logic
    const role = body.role; // Expected to be passed from frontend for now
    const totalAmount = Number(po.totalAmount);
    const THRESHOLD = 5000000;

    if (totalAmount >= THRESHOLD && role !== 'OWNER') {
      return NextResponse.json({ 
        error: 'Persetujuan PO di atas Rp 5.000.000 hanya dapat dilakukan oleh Owner.' 
      }, { status: 403 });
    }

    if (role !== 'OWNER' && role !== 'MANAGER' && role !== 'GM') {
       return NextResponse.json({ 
        error: 'Anda tidak memiliki akses untuk menyetujui Purchase Order.' 
      }, { status: 403 });
    }

    const [updatedPO] = await db.update(purchaseOrders)
      .set({
        status: 'APPROVED',
        approvedById,
        approvedAt: new Date(),
        notes: notes || po.notes,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, poId))
      .returning();

    return NextResponse.json(updatedPO);
  } catch (error: any) {
    console.error('Approve PO error:', error);
    return NextResponse.json({ error: 'Failed to approve purchase order' }, { status: 500 });
  }
}
