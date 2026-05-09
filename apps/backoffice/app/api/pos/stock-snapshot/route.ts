import { NextResponse } from 'next/server';
import { db, products, productStocks, eq, and, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const branchId = parseInt(searchParams.get('branchId') || '1');

  try {
    const snapshot = await db
      .select({
        id: products.id,
        stock: sql<string>`COALESCE(${productStocks.qty}, '0')`,
      })
      .from(products)
      .leftJoin(
        productStocks,
        and(
          eq(productStocks.productId, products.id),
          eq(productStocks.branchId, branchId),
          eq(productStocks.uomId, products.baseUomId)
        )
      )
      .where(eq(products.isActive, true));

    return NextResponse.json(snapshot);
  } catch (error: any) {
    console.error('[Stock Snapshot] Error:', error);
    return NextResponse.json({ error: 'Gagal mengambil snapshot stok' }, { status: 500 });
  }
}
