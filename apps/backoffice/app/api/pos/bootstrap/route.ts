import { NextResponse } from 'next/server';
import { db, products, productUomConversions, productPrices, customers, unitsOfMeasure, paymentMethods, categories, productStocks, eq, and, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = parseInt(searchParams.get('branchId') || '1');

    console.log(`[POS] Bootstrapping for branch ${branchId}...`);

    // 1. Fetch Products with Conversions and Stocks
    const allProducts = await db
      .select({
        id: products.id,
        sku: products.sku,
        barcode: products.barcode,
        name: products.name,
        categoryId: products.categoryId,
        brandId: products.brandId,
        baseUomId: products.baseUomId,
        stock: sql<number>`COALESCE(${productStocks.qty}, 0)`,
      })
      .from(products)
      .leftJoin(
        productStocks, 
        and(eq(products.id, productStocks.productId), eq(productStocks.branchId, branchId))
      )
      .where(eq(products.isActive, true));

    // Fetch conversions with UOM code via join
    const conversions = await db
      .select({
        id: productUomConversions.id,
        productId: productUomConversions.productId,
        uomId: productUomConversions.uomId,
        ratio: productUomConversions.ratio,
        uomCode: unitsOfMeasure.code,
      })
      .from(productUomConversions)
      .leftJoin(unitsOfMeasure, eq(productUomConversions.uomId, unitsOfMeasure.id));

    // 2. Fetch all Prices for this branch
    const prices = await db.select().from(productPrices).where(eq(productPrices.branchId, branchId));

    // 3. Fetch Customers
    const allCustomers = await db.select().from(customers).where(eq(customers.isActive, true));

    // 4. Master Data
    const uoms = await db.select().from(unitsOfMeasure);
    const payments = await db.select().from(paymentMethods);
    const allCategories = await db.select().from(categories);

    return NextResponse.json({
      products: allProducts,
      conversions,
      prices,
      customers: allCustomers,
      categories: allCategories,
      uoms,
      paymentMethods: payments,
      priceTiers: ['RETAIL', 'GROSIR', 'MEMBER', 'DISTRIBUTOR', 'RESELLER', 'PROMO'],
    });

  } catch (error: any) {
    console.error('Bootstrap API error:', error);
    return NextResponse.json({ error: 'Failed to bootstrap POS data' }, { status: 500 });
  }
}
