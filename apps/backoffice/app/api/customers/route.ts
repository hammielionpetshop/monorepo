import { NextResponse } from 'next/server';
import { db, customers, ilike, or, eq, and } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    let whereClause = eq(customers.isActive, true);

    if (query) {
      whereClause = and(
        whereClause,
        or(
          ilike(customers.name, `%${query}%`),
          ilike(customers.phone || '', `%${query}%`)
        )
      ) as any;
    }

    const result = await db
      .select()
      .from(customers)
      .where(whereClause)
      .limit(limit);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Customer search error:', error);
    return NextResponse.json({ error: 'Failed to search customers' }, { status: 500 });
  }
}
