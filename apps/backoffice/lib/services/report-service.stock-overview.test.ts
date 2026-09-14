import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queryResults } = vi.hoisted(() => ({
  queryResults: [] as unknown[][],
}))

vi.mock('@/lib/db', () => {
  function makeSelectChain(): any {
    const chain: any = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      having: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      // Satu-satunya titik resolusi, dipanggil LAZY saat benar-benar di-`await` — bukan saat
      // salah satu method di atas dipanggil. Kalau ada method yang shift EAGER (mis. groupBy
      // langsung `Promise.resolve(queryResults.shift())`), urutan shift di dalam
      // `Promise.all([...])` jadi tidak sinkron dengan urutan penulisan array literal — query
      // yang cuma sampai `.where()` (tanpa groupBy/orderBy) baru shift saat Promise.all
      // memanggil `.then()`-nya, padahal query lain yang diakhiri groupBy() sudah shift duluan
      // secara sinkron saat chain-nya dibangun.
      then: (resolve: (v: unknown) => void) => resolve(queryResults.shift() ?? []),
    }
    return chain
  }

  return {
    db: { select: vi.fn(() => makeSelectChain()) },
    products: {
      id: 'products.id',
      name: 'products.name',
      sku: 'products.sku',
      categoryId: 'products.category_id',
      brandId: 'products.brand_id',
      baseUomId: 'products.base_uom_id',
      isActive: 'products.is_active',
      defaultCostPrice: 'products.default_cost_price',
    },
    categories: { id: 'categories.id', name: 'categories.name' },
    brands: { id: 'brands.id', name: 'brands.name' },
    branches: { id: 'branches.id', name: 'branches.name' },
    unitsOfMeasure: { id: 'units_of_measure.id', code: 'units_of_measure.code' },
    productUomConversions: {
      productId: 'product_uom_conversions.product_id',
      uomId: 'product_uom_conversions.uom_id',
      ratio: 'product_uom_conversions.ratio',
    },
    productStockBatches: {
      id: 'product_stock_batches.id',
      productId: 'product_stock_batches.product_id',
      branchId: 'product_stock_batches.branch_id',
      batchCode: 'product_stock_batches.batch_code',
      purchaseOrderId: 'product_stock_batches.purchase_order_id',
      qtyReceived: 'product_stock_batches.qty_received',
      qtyRemaining: 'product_stock_batches.qty_remaining',
      costPrice: 'product_stock_batches.cost_price',
      receivedAt: 'product_stock_batches.received_at',
      expiryDate: 'product_stock_batches.expiry_date',
    },
    stockShortfalls: {
      productId: 'stock_shortfalls.product_id',
      branchId: 'stock_shortfalls.branch_id',
      qtyRemaining: 'stock_shortfalls.qty_remaining',
      costPricePerUnit: 'stock_shortfalls.cost_price_per_unit',
      closedAt: 'stock_shortfalls.closed_at',
      writtenOffAt: 'stock_shortfalls.written_off_at',
    },
    purchaseOrders: { id: 'purchase_orders.id', poNumber: 'purchase_orders.po_number' },
    // Modul report-service.ts punya beberapa `const ... = sql\`...\`` di level modul (dipakai
    // getSalesByProductReport dkk) yang jalan begitu file di-import — perlu dimock walau tidak
    // dipakai fungsi yang diuji di sini.
    transactionItems: {
      uomId: 'transaction_items.uom_id',
      totalPrice: 'transaction_items.total_price',
      discountAmount: 'transaction_items.discount_amount',
      qty: 'transaction_items.qty',
      cogs: 'transaction_items.cogs',
    },
    productUomCosts: {
      costPrice: 'product_uom_costs.cost_price',
    },
    eq: vi.fn((l: unknown, r: unknown) => `eq(${l},${r})`),
    and: vi.fn((...a: unknown[]) => `and(${a.join(',')})`),
    or: vi.fn((...a: unknown[]) => `or(${a.join(',')})`),
    gt: vi.fn((l: unknown, r: unknown) => `gt(${l},${r})`),
    ilike: vi.fn((l: unknown, r: unknown) => `ilike(${l},${r})`),
    inArray: vi.fn((col: unknown, arr: unknown) => `inArray(${col},${arr})`),
    isNull: vi.fn((v: unknown) => `isNull(${v})`),
    asc: vi.fn((v: unknown) => `asc(${v})`),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((acc, part, i) => `${acc}${part}${i < values.length ? String(values[i]) : ''}`, '')
    ),
  }
})

import { getStockOverviewReport, getStockOverviewDetail } from './report-service'

describe('getStockOverviewReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryResults.length = 0
  })

  it('menggabungkan shortfall ke agregat batch per produk lewat query terpisah, bukan JOIN (hindari fan-out)', async () => {
    queryResults.push(
      [
        {
          productId: 1,
          productName: 'Produk A',
          sku: 'SKU-A',
          categoryName: null,
          brandName: null,
          baseUomId: 1,
          baseUomCode: 'PCS',
          totalQty: '100',
          totalValue: '1000000',
          branchCount: 2,
          batchCount: 3,
        },
      ],
      [], // conversionRows
      [{ productId: 1, shortfallQty: '20', shortfallValue: '150000' }], // shortfallRows
    )

    const result = await getStockOverviewReport({})

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      productId: 1,
      totalQty: '100',
      totalValue: '1000000',
      branchCount: 2,
      batchCount: 3,
      shortfallQty: '20',
      shortfallValue: '150000',
    })
    expect(result.totalValue).toBe('1000000')
    expect(result.totalShortfallValue).toBe('150000')
  })

  it('produk tanpa shortfall terbuka menampilkan "0", bukan undefined', async () => {
    queryResults.push(
      [
        {
          productId: 2,
          productName: 'Produk B',
          sku: null,
          categoryName: null,
          brandName: null,
          baseUomId: 1,
          baseUomCode: 'PCS',
          totalQty: '50',
          totalValue: '500000',
          branchCount: 1,
          batchCount: 1,
        },
      ],
      [],
      [],
    )

    const result = await getStockOverviewReport({})

    expect(result.items[0].shortfallQty).toBe('0')
    expect(result.items[0].shortfallValue).toBe('0')
    expect(result.totalShortfallValue).toBe('0')
  })
})

describe('getStockOverviewDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryResults.length = 0
  })

  it('batch lama tanpa batchCode fallback ke "Batch #<id>"', async () => {
    queryResults.push(
      [{ id: 5, name: 'Produk A', sku: 'SKU-A' }], // product lookup
      [{ branchId: 1, branchName: 'Toko Pusat', totalQty: '30', totalValue: '300000', batchCount: 1 }], // branchAgg
      [], // shortfallAgg
      [
        {
          id: 9,
          branchId: 1,
          batchCode: null,
          poNumber: null,
          qtyReceived: '30',
          qtyRemaining: '30',
          costPrice: '10000',
          receivedAt: new Date('2026-01-01T00:00:00.000Z'),
          expiryDate: null,
        },
      ], // batchRows
    )

    const detail = await getStockOverviewDetail(5)

    expect(detail?.branches[0].batches[0].displayCode).toBe('Batch #9')
    expect(detail?.branches[0].shortfallQty).toBe('0')
  })

  it('batch baru dengan batchCode & PO dipakai apa adanya', async () => {
    queryResults.push(
      [{ id: 5, name: 'Produk A', sku: 'SKU-A' }],
      [{ branchId: 1, branchName: 'Toko Pusat', totalQty: '30', totalValue: '300000', batchCount: 1 }],
      [{ branchId: 1, branchName: 'Toko Pusat', shortfallQty: '5', shortfallValue: '25000' }],
      [
        {
          id: 12,
          branchId: 1,
          batchCode: 'BTC-20260915-0001',
          poNumber: 'PO-20260915-0002',
          qtyReceived: '30',
          qtyRemaining: '30',
          costPrice: '10000',
          receivedAt: new Date('2026-09-15T00:00:00.000Z'),
          expiryDate: null,
        },
      ],
    )

    const detail = await getStockOverviewDetail(5)

    expect(detail?.branches[0].batches[0].displayCode).toBe('BTC-20260915-0001')
    expect(detail?.branches[0].batches[0].poNumber).toBe('PO-20260915-0002')
    expect(detail?.branches[0].shortfallQty).toBe('5')
    expect(detail?.branches[0].shortfallValue).toBe('25000')
  })

  it('mengembalikan null untuk produk yang tidak ditemukan', async () => {
    queryResults.push([])

    const detail = await getStockOverviewDetail(999)

    expect(detail).toBeNull()
  })

  it('cabang dengan utang stok tapi TANPA batch aktif tetap muncul (union, bukan inner join)', async () => {
    queryResults.push(
      [{ id: 5, name: 'Produk A', sku: 'SKU-A' }],
      // branchAgg: hanya Toko Pusat yang punya batch aktif
      [{ branchId: 1, branchName: 'Toko Pusat', totalQty: '30', totalValue: '300000', batchCount: 1 }],
      // shortfallAgg: Toko Pusat DAN Toko Depan (branchId 2) — Toko Depan sudah kehabisan
      // semua batch (oversell habis) tapi utangnya masih terbuka, jadi tidak muncul di branchAgg
      [
        { branchId: 1, branchName: 'Toko Pusat', shortfallQty: '5', shortfallValue: '25000' },
        { branchId: 2, branchName: 'Toko Depan', shortfallQty: '75', shortfallValue: '988425' },
      ],
      [
        {
          id: 12,
          branchId: 1,
          batchCode: 'BTC-20260915-0001',
          poNumber: null,
          qtyReceived: '30',
          qtyRemaining: '30',
          costPrice: '10000',
          receivedAt: new Date('2026-09-15T00:00:00.000Z'),
          expiryDate: null,
        },
      ],
    )

    const detail = await getStockOverviewDetail(5)

    expect(detail?.branches).toHaveLength(2)
    const tokoDepan = detail?.branches.find((b) => b.branchId === 2)
    expect(tokoDepan).toMatchObject({
      branchName: 'Toko Depan',
      totalQty: '0',
      totalValue: '0',
      batchCount: 0,
      shortfallQty: '75',
      shortfallValue: '988425',
      batches: [],
    })
  })
})
