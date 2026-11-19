import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({}))

import { findItemsWithInvalidUom, mergeDuplicateTransferItems } from './internal-transfer-items-service'

describe('mergeDuplicateTransferItems', () => {
  it('menggabungkan produk + satuan yang sama dan menjumlah qty', () => {
    const result = mergeDuplicateTransferItems([
      { productId: 2523, uomId: 3, qtyRequested: 3, costPrice: 160000 },
      { productId: 1, uomId: 3, qtyRequested: 1, costPrice: 5000 },
      { productId: 2523, uomId: 3, qtyRequested: 2, costPrice: 160000 },
    ])
    expect(result).toEqual([
      { productId: 2523, uomId: 3, qtyRequested: 5, costPrice: 160000 },
      { productId: 1, uomId: 3, qtyRequested: 1, costPrice: 5000 },
    ])
  })

  it('produk sama dengan satuan berbeda tetap dua baris', () => {
    const result = mergeDuplicateTransferItems([
      { productId: 1, uomId: 3, qtyRequested: 1, costPrice: 100 },
      { productId: 1, uomId: 15, qtyRequested: 5, costPrice: 4 },
    ])
    expect(result).toHaveLength(2)
  })

  it('modal 0 di baris pertama diisi dari baris kembar yang bermodal', () => {
    const result = mergeDuplicateTransferItems([
      { productId: 1, uomId: 3, qtyRequested: 1, costPrice: 0 },
      { productId: 1, uomId: 3, qtyRequested: 1, costPrice: 700 },
    ])
    expect(result).toEqual([{ productId: 1, uomId: 3, qtyRequested: 2, costPrice: 700 }])
  })
})

describe('findItemsWithInvalidUom', () => {
  // VITACIK: dasar Pieces (15), konversi Dus (3); Box (1) tidak dimiliki
  const baseUomByProduct = new Map([[2495, 15]])
  const conversionKeys = new Set(['2495-3'])

  it('menerima satuan dasar dan satuan konversi milik produk', () => {
    const items = [
      { productId: 2495, uomId: 15 },
      { productId: 2495, uomId: 3 },
    ]
    expect(findItemsWithInvalidUom(items, baseUomByProduct, conversionKeys)).toEqual([])
  })

  it('menandai satuan yang tidak dimiliki produk', () => {
    const items = [
      { productId: 2495, uomId: 15 },
      { productId: 2495, uomId: 1 },
    ]
    expect(findItemsWithInvalidUom(items, baseUomByProduct, conversionKeys)).toEqual([{ productId: 2495, uomId: 1 }])
  })

  it('melewati produk yang tidak ditemukan (ditangani pemanggil)', () => {
    expect(findItemsWithInvalidUom([{ productId: 9999, uomId: 1 }], baseUomByProduct, conversionKeys)).toEqual([])
  })
})
