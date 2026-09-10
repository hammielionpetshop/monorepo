import { describe, expect, it } from 'vitest'
import {
  buildInternalPoCartItems,
  internalPoQtyStrategies,
  type InternalPoItem,
} from './internal-po-cart-items'

function poItem(overrides: Partial<InternalPoItem> = {}): InternalPoItem {
  return {
    id: 1,
    productId: 100,
    productName: 'Produk A',
    uomId: 9,
    uomCode: 'DUS',
    qtyRequested: 10,
    currentQty: 4,
    retailPrice: 120000,
    tierPrices: { RETAIL: 120000, GROSIR: 110000 },
    insufficient: true,
    ...overrides,
  }
}

describe('buildInternalPoCartItems', () => {
  it('membawa SEMUA tier harga (bukan cuma RETAIL) supaya Ubah Tier tetap jalan', () => {
    const [item] = buildInternalPoCartItems([poItem({ insufficient: false })], internalPoQtyStrategies.requested)
    expect(item.tierPrices).toEqual({ RETAIL: '120000', GROSIR: '110000' })
    expect(item.priceTier).toBe('RETAIL')
    expect(item.unitPrice).toBe('120000')
    expect(item.subtotal).toBe('1200000') // 120000 × 10
  })

  it('default ke tier pertama bila produk tak punya harga RETAIL', () => {
    const [item] = buildInternalPoCartItems(
      [poItem({ insufficient: false, retailPrice: null, tierPrices: { GROSIR: 110000 } })],
      internalPoQtyStrategies.requested,
    )
    expect(item.priceTier).toBe('GROSIR')
    expect(item.unitPrice).toBe('110000')
  })

  it('produk tanpa harga sama sekali → RETAIL @ 0', () => {
    const [item] = buildInternalPoCartItems(
      [poItem({ insufficient: false, retailPrice: null, tierPrices: {} })],
      internalPoQtyStrategies.requested,
    )
    expect(item.priceTier).toBe('RETAIL')
    expect(item.unitPrice).toBe('0')
    expect(item.tierPrices).toEqual({})
  })

  describe('strategi qty saat stok kurang', () => {
    const items = [
      poItem({ id: 1, productId: 1, qtyRequested: 10, currentQty: 4, insufficient: true }),
      poItem({ id: 2, productId: 2, qtyRequested: 3, currentQty: 0, insufficient: true }),
      poItem({ id: 3, productId: 3, qtyRequested: 5, currentQty: 8, insufficient: false }),
    ]

    it('requested: semua item, qty diminta apa adanya (oversell)', () => {
      const out = buildInternalPoCartItems(items, internalPoQtyStrategies.requested)
      expect(out.map((i) => [i.productId, i.qty])).toEqual([
        [1, 10],
        [2, 3],
        [3, 5],
      ])
    })

    it('available: item kurang diturunkan ke stok tersedia, yang kosong dilewati', () => {
      const out = buildInternalPoCartItems(items, internalPoQtyStrategies.available)
      expect(out.map((i) => [i.productId, i.qty])).toEqual([
        [1, 4],
        [3, 5],
      ])
    })

    it('dropShort: hanya item yang stoknya cukup', () => {
      const out = buildInternalPoCartItems(items, internalPoQtyStrategies.dropShort)
      expect(out.map((i) => [i.productId, i.qty])).toEqual([[3, 5]])
    })
  })
})
