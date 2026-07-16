import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { db, purchaseOrders, purchaseOrderItems, eq, and } from '@/lib/db';

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

    const result = await db.transaction(async (tx) => {
      const po = await tx.query.purchaseOrders.findFirst({ where: poWhere });

      if (!po) {
        throw new Error('PO_NOT_FOUND');
      }

      const items = await tx.query.purchaseOrderItems.findMany({
        where: eq(purchaseOrderItems.poId, poId),
      });

      const totalReceived = items.reduce((acc, item) => acc + Number(item.qtyReceived), 0);

      const newStatus = totalReceived > 0 ? 'FULLY_RECEIVED' : 'CANCELLED';

      const [updatedPO] = await tx
        .update(purchaseOrders)
        .set({
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(poWhere)
        .returning();

      return updatedPO;
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'PO_NOT_FOUND') {
      return NextResponse.json({ error: 'Purchase Order tidak ditemukan' }, { status: 404 });
    }
    console.error('Cancel remaining PO error:', error);
    return NextResponse.json({ error: 'Gagal membatalkan sisa Purchase Order' }, { status: 500 });
  }
}
