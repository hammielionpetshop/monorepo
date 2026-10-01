import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({}))

import { mergeDuplicateTransferItems } from './internal-transfer-items-service'

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
