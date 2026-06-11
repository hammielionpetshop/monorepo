import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { productRows, priceRows, conversionRows, costRows, mockCookiesGet, mockVerify, mockGetPosBranchId } = vi.hoisted(() => ({
  productRows: [] as unknown[],
  priceRows: [] as unknown[],
  conversionRows: [] as unknown[],
  costRows: [] as unknown[],
  mockCookiesGet: vi.fn(),
  mockVerify: vi.fn(),
  mockGetPosBranchId: vi.fn(),
}))

const makeQuery = (result: unknown[]) => {
  const query = {
    from: vi.fn(() => query),
    leftJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    offset: vi.fn(() => Promise.resolve(result)),
    then: vi.fn((resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve)),
  }
  return query
}

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookiesGet }),
}))

vi.mock('@/lib/auth-cache', () => ({
  verifyAccessTokenCached: mockVerify,
}))

vi.mock('@/lib/pos-branch', () => ({
  getPosBranchId: mockGetPosBranchId,
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn((selection?: Record<string, unknown>) => {
      if (selection?.total) return makeQuery([{ total: productRows.length }])
      if (selection?.sku) return makeQuery(productRows)
      if (selection?.ratio) return makeQuery(conversionRows)
      if (selection?.costPrice) return makeQuery(costRows)
      return makeQuery(priceRows)
    }),
  },
  products: {
    id: 'products.id',
    sku: 'products.sku',
    barcode: 'products.barcode',
    name: 'products.name',
    categoryId: 'products.category_id',
    brandId: 'products.brand_id',
    baseUomId: 'products.base_uom_id',
    weightGram: 'products.weight_gram',
    isActive: 'products.is_active',
  },
  productPrices: { branchId: 'prices.branch_id', productId: 'prices.product_id' },
  productUomConversions: {
    id: 'conversions.id',
    productId: 'conversions.product_id',
    uomId: 'conversions.uom_id',
    ratio: 'conversions.ratio',
    weightGram: 'conversions.weight_gram',
  },
  productUomCosts: {
    id: 'costs.id',
    productId: 'costs.product_id',
    branchId: 'costs.branch_id',
    uomId: 'costs.uom_id',
    costPrice: 'costs.cost_price',
  },
  productStocks: {
    qty: 'stocks.qty',
    productId: 'stocks.product_id',
    branchId: 'stocks.branch_id',
    uomId: 'stocks.uom_id',
  },
  unitsOfMeasure: { id: 'uoms.id', code: 'uoms.code' },
  eq: vi.fn((left, right) => `eq(${left}, ${right})`),
  and: vi.fn((...args) => `and(${args.join(', ')})`),
  or: vi.fn((...args) => `or(${args.join(', ')})`),
  ilike: vi.fn((left, right) => `ilike(${left}, ${right})`),
  inArray: vi.fn((left, right) => `inArray(${left}, ${JSON.stringify(right)})`),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, part, index) => `${acc}${part}${index < values.length ? String(values[index]) : ''}`, '')
  ),
  count: vi.fn(() => 'count(*)'),
}))

import { GET } from './route'

describe('GET /api/pos/products', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    productRows.length = 0
    priceRows.length = 0
    conversionRows.length = 0
    costRows.length = 0
    mockCookiesGet.mockReturnValue({ value: 'tok' })
    mockVerify.mockResolvedValue({ userId: 1, branchId: 2 })
    mockGetPosBranchId.mockReturnValue(2)
  })

  it('returns branch-scoped productUomCosts per product', async () => {
    productRows.push({ id: 10, name: 'Produk A', weightGram: null, stock: '5' })
    costRows.push({ id: 1, productId: 10, branchId: 2, uomId: 1, costPrice: 12500 })

    const req = new NextRequest('http://localhost/api/pos/products?search=Produk')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.products[0].productUomCosts).toEqual([
      { id: 1, productId: 10, branchId: 2, uomId: 1, costPrice: 12500 },
    ])
  })
})
