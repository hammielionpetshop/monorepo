import { NextRequest, NextResponse } from 'next/server';
import { db, stockOpnames, eq, and } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    }

    const results = await db.select()
      .from(stockOpnames)
      .where(and(
        eq(stockOpnames.branchId, Number(branchId)),
        eq(stockOpnames.type, 'FULL'),
        eq(stockOpnames.status, 'PENDING'),
        eq(stockOpnames.isSkipped, false)
      ));

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('Get Active FULL SO API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch active FULL stock opname' }, { status: 500 });
  }
}
