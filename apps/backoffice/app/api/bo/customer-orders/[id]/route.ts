import { NextRequest, NextResponse } from 'next/server';
import { getAuth, scopeFilter } from '@/lib/authz';
import {
  db,
  customerOrders,
  customerOrderItems,
  customers,
  branches,
  eq,
  and,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuth();
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
    }

    const { id } = await params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const [order] = await db
      .select({
        id: customerOrders.id,
        orderNumber: customerOrders.orderNumber,
        customerId: customerOrders.customerId,
        customerName: customers.name,
        customerPhone: customers.phone,
        branchId: customerOrders.branchId,
        branchName: branches.name,
        status: customerOrders.status,
        note: customerOrders.note,
        estimatedTotal: customerOrders.estimatedTotal,
        convertedTransactionId: customerOrders.convertedTransactionId,
        rejectReason: customerOrders.rejectReason,
        createdAt: customerOrders.createdAt,
      })
      .from(customerOrders)
      .leftJoin(customers, eq(customerOrders.customerId, customers.id))
      .leftJoin(branches, eq(customerOrders.branchId, branches.id))
      .where(and(eq(customerOrders.id, orderId), scopeFilter(payload, customerOrders.branchId)))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }

    const items = await db
      .select({
        productId: customerOrderItems.productId,
        productName: customerOrderItems.productName,
        uomId: customerOrderItems.uomId,
        uomCode: customerOrderItems.uomCode,
        qty: customerOrderItems.qty,
        priceTier: customerOrderItems.priceTier,
        unitPriceSnapshot: customerOrderItems.unitPriceSnapshot,
        subtotalSnapshot: customerOrderItems.subtotalSnapshot,
      })
      .from(customerOrderItems)
      .where(eq(customerOrderItems.orderId, orderId))
      .orderBy(customerOrderItems.id);

    return NextResponse.json({ ...order, items });
  } catch (error) {
    console.error('GET customer-order detail error:', error);
    return NextResponse.json({ error: 'Gagal mengambil detail order' }, { status: 500 });
  }
}
