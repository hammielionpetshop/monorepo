import { NextRequest, NextResponse } from 'next/server';
import { db, stockOpnames, eq, and, desc } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');
    const shiftId = searchParams.get('shiftId');
    const status = searchParams.get('status');

    let query = db.select()
      .from(stockOpnames)
      .where(and(
        branchId ? eq(stockOpnames.branchId, Number(branchId)) : undefined,
        shiftId ? eq(stockOpnames.shiftId, Number(shiftId)) : undefined,
        status ? eq(stockOpnames.status, status) : undefined,
      ))
      .orderBy(desc(stockOpnames.createdAt))
      .limit(100);

    const results = await query;
    return NextResponse.json(results);

  } catch (error: any) {
    console.error('Get SO History API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch stock opname history' }, { status: 500 });
  }
}
