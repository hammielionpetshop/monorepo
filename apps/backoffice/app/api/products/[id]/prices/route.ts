import { NextResponse } from 'next/server';
import { db, productPrices, eq, and } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');
    const productId = parseInt(id);

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    }

    const result = await db
      .select()
      .from(productPrices)
      .where(
        and(
          eq(productPrices.productId, productId),
          eq(productPrices.branchId, parseInt(branchId))
        )
      );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Product prices error:', error);
    return NextResponse.json({ error: 'Failed to fetch product prices' }, { status: 500 });
  }
}
