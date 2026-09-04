import { beforeEach, describe, expect, it, vi } from 'vitest'

const { selectQueues, insertValues, updateSets, resolveCostMock, sqlMock } = vi.hoisted(() => {
  const selectQueues: unknown[][] = []
  const insertValues: unknown[] = []
  const updateSets: unknown[] = []
  const resolveCostMock = vi.fn().mockResolvedValue('0')
  const sqlMock = vi.fn().mockReturnValue('sql')
  return { selectQueues, insertValues, updateSets, resolveCostMock, sqlMock }
})

vi.mock('./services/stock-service', () => ({
  InsufficientStockError: class InsufficientStockError extends Error {
    productId: number
    shortfallQty: number
    constructor(message: string, productId: number, shortfallQty: number) {
      super(message)
      this.name = 'InsufficientStockError'
      this.productId = productId
      this.shortfallQty = shortfallQty
    }
  },
  resolveInboundCostPrice: resolveCostMock,
}))

vi.mock('./db', () => ({
  db: { transaction: vi.fn() },
  products: {
    id: 'products.id',
    baseUomId: 'products.base_uom_id',
  },
  productUomConversions: {
    productId: 'product_uom_conversions.product_id',
    uomId: 'product_uom_conversions.uom_id',
    ratio: 'product_uom_conversions.ratio',
  },
  productStocks: {
    id: 'product_stocks.id',
    productId: 'product_stocks.product_id',
    branchId: 'product_stocks.branch_id',
    uomId: 'product_stocks.uom_id',
    qty: 'product_stocks.qty',
  },
  productStockBatches: {
    id: 'product_stock_batches.id',
    productId: 'product_stock_batches.product_id',
    branchId: 'product_stock_batches.branch_id',
    qtyRemaining: 'product_stock_batches.qty_remaining',
    costPrice: 'product_stock_batches.cost_price',
    receivedAt: 'product_stock_batches.received_at',
  },
  auditLogs: {},
  stockAdjustments: {},
  productUomCosts: {
    productId: 'product_uom_costs.product_id',
    branchId: 'product_uom_costs.branch_id',
    uomId: 'product_uom_costs.uom_id',
    costPrice: 'product_uom_costs.cost_price',
  },
  eq: vi.fn().mockReturnValue('eq'),
  and: vi.fn().mockReturnValue('and'),
  desc: vi.fn().mockReturnValue('desc'),
  asc: vi.fn().mockReturnValue('asc'),
  sql: sqlMock,
}))

import { applyManualStockAdjustment, applySOStockAdjustment, type Tx } from './stock-adjustment'

/**
 * `.for('update')` di kode nyata dipakai dua pola: langsung di-await apa adanya
 * (lock kosong, pola lama di `applyManualStockAdjustment` — tidak menarik antrean),
 * atau dirantai lagi dengan `.limit()` (lock + baca satu baris, dipakai rekonsiliasi
 * SO) — thenable manual ini melayani keduanya tanpa saling tabrak.
 */
function forChain() {
  return {
    then(resolve: (value: unknown) => void) {
      resolve([])
    },
    limit: vi.fn(() => Promise.resolve(selectQueues.shift() ?? [])),
  }
}

function makeTx(): Tx {
  const tx = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          for: vi.fn(() => forChain()),
          limit: vi.fn(() => Promise.resolve(selectQueues.shift() ?? [])),
          orderBy: vi.fn().mockReturnValue({
            for: vi.fn(() => Promise.resolve(selectQueues.shift() ?? [])),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn((value) => {
        insertValues.push(value)
        // Dipakai dua pola: di-await langsung (auditLogs, dst — resolve ke objek ini
        // apa adanya) atau dirantai `.returning()` (stockAdjustments, untuk dapat id-nya).
        return { returning: vi.fn(() => Promise.resolve([{ id: 1 }])) }
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn((value) => {
        updateSets.push(value)
        return { where: vi.fn().mockResolvedValue([]) }
      }),
    }),
  }

  return tx as unknown as Tx
}

describe('stock adjustment default UOM costs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueues.length = 0
    insertValues.length = 0
    updateSets.length = 0
    resolveCostMock.mockResolvedValue('0')
    sqlMock.mockReturnValue('sql')
  })

  it('manual stock addition uses default UOM cost when explicit cost is omitted', async () => {
    selectQueues.push([{ costPrice: 22000 }], [])
    const tx = makeTx()

    await applyManualStockAdjustment(tx, {
      productId: 7,
      branchId: 2,
      uomId: 10,
      previousQty: '5',
      newQty: '8',
      reason: 'Koreksi stok masuk',
      adjustedById: 3,
    })

    expect(insertValues[0]).toMatchObject({ costPrice: 22000 })
  })

  it('manual stock addition keeps explicit cost when provided', async () => {
    selectQueues.push([])
    const tx = makeTx()

    await applyManualStockAdjustment(tx, {
      productId: 7,
      branchId: 2,
      uomId: 10,
      previousQty: '5',
      newQty: '8',
      reason: 'Koreksi stok masuk',
      adjustedById: 3,
      costPricePerUnit: 19000,
    })

    expect(insertValues[0]).toMatchObject({ costPrice: 19000 })
  })
})

describe('applySOStockAdjustment — rekonsiliasi batch ke agregat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueues.length = 0
    insertValues.length = 0
    updateSets.length = 0
    resolveCostMock.mockResolvedValue('0')
    sqlMock.mockReturnValue('sql')
  })

  it('selisih positif tanpa drift lama: batch ditambah sebesar variance saja', async () => {
    // products.baseUomId sama dengan uomId hitungan → lewati lookup rasio konversi
    selectQueues.push(
      [{ baseUomId: 10 }], // products
      [{ id: 55, qty: 5 }], // productStocks (aggBefore = 5)
      [{ id: 1, qtyRemaining: 5, costPrice: 1000, receivedAt: new Date('2026-01-01') }], // productStockBatches (batchBefore = 5, selaras dengan agregat)
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 7,
      branchId: 2,
      uomId: 10,
      systemQty: 5,
      physicalQty: 8, // variance = +3
      currentUserId: 3,
    })

    expect(updateSets).toContainEqual({ qty: 8 }) // targetAgg = 5 + 3
    expect(insertValues).toContainEqual(
      expect.objectContaining({ qtyReceived: 3, qtyRemaining: 3 })
    )
  })

  it('selisih positif DENGAN drift lama (stok minus tanpa batch): batch direkonsiliasi ke target agregat, bukan cuma ditambah variance', async () => {
    // Kasus nyata: product_stocks sudah -2 tanpa batch pendukung sama sekali.
    // Hitung fisik = 5, systemQty snapshot = 0 → variance = +5.
    // Agregat sesudah = -2 + 5 = 3 (benar). Batch HARUS ikut jadi 3, bukan 0 + 5 = 5.
    selectQueues.push(
      [{ baseUomId: 9 }], // products, baseUomId sama dengan item.uomId
      [{ id: 88, qty: -2 }], // productStocks (aggBefore = -2)
      [], // productStockBatches (batchBefore = 0, tidak ada batch sama sekali)
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 1572,
      branchId: 1,
      uomId: 9,
      systemQty: 0,
      physicalQty: 5,
      currentUserId: 3,
    })

    expect(updateSets).toContainEqual({ qty: 3 }) // targetAgg = -2 + 5
    // Batch koreksi harus 3 (menyamai agregat), BUKAN 5 (variance mentah) —
    // ini persis bug yang bikin Nilai Stok (5) beda dari POS (3).
    expect(insertValues).toContainEqual(
      expect.objectContaining({ qtyReceived: 3, qtyRemaining: 3 })
    )
    expect(insertValues.some((v) => (v as { qtyReceived?: number }).qtyReceived === 5)).toBe(false)
  })

  it('selisih negatif: batch dikurangi FIFO sampai sejumlah kebutuhan rekonsiliasi', async () => {
    // aggBefore=10, batchBefore=12 (drift +2), variance=-4 → targetAgg=6, batchDelta=6-12=-6
    selectQueues.push(
      [{ baseUomId: 9 }],
      [{ id: 12, qty: 10 }],
      [
        { id: 201, qtyRemaining: 12, costPrice: 1000, receivedAt: new Date('2026-01-01') },
      ],
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 50,
      branchId: 1,
      uomId: 9,
      systemQty: 10,
      physicalQty: 6, // variance = -4
      currentUserId: 3,
    })

    expect(updateSets).toContainEqual({ qty: 6 })
    // Deduksi FIFO lewat sql`` — cek argumen kedua (qtyDeducted) yang dikirim ke tag sql
    const deductCall = sqlMock.mock.calls.find((call) => call[2] === 6)
    expect(deductCall).toBeDefined()
  })

  it('selisih 0 dengan batch kelebihan: batch tetap dipangkas ke agregat, tidak dilewati', async () => {
    // Inti bug lama: hitungan fisik cocok (variance 0) → item di-skip, padahal justru
    // di sinilah agregat terbukti benar dan batch yang menyimpang harus mengikuti.
    // aggBefore=10, batchBefore=25 → targetAgg tetap 10, batch dipangkas 15.
    selectQueues.push(
      [{ baseUomId: 9 }],
      [{ id: 12, qty: 10 }],
      [{ id: 201, qtyRemaining: 25, costPrice: 1000, receivedAt: new Date('2026-01-01') }],
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 50,
      branchId: 1,
      uomId: 9,
      systemQty: 10,
      physicalQty: 10, // variance = 0
      currentUserId: 3,
    })

    expect(updateSets).toContainEqual({ qty: 10 })
    expect(sqlMock.mock.calls.find((call) => call[2] === 15)).toBeDefined()
  })

  it('selisih 0 dan sudah sejajar: tidak menyentuh batch maupun log audit', async () => {
    selectQueues.push(
      [{ baseUomId: 9 }],
      [{ id: 12, qty: 10 }],
      [{ id: 201, qtyRemaining: 10, costPrice: 1000, receivedAt: new Date('2026-01-01') }],
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 50,
      branchId: 1,
      uomId: 9,
      systemQty: 10,
      physicalQty: 10,
      currentUserId: 3,
    })

    expect(insertValues).toHaveLength(0)
  })

  it('selisih 0 dengan agregat minus warisan: tidak melempar, agregat disamakan ke batch', async () => {
    // aggBefore=-5 tanpa batch sama sekali. Kalau ini dilempar, SATU produk bisa
    // membatalkan approval seluruh SO — padahal justru inilah yang perlu dibersihkan.
    selectQueues.push(
      [{ baseUomId: 9 }],
      [{ id: 12, qty: -5 }],
      [],
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 50,
      branchId: 1,
      uomId: 9,
      systemQty: -5,
      physicalQty: -5, // variance = 0
      currentUserId: 3,
    })

    // targetAgg awalnya -5, lalu disamakan ke sisa batch (0) karena batch tak sanggup turun
    expect(updateSets).toContainEqual({ qty: 0 })
  })

  it('selisih negatif tapi batch tidak cukup untuk menutup rekonsiliasi: lempar InsufficientStockError', async () => {
    // aggBefore=3, variance=-10 → targetAgg=-7 (fisik ternyata kosong/minus setelah
    // dikurangi pergerakan). Batch cuma nyimpan 2 — tidak mungkin dikurangi sampai
    // negatif, jadi rekonsiliasi ini wajib gagal, bukan diam-diam melampaui 0.
    selectQueues.push(
      [{ baseUomId: 9 }],
      [{ id: 12, qty: 3 }],
      [{ id: 201, qtyRemaining: 2, costPrice: 1000, receivedAt: new Date('2026-01-01') }],
    )
    const tx = makeTx()

    await expect(
      applySOStockAdjustment(tx, {
        productId: 50,
        branchId: 1,
        uomId: 9,
        systemQty: 13,
        physicalQty: 3,
        currentUserId: 3,
      })
    ).rejects.toThrow(/Stok tidak cukup/)
  })
})
