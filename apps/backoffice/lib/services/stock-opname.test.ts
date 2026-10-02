vi.mock('./stock-lock', () => ({ lockProductStocks: vi.fn().mockResolvedValue(undefined) }))
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Big from 'big.js'

vi.mock('@/lib/db', () => {
  const productStocks = { id: 'productStocks.id', productId: 'productStocks.productId', branchId: 'productStocks.branchId', uomId: 'productStocks.uomId', qty: 'productStocks.qty' }
  const productStockBatches = {
    id: 'productStockBatches.id',
    productId: 'productStockBatches.productId',
    branchId: 'productStockBatches.branchId',
    uomId: 'productStockBatches.uomId',
    qtyRemaining: 'productStockBatches.qtyRemaining',
    costPrice: 'productStockBatches.costPrice',
    receivedAt: 'productStockBatches.receivedAt',
  }
  const productUomConversions = { productId: 'productUomConversions.productId', uomId: 'productUomConversions.uomId', ratio: 'productUomConversions.ratio' }
  const products = { id: 'products.id', baseUomId: 'products.baseUomId', defaultCostPrice: 'products.defaultCostPrice' }

  return {
    db: {},
    sql: vi.fn((strings: unknown, ...values: unknown[]) => ({ strings, values })),
    eq: vi.fn((field, value) => ({ type: 'eq', field, value })),
    and: vi.fn((...conditions) => ({ type: 'and', conditions })),
    asc: vi.fn((field) => field),
    productStocks,
    productStockBatches,
    productUomConversions,
    products,
    stockOpnames: { id: 'stockOpnames.id', status: 'stockOpnames.status' },
    stockOpnameItems: { id: 'stockOpnameItems.id', soId: 'stockOpnameItems.soId', itemStatus: 'stockOpnameItems.itemStatus' },
  }
})

vi.mock('@petshop/shared/utils/fifo-shrinkage', () => ({
  calculateFIFOCost: vi.fn(),
}))

vi.mock('./stock-service', () => ({
  resolveFallbackCostPerBase: vi.fn(),
}))

import { calculateFIFOCost } from '@petshop/shared/utils/fifo-shrinkage'
import { resolveFallbackCostPerBase } from './stock-service'
import { products, productStockBatches, productStocks, productUomConversions } from '@/lib/db'
import { computeItemVariance } from './stock-opname'

const calculateFIFOCostMock = vi.mocked(calculateFIFOCost)
const resolveFallbackCostPerBaseMock = vi.mocked(resolveFallbackCostPerBase)

function createExecutor(opts: {
  stocks?: unknown[]
  itemRatio?: unknown[]
  batches?: unknown[]
  product?: unknown[]
}) {
  return {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (table === productStocks) {
          return { leftJoin: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(opts.stocks ?? [])) })) }
        }
        if (table === productUomConversions) {
          return { where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve(opts.itemRatio ?? [])) })) }
        }
        if (table === productStockBatches) {
          return { where: vi.fn(() => ({ orderBy: vi.fn(() => Promise.resolve(opts.batches ?? [])) })) }
        }
        if (table === products) {
          return { where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve(opts.product ?? [])) })) }
        }
        throw new Error(`unexpected table in test executor: ${String(table)}`)
      }),
    })),
  } as any
}

describe('computeItemVariance — fallback modal saat batch tak menutup selisih', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('FIFO menutup seluruh selisih → tidak memanggil fallback', async () => {
    calculateFIFOCostMock.mockReturnValue({
      totalCost: 5000,
      batchesUsed: [{ batchId: 1, qtyUsed: 5, costPrice: 1000, subtotal: 5000 }],
    })
    const executor = createExecutor({ itemRatio: [{ ratio: 1 }], batches: [{ id: 1, qtyRemaining: '5', costPrice: '1000', ratio: 1 }] })

    const result = await computeItemVariance(executor, 1, {
      productId: 7,
      uomId: 1,
      physicalQty: 0,
      systemQtyOverride: 5,
    })

    expect(result.varianceCostValue).toBe(5000)
    expect(resolveFallbackCostPerBaseMock).not.toHaveBeenCalled()
  })

  it('tidak ada batch berstok → seluruh selisih pakai fallback defaultCostPrice', async () => {
    calculateFIFOCostMock.mockReturnValue({ totalCost: 0, batchesUsed: [] })
    resolveFallbackCostPerBaseMock.mockResolvedValue(new Big(1500))
    const executor = createExecutor({
      itemRatio: [{ ratio: 1 }],
      batches: [],
      product: [{ baseUomId: 1, defaultCostPrice: 1500 }],
    })

    const result = await computeItemVariance(executor, 3, {
      productId: 9,
      uomId: 1,
      physicalQty: 0,
      systemQtyOverride: 5,
    })

    expect(result.varianceCostValue).toBe(7500)
    expect(resolveFallbackCostPerBaseMock).toHaveBeenCalledWith(executor, 3, 9, 1, 1500)
  })

  it('batch menutup sebagian → HPP = FIFO + porsi tak tertutup × fallback', async () => {
    calculateFIFOCostMock.mockReturnValue({
      totalCost: 2000,
      batchesUsed: [{ batchId: 1, qtyUsed: 2, costPrice: 1000, subtotal: 2000 }],
    })
    resolveFallbackCostPerBaseMock.mockResolvedValue(new Big(1000))
    const executor = createExecutor({
      itemRatio: [{ ratio: 1 }],
      batches: [{ id: 1, qtyRemaining: '2', costPrice: '1000', ratio: 1 }],
      product: [{ baseUomId: 1, defaultCostPrice: 1000 }],
    })

    const result = await computeItemVariance(executor, 1, {
      productId: 7,
      uomId: 1,
      physicalQty: 0,
      systemQtyOverride: 5,
    })

    expect(result.varianceCostValue).toBe(5000)
  })

  it('tanpa sumber modal sama sekali → nilai tetap dari FIFO, tidak error', async () => {
    calculateFIFOCostMock.mockReturnValue({ totalCost: 0, batchesUsed: [] })
    resolveFallbackCostPerBaseMock.mockResolvedValue(null)
    const executor = createExecutor({ itemRatio: [{ ratio: 1 }], batches: [], product: [{ baseUomId: 1, defaultCostPrice: null }] })

    const result = await computeItemVariance(executor, 1, {
      productId: 7,
      uomId: 1,
      physicalQty: 0,
      systemQtyOverride: 5,
    })

    expect(result.varianceCostValue).toBe(0)
  })
})

describe('computeItemVariance — batch qtyRemaining/costPrice sudah base UOM (bukan per uom batch)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // calculateFIFOCost ASLI dipakai di sini (bukan mock generik di atas) — tesnya justru
    // untuk menangkap regresi "qty dikali ratio, costPrice dibagi ratio lagi" yang lolos
    // waktu calculateFIFOCost di-mock generik (lihat commit yang membetulkan double-
    // conversion ini: mappedBatches sempat mengalikan qtyRemaining × ratio dan membagi
    // costPrice ÷ ratio, padahal keduanya SUDAH base UOM sejak disimpan).
    const actual = await vi.importActual<typeof import('@petshop/shared/utils/fifo-shrinkage')>(
      '@petshop/shared/utils/fifo-shrinkage'
    )
    calculateFIFOCostMock.mockImplementation(actual.calculateFIFOCost)
  })

  it('batch diterima per SAK (ratio besar) — qty & costPrice dipakai apa adanya, tidak dikonversi ulang', async () => {
    resolveFallbackCostPerBaseMock.mockResolvedValue(null)
    // Batch: qtyRemaining=50 (base unit, SUDAH benar), costPrice=7600 (SUDAH per base unit,
    // lihat StockService.addStock). Kalau kode masih mengalikan qty ×50 dan membagi cost ÷50,
    // hasilnya 1 unit selisih bakal dihargai 7600/50=152, bukan 7600.
    const executor = createExecutor({
      itemRatio: [{ ratio: 1 }],
      batches: [{ id: 1, qtyRemaining: '50', costPrice: '7600', ratio: 50 }],
    })

    const result = await computeItemVariance(executor, 4, {
      productId: 1612,
      uomId: 6,
      physicalQty: 0,
      systemQtyOverride: 1,
    })

    expect(result.varianceCostValue).toBe(7600)
  })

  it('batch base UOM langsung (ratio 1) — tidak berubah', async () => {
    resolveFallbackCostPerBaseMock.mockResolvedValue(null)
    const executor = createExecutor({
      itemRatio: [{ ratio: 1 }],
      batches: [{ id: 1, qtyRemaining: '10', costPrice: '3925' }],
    })

    const result = await computeItemVariance(executor, 4, {
      productId: 1612,
      uomId: 6,
      physicalQty: 0,
      systemQtyOverride: 2,
    })

    expect(result.varianceCostValue).toBe(2 * 3925)
  })

  it('selisih lebih besar dari 1 batch — FIFO jalan di atas qty base UOM yang benar, bukan qty × ratio', async () => {
    resolveFallbackCostPerBaseMock.mockResolvedValue(null)
    // qtyRemaining batch pertama cuma 3 (bukan 3×50=150) — kalau bug lama masih ada,
    // batch ini sendirian dianggap cukup untuk selisih 10 dan batch kedua tak tersentuh.
    const executor = createExecutor({
      itemRatio: [{ ratio: 1 }],
      batches: [
        { id: 1, qtyRemaining: '3', costPrice: '7600', ratio: 50 },
        { id: 2, qtyRemaining: '20', costPrice: '3925' },
      ],
    })

    const result = await computeItemVariance(executor, 4, {
      productId: 1612,
      uomId: 6,
      physicalQty: 0,
      systemQtyOverride: 10,
    })

    expect(result.varianceCostValue).toBe(3 * 7600 + 7 * 3925)
  })
})
