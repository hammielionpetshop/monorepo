import { NextRequest, NextResponse } from 'next/server';
import { db, sql, eq, and, desc, ilike, or } from '@/lib/db';
import { transactions, transactionItems, products, productStocks, unitsOfMeasure } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branchId');
  const shiftId = searchParams.get('shiftId');
  const method = searchParams.get('method');
  const q = searchParams.get('q') || '';

  if (!branchId) {
    return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
  }

  try {
    if (method === 'BEST_SELLER' || method === 'SOLD_TODAY') {
      const query = db.select({
        productId: products.id,
        productName: products.name,
        sku: products.sku,
        baseUomId: products.baseUomId,
        baseUomCode: unitsOfMeasure.code,
        currentStock: sql<number>`COALESCE(${productStocks.qty}, 0)`,
        soldQtyToday: sql<number>`SUM(${transactionItems.qty})`
      })
      .from(transactionItems)
      .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
      .innerJoin(products, eq(transactionItems.productId, products.id))
      .innerJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
      .leftJoin(productStocks, and(
        eq(productStocks.productId, products.id),
        eq(productStocks.branchId, Number(branchId)),
        eq(productStocks.uomId, products.baseUomId)
      ))
      .where(and(
        eq(transactions.branchId, Number(branchId)),
        shiftId ? eq(transactions.shiftId, Number(shiftId)) : sql`DATE(${transactions.createdAt}) = CURRENT_DATE`
      ))
      .groupBy(
        products.id,
        products.name,
        products.sku,
        products.baseUomId,
        unitsOfMeasure.code,
        productStocks.qty
      )
      .orderBy(desc(sql`SUM(${transactionItems.qty})`));

      if (method === 'BEST_SELLER') {
        query.limit(30);
      }

      const results = await query;
      return NextResponse.json(results);
    } 
    else if (method === 'MANUAL') {
      const query = db.select({
        productId: products.id,
        productName: products.name,
        sku: products.sku,
        baseUomId: products.baseUomId,
        baseUomCode: unitsOfMeasure.code,
        currentStock: sql<number>`COALESCE(${productStocks.qty}, 0)`,
        soldQtyToday: sql<number>`0`
      })
      .from(products)
      .innerJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
      .leftJoin(productStocks, and(
        eq(productStocks.productId, products.id),
        eq(productStocks.branchId, Number(branchId)),
        eq(productStocks.uomId, products.baseUomId)
      ))
      .where(and(
        eq(products.isActive, true),
        q ? or(
          ilike(products.name, `%${q}%`),
          ilike(products.sku, `%${q}%`),
          ilike(products.barcode, `%${q}%`)
        ) : undefined
      ))
      .limit(50);

      const results = await query;
      return NextResponse.json(results);
    }
    else {
      return NextResponse.json({ error: 'Invalid method. Must be BEST_SELLER, SOLD_TODAY, or MANUAL.' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in GET /api/pos/stock-opname/suggestions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
