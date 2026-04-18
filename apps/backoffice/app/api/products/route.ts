import { NextResponse } from 'next/server';
import { db, products, categories, brands, productStocks, ilike, or, eq, and, sql } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const categoryId = searchParams.get('categoryId');
    const limit = parseInt(searchParams.get('limit') || '50');

    let whereClause = eq(products.isActive, true);

    if (query) {
      whereClause = and(
        whereClause,
        or(
          ilike(products.name, `%${query}%`),
          ilike(products.sku || '', `%${query}%`),
          ilike(products.barcode || '', `%${query}%`)
        )
      ) as any;
    }

    if (categoryId) {
      whereClause = and(whereClause, eq(products.categoryId, parseInt(categoryId))) as any;
    }

    const branchId = parseInt(searchParams.get('branchId') || '1');

    const result = await db
      .select({
        id: products.id,
        sku: products.sku,
        barcode: products.barcode,
        name: products.name,
        categoryId: products.categoryId,
        baseUomId: products.baseUomId,
        stock: sql<number>`COALESCE(${productStocks.qty}, 0)`,
      })
      .from(products)
      .leftJoin(
        productStocks, 
        and(eq(products.id, productStocks.productId), eq(productStocks.branchId, branchId))
      )
      .where(whereClause)
      .limit(limit);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Product search error:', error);
    return NextResponse.json({ error: 'Failed to search products' }, { status: 500 });
  }
}
