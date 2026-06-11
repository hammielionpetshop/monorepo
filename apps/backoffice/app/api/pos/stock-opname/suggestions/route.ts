import { NextRequest, NextResponse } from 'next/server';
import { db, sql, eq, and, desc, ilike, or } from '@/lib/db';
import { transactions, transactionItems, products, productStocks, unitsOfMeasure, shifts } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import { getPosBranchId } from '@/lib/pos-branch';
import { z } from 'zod';

const suggestionQuerySchema = z.object({
  shiftId: z.coerce.number().int().positive('Shift tidak valid').optional(),
  method: z.enum(['BEST_SELLER', 'SOLD_TODAY', 'MANUAL'], {
    message: 'Metode saran tidak valid',
  }).default('MANUAL'),
  q: z.string().trim().max(100, 'Pencarian maksimal 100 karakter').optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const payload = token ? await verifyAccessToken(token) : null;

    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const parsedQuery = suggestionQuerySchema.safeParse({
      shiftId: searchParams.get('shiftId') ?? undefined,
      method: searchParams.get('method') ?? undefined,
      q: searchParams.get('q') ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues[0]?.message ?? 'Parameter tidak valid' }, { status: 400 });
    }

    const { method, shiftId } = parsedQuery.data;
    const q = parsedQuery.data.q ?? '';

    if (shiftId) {
      const shift = await db.query.shifts.findFirst({
        where: and(eq(shifts.id, shiftId), eq(shifts.branchId, branchId)),
      });

      if (!shift) {
        return NextResponse.json({ error: 'Shift tidak sesuai dengan cabang POS' }, { status: 403 });
      }
    }

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
        eq(productStocks.branchId, branchId),
        eq(productStocks.uomId, products.baseUomId)
      ))
      .where(and(
        eq(transactions.branchId, branchId),
        shiftId ? eq(transactions.shiftId, shiftId) : sql`DATE(${transactions.createdAt}) = CURRENT_DATE`
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
        eq(productStocks.branchId, branchId),
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

    return NextResponse.json({ error: 'Metode saran tidak valid' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error in GET /api/pos/stock-opname/suggestions:', error);
    return NextResponse.json({ error: 'Gagal mengambil saran stock opname' }, { status: 500 });
  }
}
