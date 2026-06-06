import { NextResponse } from 'next/server';
import { db, purchaseOrders, purchaseOrderItems, suppliers, branches, desc, eq, and, inArray, sql } from '@/lib/db';

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { branchId, supplierId, createdById, role, items, notes, targetDeliveryDate } = body;

    if (!branchId || !supplierId || !createdById || !items || items.length === 0) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    if (!['OWNER', 'MANAGER', 'GM'].includes(role)) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses untuk membuat Purchase Order.' }, { status: 403 });
    }

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const [countRow] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.branchId, branchId),
          sql`DATE(${purchaseOrders.createdAt}) = CURRENT_DATE`
        )
      );

    const increment = ((Number(countRow?.count) || 0) + 1).toString().padStart(4, '0');
    const poNumber = `PO-${dateStr}-${increment}`;

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += Number(item.qtyOrdered) * Number(item.unitCost);
    }

    const result = await db.transaction(async (tx) => {
      const [newPO] = await tx.insert(purchaseOrders).values({
        poNumber,
        branchId,
        supplierId,
        createdById,
        totalAmount: Math.round(totalAmount),
        notes: notes || null,
        targetDeliveryDate: targetDeliveryDate ? new Date(targetDeliveryDate) : null,
        status: 'PENDING_APPROVAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const poItems = items.map((item: any) => ({
        poId: newPO.id,
        productId: item.productId,
        uomId: item.uomId,
        qtyOrdered: Number(item.qtyOrdered),
        qtyReceived: 0,
        qtyDamaged: 0,
        unitCost: Number(item.unitCost),
      }));

      await tx.insert(purchaseOrderItems).values(poItems);

      return newPO;
    });

    return NextResponse.json({ success: true, po: result }, { status: 201 });
  } catch (error: any) {
    console.error('BO Create PO error:', error);
    return NextResponse.json({ error: 'Gagal membuat Purchase Order' }, { status: 500 });
  }
}
