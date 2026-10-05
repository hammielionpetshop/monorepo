import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({
  transactionItems: {},
  products: {},
  productUomConversions: {},
  eq: vi.fn(),
  inArray: vi.fn(),
}))

import { planIbtPriceSync } from './ibt-bulk-sale-match'

// Produk 1: PCS (base, id 1), SAK (id 2) = 25 PCS. Produk 2: base SAK (id 2).
const ratioMap = new Map<string, number>([
  ['1-1', 1],
  ['1-2', 25],
  ['2-2', 1],
  ['3-1', 1],
  ['3-2', 10],
])
const baseUomByProduct = new Map<number, number>([
  [1, 1],
  [2, 2],
  [3, 1],
])

describe('planIbtPriceSync (kanban #43)', () => {
  it('satuan sama: harga = harga jual nota per satuan itu', () => {
    const plan = planIbtPriceSync(
      [{ id: 10, productId: 2, uomId: 2 }],
      [{ productId: 2, uomId: 2, qty: 5, lineTotal: 2075000 }],
      ratioMap,
      baseUomByProduct,
    )
    expect(plan.updates).toEqual([{ id: 10, costPriceAtTransfer: 415000 }])
    expect(plan.inserts).toEqual([])
  })

  it('dipesan PCS, dijual SAK: harga dikonversi ke per PCS (IBT-20260903-0005)', () => {
    const plan = planIbtPriceSync(
      [{ id: 10, productId: 1, uomId: 1 }],
      [{ productId: 1, uomId: 2, qty: 1, lineTotal: 406000 }],
      ratioMap,
      baseUomByProduct,
    )
    // 1 SAK = 25 PCS → 406.000 / 25 = 16.240 per PCS. Piutang 25 PCS × 16.240 = 406.000 = nota.
    expect(plan.updates).toEqual([{ id: 10, costPriceAtTransfer: 16240 }])
  })

  it('diskon baris ikut: harga = nilai bersih nota', () => {
    const plan = planIbtPriceSync(
      [{ id: 10, productId: 2, uomId: 2 }],
      [{ productId: 2, uomId: 2, qty: 4, lineTotal: 400000 - 20000 }],
      ratioMap,
      baseUomByProduct,
    )
    expect(plan.updates).toEqual([{ id: 10, costPriceAtTransfer: 95000 }])
  })

  it('produk di nota tapi tidak di PO Internal: jadi baris baru (IBT-20260915-0001)', () => {
    const plan = planIbtPriceSync(
      [{ id: 10, productId: 2, uomId: 2 }],
      [
        { productId: 2, uomId: 2, qty: 1, lineTotal: 415000 },
        { productId: 1, uomId: 2, qty: 2, lineTotal: 965000 },
      ],
      ratioMap,
      baseUomByProduct,
    )
    expect(plan.inserts).toEqual([{ productId: 1, uomId: 2, costPriceAtTransfer: 482500 }])
  })

  it('produk tambahan dijual dalam dua satuan: baris baru memakai satuan dasar', () => {
    const plan = planIbtPriceSync(
      [],
      [
        { productId: 3, uomId: 2, qty: 1, lineTotal: 100000 },
        { productId: 3, uomId: 1, qty: 5, lineTotal: 50000 },
      ],
      ratioMap,
      baseUomByProduct,
    )
    // 150.000 / (10 + 5) = 10.000 per PCS
    expect(plan.inserts).toEqual([{ productId: 3, uomId: 1, costPriceAtTransfer: 10000 }])
  })

  it('produk dipesan tapi tidak terjual: harga tidak diubah', () => {
    const plan = planIbtPriceSync([{ id: 10, productId: 2, uomId: 2 }], [], ratioMap, baseUomByProduct)
    expect(plan).toEqual({ updates: [], inserts: [] })
  })

  it('satuan jual tanpa konversi diabaikan, bukan crash', () => {
    const plan = planIbtPriceSync(
      [{ id: 10, productId: 1, uomId: 1 }],
      [{ productId: 1, uomId: 99, qty: 1, lineTotal: 5000 }],
      ratioMap,
      baseUomByProduct,
    )
    expect(plan).toEqual({ updates: [], inserts: [] })
  })
})
