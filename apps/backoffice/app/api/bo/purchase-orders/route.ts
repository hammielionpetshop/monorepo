import { NextResponse } from 'next/server';
import { db, purchaseOrders, desc, eq, and, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');
    const status = searchParams.get('status');

    let conditions: any[] = [];
    
    if (branchId) {
      conditions.push(eq(purchaseOrders.branchId, parseInt(branchId)));
    }
    
    if (status) {
      const statusArray = status.split(',');
      conditions.push(sql`${purchaseOrders.status} IN (${statusArray.join(',')})`);
    }

    const pos = await db.query.purchaseOrders.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(purchaseOrders.createdAt)],
      with: {
        branch: true,
        supplier: true,
      },
    });

    return NextResponse.json(pos);
  } catch (error: any) {
    console.error('List BO PO error:', error);
    return NextResponse.json({ error: 'Failed to list purchase orders' }, { status: 500 });
  }
}
