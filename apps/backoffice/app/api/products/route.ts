import { NextResponse } from 'next/server';
import { db, products, productUomConversions, unitsOfMeasure, productStocks, ilike, or, eq, and, sql, inArray } from '@/lib/db';

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
        weightGram: products.weightGram,
        stock: sql<number>`COALESCE(${productStocks.qty}, 0)`,
      })
      .from(products)
      .leftJoin(
        productStocks, 
        and(
          eq(products.id, productStocks.productId), 
          eq(productStocks.branchId, branchId),
          eq(productStocks.uomId, products.baseUomId)
        )
      )
      .where(whereClause)
      .limit(limit);

    if (result.length === 0) return NextResponse.json([]);

    // Fetch base UOM details and conversion UOMs for these products in one batch
    const productIds = result.map(p => p.id);
    const baseUomIds = [...new Set(result.map(p => p.baseUomId))];

    const [baseUoms, conversions] = await Promise.all([
      db
        .select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name })
        .from(unitsOfMeasure)
        .where(inArray(unitsOfMeasure.id, baseUomIds)),
      db
        .select({
          productId: productUomConversions.productId,
          uomId: unitsOfMeasure.id,
          code: unitsOfMeasure.code,
          name: unitsOfMeasure.name,
        })
        .from(productUomConversions)
        .innerJoin(unitsOfMeasure, eq(productUomConversions.uomId, unitsOfMeasure.id))
        .where(inArray(productUomConversions.productId, productIds)),
    ]);

    const baseUomMap = new Map(baseUoms.map(u => [u.id, u]));
    // conversions grouped by productId
    const conversionsByProduct = new Map<number, { id: number; code: string; name: string }[]>();
    for (const c of conversions) {
      if (!conversionsByProduct.has(c.productId)) conversionsByProduct.set(c.productId, []);
      conversionsByProduct.get(c.productId)!.push({ id: c.uomId, code: c.code, name: c.name });
    }

    const enriched = result.map(p => {
      const base = baseUomMap.get(p.baseUomId);
      const extras = conversionsByProduct.get(p.id) ?? [];
      const uoms: { id: number; code: string; name: string; isBase: boolean }[] = [];
      if (base) uoms.push({ ...base, isBase: true });
      for (const u of extras) {
        if (u.id !== p.baseUomId) uoms.push({ ...u, isBase: false });
      }
      return { ...p, uoms };
    });

    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error('Product search error:', error);
    return NextResponse.json({ error: 'Failed to search products' }, { status: 500 });
  }
}
