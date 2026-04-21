import { NextResponse } from 'next/server';
import { db, productStocks, products, purchaseOrderItems, eq, lt, and, sql, desc } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = parseInt(searchParams.get('branchId') || '');

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    }

    const suggestions = await db.select({
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      currentStock: productStocks.qty,
      baseUomId: productStocks.uomId,
      lastPurchasePrice: sql<string>`(
        SELECT unit_cost 
        FROM petshop.purchase_order_items poi
        JOIN petshop.purchase_orders po ON poi.po_id = po.id
        WHERE poi.product_id = ${products.id}
        ORDER BY po.created_at DESC
        LIMIT 1
      )`
    })
    .from(productStocks)
    .innerJoin(products, eq(productStocks.productId, products.id))
    .where(
      and(
        eq(productStocks.branchId, branchId),
        lt(productStocks.qty, '10')
      )
    );

    return NextResponse.json(suggestions);
  } catch (error: any) {
    console.error('PO suggestions error:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
