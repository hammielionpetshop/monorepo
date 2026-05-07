import { NextResponse } from 'next/server';
import { db, purchaseOrders, purchaseOrderItems, suppliers, eq, desc, and, inArray, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = parseInt(searchParams.get('branchId') || '');
    const statusParam = searchParams.get('status');

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    }

    const conditions = [eq(purchaseOrders.branchId, branchId)];
    if (statusParam) {
      conditions.push(inArray(purchaseOrders.status, statusParam.split(',')));
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
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.createdAt));

    const pos = rows.map(r => ({
      ...r,
      supplier: { id: r.supplierId, name: r.supplierName ?? '-' },
    }));

    return NextResponse.json(pos);
  } catch (error: any) {
    console.error('List PO error:', error);
    return NextResponse.json({ error: 'Failed to list purchase orders' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { branchId, supplierId, createdById, items, notes, targetDeliveryDate } = body;

    if (!branchId || !supplierId || !createdById || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required payload' }, { status: 400 });
    }

    // 1. Generate PO Number: PO-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Count existing POs for today in this branch
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

    // 2. Calculate Total Amount
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += Number(item.qtyOrdered) * Number(item.unitCost);
    }

    // 3. Insert Purchase Order
    const result = await db.transaction(async (tx) => {
      const [newPO] = await tx.insert(purchaseOrders).values({
        poNumber,
        branchId,
        supplierId,
        createdById,
        totalAmount: totalAmount.toString(),
        notes,
        targetDeliveryDate: targetDeliveryDate ? new Date(targetDeliveryDate) : null,
        status: 'PENDING_APPROVAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      // 4. Insert Items
      const poItems = items.map((item: any) => ({
        poId: newPO.id,
        productId: item.productId,
        uomId: item.uomId,
        qtyOrdered: item.qtyOrdered.toString(),
        qtyReceived: '0',
        qtyDamaged: '0',
        unitCost: item.unitCost.toString(),
      }));

      await tx.insert(purchaseOrderItems).values(poItems);

      return newPO;
    });

    return NextResponse.json({
      success: true,
      message: 'Purchase Order request submitted',
      po: result,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create PO error:', error);
    return NextResponse.json({ error: 'Failed to create purchase order request' }, { status: 500 });
  }
}


