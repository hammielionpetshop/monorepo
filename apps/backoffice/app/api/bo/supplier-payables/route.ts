import { NextResponse } from 'next/server';
import { db, supplierPayables, purchaseOrders, suppliers, eq, and, sql, desc } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('supplierId');
    const status = searchParams.get('status');

    let conditions: any[] = [];
    if (supplierId) {
      conditions.push(eq(supplierPayables.supplierId, parseInt(supplierId)));
    }
    if (status) {
      const statusArray = status.split(',');
      conditions.push(sql`${supplierPayables.status} IN (${statusArray.join(',')})`);
    }

    const payables = await db.query.supplierPayables.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(supplierPayables.createdAt)],
      with: {
        supplier: true,
        purchaseOrder: true,
      },
    });

    return NextResponse.json(payables);
  } catch (error: any) {
    console.error('List payables error:', error);
    return NextResponse.json({ error: 'Failed to list payables' }, { status: 500 });
  }
}
