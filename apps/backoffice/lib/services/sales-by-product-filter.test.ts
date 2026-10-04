import { describe, expect, it } from 'vitest'
import { buildSalesByProductSearch, parseSalesByProductQuery } from './sales-by-product-filter'

describe('parseSalesByProductQuery', () => {
  it('membaca daftar produk dipisah koma, membuang yang tidak valid dan duplikat', () => {
    const q = parseSalesByProductQuery({ productIds: '3,abc,5,3, 7' })
    expect(q.productIds).toEqual([3, 5, 7])
  })

  it('tetap menerima productId tunggal dari tautan lama', () => {
    expect(parseSalesByProductQuery({ productId: '12' }).productIds).toEqual([12])
  })

  it('hanya menerima tier RETAIL/GROSIR/RESELLER', () => {
    expect(parseSalesByProductQuery({ priceTier: 'GROSIR' }).priceTier).toBe('GROSIR')
    expect(parseSalesByProductQuery({ priceTier: 'PROMO' }).priceTier).toBeNull()
  })

  it('id kategori/brand non-angka diabaikan', () => {
    const q = parseSalesByProductQuery({ categoryId: '4', brandId: 'x' })
    expect(q.categoryId).toBe(4)
    expect(q.brandId).toBeNull()
  })
})

describe('buildSalesByProductSearch', () => {
  it('bolak-balik dengan parser', () => {
    const query = {
      productIds: [1, 2],
      categoryId: 3,
      brandId: null,
      priceTier: 'RESELLER' as const,
      branchId: 9,
      customerId: null,
    }
    const search = buildSalesByProductSearch(query)
    expect(search.get('productIds')).toBe('1,2')
    expect(search.has('brandId')).toBe(false)
    expect(parseSalesByProductQuery(Object.fromEntries(search))).toEqual(query)
  })
})
