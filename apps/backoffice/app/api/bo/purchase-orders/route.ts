import { NextResponse } from 'next/server';
import { db, purchaseOrders, suppliers, branches, desc, eq, and, inArray } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');
    const status = searchParams.get('status');

    const conditions: any[] = [];

    if (branchId) {
      conditions.push(eq(purchaseOrders.branchId, parseInt(branchId)));
    }

    if (status) {
      conditions.push(inArray(purchaseOrders.status, status.split(',')));
    }

    const rows = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
        notes: purchaseOrders.notes,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
        targetDeliveryDate: purchaseOrders.targetDeliveryDate,
        invoiceNumber: purchaseOrders.invoiceNumber,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        branchId: purchaseOrders.branchId,
        branchName: branches.name,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(branches, eq(purchaseOrders.branchId, branches.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(purchaseOrders.createdAt));

    const pos = rows.map(r => ({
      ...r,
      supplier: { id: r.supplierId, name: r.supplierName ?? '-' },
      branch: { id: r.branchId, name: r.branchName ?? '-' },
    }));

    return NextResponse.json(pos);
  } catch (error: any) {
    console.error('List BO PO error:', error);
    return NextResponse.json({ error: 'Failed to list purchase orders' }, { status: 500 });
  }
}
