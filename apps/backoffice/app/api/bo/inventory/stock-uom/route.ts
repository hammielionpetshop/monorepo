import { NextRequest, NextResponse } from 'next/server'
import { getAuth, scopeFilter } from '@/lib/authz'
import { db, products, unitsOfMeasure, branches, productStocks, productStockBatches, productPrices, productUomCosts, eq, and, asc, count } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const productIdParam = req.nextUrl.searchParams.get('productId')
    if (!productIdParam || !/^\d+$/.test(productIdParam)) {
      return NextResponse.json({ error: 'productId wajib diisi' }, { status: 400 })
    }
    const productId = Number(productIdParam)

    const productRows = await db
      .select({
        id: products.id,
        name: products.name,
        baseUomId: products.baseUomId,
        baseUomCode: unitsOfMeasure.code,
        baseUomName: unitsOfMeasure.name,
      })
      .from(products)
      .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
      .where(eq(products.id, productId))
      .limit(1)

    if (productRows.length === 0) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    }

    const [stockRows, batchRows, priceRows, costRows] = await Promise.all([
      db
        .select({
          id: productStocks.id,
          branchId: productStocks.branchId,
          branchName: branches.name,
          uomId: productStocks.uomId,
          uomCode: unitsOfMeasure.code,
          uomName: unitsOfMeasure.name,
          qty: productStocks.qty,
        })
        .from(productStocks)
        .innerJoin(branches, eq(productStocks.branchId, branches.id))
        .innerJoin(unitsOfMeasure, eq(productStocks.uomId, unitsOfMeasure.id))
        .where(and(eq(productStocks.productId, productId), scopeFilter(payload, productStocks.branchId))),
      db
        .select({
          id: productStockBatches.id,
          branchId: productStockBatches.branchId,
          branchName: branches.name,
          uomId: productStockBatches.uomId,
          qtyReceived: productStockBatches.qtyReceived,
          qtyRemaining: productStockBatches.qtyRemaining,
          costPrice: productStockBatches.costPrice,
          receivedAt: productStockBatches.receivedAt,
          expiryDate: productStockBatches.expiryDate,
        })
        .from(productStockBatches)
        .innerJoin(branches, eq(productStockBatches.branchId, branches.id))
        .where(and(eq(productStockBatches.productId, productId), scopeFilter(payload, productStockBatches.branchId)))
        .orderBy(asc(productStockBatches.receivedAt)),
      db
        .select({ branchId: productPrices.branchId, uomId: productPrices.uomId, n: count() })
        .from(productPrices)
        .where(and(eq(productPrices.productId, productId), scopeFilter(payload, productPrices.branchId)))
        .groupBy(productPrices.branchId, productPrices.uomId),
      db
        .select({ branchId: productUomCosts.branchId, uomId: productUomCosts.uomId, n: count() })
        .from(productUomCosts)
        .where(and(eq(productUomCosts.productId, productId), scopeFilter(payload, productUomCosts.branchId)))
        .groupBy(productUomCosts.branchId, productUomCosts.uomId),
    ])

    return NextResponse.json({
      product: productRows[0],
      stocks: stockRows,
      batches: batchRows,
      priceCounts: priceRows,
      costCounts: costRows,
    })
  } catch (error: unknown) {
    console.error('GET /api/bo/inventory/stock-uom error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data stok' }, { status: 500 })
  }
}
