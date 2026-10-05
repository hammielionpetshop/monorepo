import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { allowedBranchIds } from '@/lib/active-branch'
import {
  db,
  products,
  productStocks,
  productUomConversions,
  productUomCosts,
  unitsOfMeasure,
  eq,
  and,
  inArray,
  asc,
  sql,
} from '@/lib/db'
import { productSearchCondition } from '@/lib/product-search'

export const dynamic = 'force-dynamic'

/**
 * Pencarian produk untuk form Purchase Order: satuan beserta rasio dan modal terakhirnya di
 * cabang tujuan (dasar harga satuan default), plus stok cabang itu sebagai bahan pertimbangan.
 */
export async function GET(req: Request) {
  const gate = await requirePermission('po.manage')
  if (gate instanceof NextResponse) return gate

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const branchId = Number(searchParams.get('branchId'))
  if (!Number.isInteger(branchId) || branchId <= 0) {
    return NextResponse.json({ error: 'Pilih cabang terlebih dahulu' }, { status: 400 })
  }
  const allowed = allowedBranchIds(gate)
  if (allowed !== 'ALL' && !allowed.includes(branchId)) {
    return NextResponse.json({ error: 'Tidak punya akses ke cabang ini' }, { status: 403 })
  }

  const search = productSearchCondition(q)
  if (!search) return NextResponse.json([])

  try {
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        baseUomId: products.baseUomId,
        baseUomCode: unitsOfMeasure.code,
        stock: sql<number>`COALESCE(${productStocks.qty}, 0)`,
      })
      .from(products)
      .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
      .leftJoin(
        productStocks,
        and(
          eq(productStocks.productId, products.id),
          eq(productStocks.branchId, branchId),
          eq(productStocks.uomId, products.baseUomId),
        ),
      )
      .where(and(eq(products.isActive, true), search))
      .orderBy(asc(products.name))
      .limit(40)

    if (rows.length === 0) return NextResponse.json([])
    const ids = rows.map((r) => r.id)

    const [conversions, costs] = await Promise.all([
      db
        .select({
          productId: productUomConversions.productId,
          uomId: productUomConversions.uomId,
          code: unitsOfMeasure.code,
          ratio: productUomConversions.ratio,
        })
        .from(productUomConversions)
        .innerJoin(unitsOfMeasure, eq(productUomConversions.uomId, unitsOfMeasure.id))
        .where(inArray(productUomConversions.productId, ids)),
      db
        .select({ productId: productUomCosts.productId, uomId: productUomCosts.uomId, cost: productUomCosts.costPrice })
        .from(productUomCosts)
        .where(and(inArray(productUomCosts.productId, ids), eq(productUomCosts.branchId, branchId))),
    ])

    const costOf = new Map(costs.map((c) => [`${c.productId}:${c.uomId}`, Number(c.cost)]))
    const cost = (productId: number, uomId: number) => {
      const v = costOf.get(`${productId}:${uomId}`)
      return v && v > 0 ? v : null
    }

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        sku: r.sku,
        baseUomCode: r.baseUomCode ?? '?',
        stock: Number(r.stock),
        uoms: [
          { uomId: r.baseUomId, code: r.baseUomCode ?? '?', ratio: 1, isBase: true, cost: cost(r.id, r.baseUomId) },
          ...conversions
            .filter((c) => c.productId === r.id && c.uomId !== r.baseUomId && Number(c.ratio) > 0)
            .sort((a, b) => Number(a.ratio) - Number(b.ratio))
            .map((c) => ({ uomId: c.uomId, code: c.code, ratio: Number(c.ratio), isBase: false, cost: cost(r.id, c.uomId) })),
        ],
      })),
    )
  } catch (error) {
    console.error('GET /api/bo/purchase-orders/products error:', error)
    return NextResponse.json({ error: 'Gagal mencari produk' }, { status: 500 })
  }
}
