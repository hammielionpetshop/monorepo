import { describe, it, expect, vi, beforeEach } from 'vitest'

const { productUomCostRows } = vi.hoisted(() => ({
  productUomCostRows: [] as unknown[],
}))

const makeQuery = (result: unknown[]) => {
  const query = {
    from: vi.fn(() => query),
    leftJoin: vi.fn(() => query),
    where: vi.fn(() => Promise.resolve(result)),
  }
  return query
}

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn((selection?: Record<string, unknown>) => {
      if (selection?.costPrice) return makeQuery(productUomCostRows)
      return makeQuery([])
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
  productUomConversions: {
    id: 'conversions.id',
    productId: 'conversions.product_id',
    uomId: 'conversions.uom_id',
    ratio: 'conversions.ratio',
    weightGram: 'conversions.weight_gram',
  },
  productPrices: { branchId: 'prices.branch_id' },
  productUomCosts: {
    id: 'costs.id',
    productId: 'costs.product_id',
    branchId: 'costs.branch_id',
    uomId: 'costs.uom_id',
    costPrice: 'costs.cost_price',
  },
  customers: { isActive: 'customers.is_active' },
  unitsOfMeasure: { id: 'uoms.id', code: 'uoms.code' },
  paymentMethods: {},
  categories: {},
  productStocks: {
    qty: 'stocks.qty',
    productId: 'stocks.product_id',
    branchId: 'stocks.branch_id',
    uomId: 'stocks.uom_id',
  },
  expenseCategories: {},
  suppliers: {},
  eq: vi.fn((left, right) => `eq(${left}, ${right})`),
  and: vi.fn((...args) => `and(${args.join(', ')})`),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, part, index) => `${acc}${part}${index < values.length ? String(values[index]) : ''}`, '')
  ),
}))

import { GET } from './route'

describe('GET /api/pos/bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    productUomCostRows.length = 0
  })

  it('returns branch-scoped productUomCosts in bootstrap payload', async () => {
    productUomCostRows.push({ id: 1, productId: 10, branchId: 2, uomId: 1, costPrice: 12500 })

    const res = await GET(new Request('http://localhost/api/pos/bootstrap?branchId=2') as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.productUomCosts).toEqual([
      { id: 1, productId: 10, branchId: 2, uomId: 1, costPrice: 12500 },
    ])
  })
})
