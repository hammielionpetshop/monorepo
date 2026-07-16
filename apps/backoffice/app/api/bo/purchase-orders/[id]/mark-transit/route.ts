import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { db, purchaseOrders, eq, and } from '@/lib/db';

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const poId = Number.parseInt(id, 10);

    const gate = await requirePermission('po.approve');
    if (gate instanceof NextResponse) return gate;
    const payload = gate;

    if (!Number.isInteger(poId) || poId <= 0) {
      return NextResponse.json({ error: 'ID Purchase Order tidak valid' }, { status: 400 });
    }

    const isGlobal = payload.branchScope === 'ALL';
    const poWhere = isGlobal
      ? eq(purchaseOrders.id, poId)
      : and(eq(purchaseOrders.id, poId), eq(purchaseOrders.branchId, payload.branchId));

    const po = await db.query.purchaseOrders.findFirst({ where: poWhere });

    if (!po) {
      return NextResponse.json({ error: 'Purchase Order tidak ditemukan' }, { status: 404 });
    }

    const [updatedPO] = await db
      .update(purchaseOrders)
      .set({
        status: 'IN_TRANSIT',
        updatedAt: new Date(),
      })
      .where(poWhere)
      .returning();

    return NextResponse.json(updatedPO);
  } catch (error) {
    console.error('Mark transit PO error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui status Purchase Order' }, { status: 500 });
  }
}
