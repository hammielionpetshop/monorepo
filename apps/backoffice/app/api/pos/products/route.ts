import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import {
  db,
  products,
  productPrices,
  productUomConversions,
  productStocks,
  unitsOfMeasure,
  eq,
  and,
  or,
  ilike,
  inArray,
  sql,
  count,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const search   = searchParams.get('search')?.trim() ?? ''
  const barcode  = searchParams.get('barcode')?.trim() ?? ''
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit    = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT))))
  const branchId = payload.branchId

  const searchWhere = barcode
    ? or(eq(products.barcode, barcode), eq(products.sku, barcode))
    : search
      ? or(
          ilike(products.name, `%${search}%`),
          ilike(products.sku, `%${search}%`),
          ilike(products.barcode, `%${search}%`)
        )
      : undefined

  const whereCondition = and(eq(products.isActive, true), searchWhere)

  const [countResult, productList] = await Promise.all([
    db.select({ total: count() }).from(products).where(whereCondition),
    db
      .select({
        id: products.id,
        sku: products.sku,
        barcode: products.barcode,
        name: products.name,
        categoryId: products.categoryId,
        brandId: products.brandId,
        baseUomId: products.baseUomId,
        weightGram: products.weightGram,
        stock: sql<string>`COALESCE(${productStocks.qty}, '0')`,
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
      .where(whereCondition)
      .orderBy(products.name)
      .limit(limit)
      .offset((page - 1) * limit),
  ])

  const total = countResult[0]?.total ?? 0

  if (!productList.length) {
    return NextResponse.json({ products: [], total: 0, page, totalPages: 0 })
  }

  const productIds = productList.map((p) => p.id)

  const [priceList, conversionList] = await Promise.all([
    db
      .select()
      .from(productPrices)
      .where(and(eq(productPrices.branchId, branchId), inArray(productPrices.productId, productIds))),
    db
      .select({
        id: productUomConversions.id,
        productId: productUomConversions.productId,
        uomId: productUomConversions.uomId,
        ratio: productUomConversions.ratio,
        weightGram: productUomConversions.weightGram,
        uomCode: unitsOfMeasure.code,
      })
      .from(productUomConversions)
      .leftJoin(unitsOfMeasure, eq(productUomConversions.uomId, unitsOfMeasure.id))
      .where(inArray(productUomConversions.productId, productIds)),
  ])

  const pricesByProduct = new Map<number, typeof priceList>()
  for (const p of priceList) {
    const arr = pricesByProduct.get(p.productId) ?? []
    arr.push(p)
    pricesByProduct.set(p.productId, arr)
  }

  const conversionsByProduct = new Map<number, typeof conversionList>()
  for (const c of conversionList) {
    const arr = conversionsByProduct.get(c.productId) ?? []
    arr.push(c)
    conversionsByProduct.set(c.productId, arr)
  }

  const result = productList.map((p) => ({
    ...p,
    weightGram: p.weightGram != null ? String(p.weightGram) : null,
    stock: p.stock ?? '0',
    prices: (pricesByProduct.get(p.id) ?? []).map((pr) => ({
      ...pr,
      price: String(pr.price),
    })),
    conversions: (conversionsByProduct.get(p.id) ?? []).map((c) => ({
      ...c,
      ratio: c.ratio != null ? String(c.ratio) : null,
      weightGram: c.weightGram != null ? String(c.weightGram) : null,
    })),
  }))

  return NextResponse.json({
    products: result,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}
