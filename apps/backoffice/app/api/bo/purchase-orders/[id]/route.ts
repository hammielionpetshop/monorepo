import { NextResponse } from 'next/server';
import { db, purchaseOrders, purchaseOrderItems, suppliers, branches, products, unitsOfMeasure, eq } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const poId = parseInt(id);

    const [poRows, itemRows] = await Promise.all([
      db
        .select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          status: purchaseOrders.status,
          totalAmount: purchaseOrders.totalAmount,
          notes: purchaseOrders.notes,
          rejectionNote: purchaseOrders.rejectionNote,
          invoiceNumber: purchaseOrders.invoiceNumber,
          targetDeliveryDate: purchaseOrders.targetDeliveryDate,
          approvedAt: purchaseOrders.approvedAt,
          createdAt: purchaseOrders.createdAt,
          updatedAt: purchaseOrders.updatedAt,
          supplierId: purchaseOrders.supplierId,
          supplierName: suppliers.name,
          supplierPhone: suppliers.phone,
          branchId: purchaseOrders.branchId,
          branchName: branches.name,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .leftJoin(branches, eq(purchaseOrders.branchId, branches.id))
        .where(eq(purchaseOrders.id, poId))
        .limit(1),
      db
        .select({
          id: purchaseOrderItems.id,
          poId: purchaseOrderItems.poId,
          productId: purchaseOrderItems.productId,
          productName: products.name,
          productSku: products.sku,
          uomId: purchaseOrderItems.uomId,
          uomCode: unitsOfMeasure.code,
          qtyOrdered: purchaseOrderItems.qtyOrdered,
          qtyReceived: purchaseOrderItems.qtyReceived,
          qtyDamaged: purchaseOrderItems.qtyDamaged,
          unitCost: purchaseOrderItems.unitCost,
          invoiceUnitCost: purchaseOrderItems.invoiceUnitCost,
          expiryDate: purchaseOrderItems.expiryDate,
        })
        .from(purchaseOrderItems)
        .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
        .leftJoin(unitsOfMeasure, eq(purchaseOrderItems.uomId, unitsOfMeasure.id))
        .where(eq(purchaseOrderItems.poId, poId)),
    ]);

    if (!poRows[0]) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    const po = {
      ...poRows[0],
      supplier: { id: poRows[0].supplierId, name: poRows[0].supplierName ?? '-', phone: poRows[0].supplierPhone },
      branch: { id: poRows[0].branchId, name: poRows[0].branchName ?? '-' },
      items: itemRows,
    };

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
