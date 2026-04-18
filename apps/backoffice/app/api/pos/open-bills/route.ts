import { NextResponse } from 'next/server';
import { db, openBills, eq, and, desc } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET list of open bills for a branch
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = parseInt(searchParams.get('branchId') || '1');

    const result = await db
      .select()
      .from(openBills)
      .where(eq(openBills.branchId, branchId))
      .orderBy(desc(openBills.createdAt));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[OpenBills] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST create open bill (Hold)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { branchId, holdName, items, customerId } = body;

    const [newBill] = await db.insert(openBills).values({
      branchId,
      holdName: holdName || `Bill ${new Date().toLocaleTimeString()}`,
      items: JSON.stringify(items),
      customerId: customerId || null,
    }).returning();

    return NextResponse.json(newBill);
  } catch (err: any) {
    console.error('[OpenBills] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
