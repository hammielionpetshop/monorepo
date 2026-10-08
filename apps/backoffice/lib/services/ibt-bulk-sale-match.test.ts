import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({
  transactionItems: {},
  returnItems: {},
  products: {},
  productUomConversions: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  inArray: vi.fn(),
}))

import { allocateIbtShortage, resolveBulkSaleQtyByItem } from './ibt-bulk-sale-match'

// Urutan select di helper: transactionItems → products → productUomConversions.
function fakeDb(
  soldItems: { productId: number; uomId: number; qty: number }[],
  productRows: { id: number; baseUomId: number }[],
  convRows: { productId: number; uomId: number; ratio: number }[]
) {
  const queue: unknown[] = [soldItems, productRows, convRows]
  return {
    select: () => ({ from: () => ({ where: () => Promise.resolve(queue.shift()) }) }),
  }
}

const PCS = 15
const DUS = 3

describe('resolveBulkSaleQtyByItem', () => {
  it('tidak menyalin qty terjual ke dua baris produk yang sama (IBT-20261001-0001)', async () => {
    const db = fakeDb(
      [{ productId: 2523, uomId: DUS, qty: 1 }],
      [{ id: 2523, baseUomId: PCS }],
      [{ productId: 2523, uomId: DUS, ratio: 28 }]
    )
    const result = await resolveBulkSaleQtyByItem(db, 1, [
      { id: 3362, productId: 2523, uomId: DUS, qtyRequested: 3 },
      { id: 3373, productId: 2523, uomId: DUS, qtyRequested: 2 },
    ])
    expect(result.get(3362)).toBe(1)
    expect(result.get(3373)).toBe(0)
  })

  it('mengisi baris pertama sampai qty request, sisanya ke baris berikutnya', async () => {
    const db = fakeDb(
      [{ productId: 1, uomId: DUS, qty: 4 }],
      [{ id: 1, baseUomId: PCS }],
      [{ productId: 1, uomId: DUS, ratio: 10 }]
    )
    const result = await resolveBulkSaleQtyByItem(db, 1, [
      { id: 1, productId: 1, uomId: DUS, qtyRequested: 3 },
      { id: 2, productId: 1, uomId: DUS, qtyRequested: 2 },
    ])
    expect(result.get(1)).toBe(3)
    expect(result.get(2)).toBe(1)
  })

  it('baris satuan berbeda: satuan besar dulu, pecahan jatuh ke satuan kecil tanpa hilang', async () => {
    const db = fakeDb(
      [{ productId: 1, uomId: PCS, qty: 33 }],
      [{ id: 1, baseUomId: PCS }],
      [{ productId: 1, uomId: DUS, ratio: 28 }]
    )
    const result = await resolveBulkSaleQtyByItem(db, 1, [
      { id: 1, productId: 1, uomId: PCS, qtyRequested: 5 },
      { id: 2, productId: 1, uomId: DUS, qtyRequested: 1 },
    ])
    expect(result.get(2)).toBe(1)
    expect(result.get(1)).toBe(5)
  })

  it('baris tunggal tetap menerima seluruh qty terjual walau melebihi request', async () => {
    const db = fakeDb(
      [{ productId: 1, uomId: PCS, qty: 7 }],
      [{ id: 1, baseUomId: PCS }],
      []
    )
    const result = await resolveBulkSaleQtyByItem(db, 1, [{ id: 1, productId: 1, uomId: PCS, qtyRequested: 5 }])
    expect(result.get(1)).toBe(7)
  })

  it('produk yang tidak terjual bernilai 0', async () => {
    const db = fakeDb([], [{ id: 1, baseUomId: PCS }], [])
    const result = await resolveBulkSaleQtyByItem(db, 1, [{ id: 1, productId: 1, uomId: PCS, qtyRequested: 5 }])
    expect(result.get(1)).toBe(0)
  })
})

describe('allocateIbtShortage — selisih terima IBT jadi retur nota (kanban #56)', () => {
  const ratios = new Map([
    ['1-' + PCS, 1],
    ['1-' + DUS, 24],
  ])

  it('kurang 1 DUS dari nota per DUS → retur 1 DUS (IBT-20261006-0004)', () => {
    expect(
      allocateIbtShortage([{ productId: 1, uomId: DUS, qty: 1 }], [{ id: 10, productId: 1, uomId: DUS, returnableQty: 2 }], ratios),
    ).toEqual([{ transactionItemId: 10, qty: 1 }])
  })

  it('nota per PCS, selisih per DUS → dikonversi ke PCS', () => {
    expect(
      allocateIbtShortage([{ productId: 1, uomId: DUS, qty: 1 }], [{ id: 10, productId: 1, uomId: PCS, returnableQty: 48 }], ratios),
    ).toEqual([{ transactionItemId: 10, qty: 24 }])
  })

  it('satuan terbesar diisi dulu, sisanya ke baris satuan kecil', () => {
    expect(
      allocateIbtShortage(
        [{ productId: 1, uomId: PCS, qty: 30 }],
        [
          { id: 10, productId: 1, uomId: PCS, returnableQty: 10 },
          { id: 11, productId: 1, uomId: DUS, returnableQty: 1 },
        ],
        ratios,
      ),
    ).toEqual([
      { transactionItemId: 11, qty: 1 },
      { transactionItemId: 10, qty: 6 },
    ])
  })

  it('tidak bisa dinyatakan utuh (kurang PCS, nota per DUS) → null', () => {
    expect(
      allocateIbtShortage([{ productId: 1, uomId: PCS, qty: 1 }], [{ id: 10, productId: 1, uomId: DUS, returnableQty: 2 }], ratios),
    ).toBeNull()
  })

  it('melebihi sisa yang bisa diretur → null', () => {
    expect(
      allocateIbtShortage([{ productId: 1, uomId: DUS, qty: 3 }], [{ id: 10, productId: 1, uomId: DUS, returnableQty: 2 }], ratios),
    ).toBeNull()
  })

  it('tanpa selisih → daftar kosong', () => {
    expect(allocateIbtShortage([], [{ id: 10, productId: 1, uomId: DUS, returnableQty: 2 }], ratios)).toEqual([])
  })
})
