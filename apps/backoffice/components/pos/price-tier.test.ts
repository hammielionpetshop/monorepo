import { describe, it, expect } from 'vitest'
import { pickDisplayPrice, resolveTierForCustomer, tierRank } from './price-tier'
import type { BootstrapPrice } from './pos-client'

const BASE_UOM = 9   // KG
const CONV_UOM = 17  // SAK

const price = (uomId: number, tierType: string, value: string): BootstrapPrice => ({
  id: Math.random(),
  productId: 1,
  branchId: 3,
  uomId,
  tierType,
  price: value,
})

describe('tierRank', () => {
  it('mendahulukan RETAIL', () => {
    expect(tierRank('RETAIL')).toBeLessThan(tierRank('GROSIR'))
    expect(tierRank('GROSIR')).toBeLessThan(tierRank('RESELLER'))
  })

  it('menaruh tier tak dikenal di urutan terakhir', () => {
    expect(tierRank('ENTAH')).toBeGreaterThan(tierRank('PROMO'))
  })
})

describe('pickDisplayPrice', () => {
  it('mengembalikan null ketika produk benar-benar tidak punya harga', () => {
    expect(pickDisplayPrice([], BASE_UOM)).toBeNull()
  })

  it('memilih RETAIL di satuan dasar ketika tersedia', () => {
    const result = pickDisplayPrice(
      [
        price(CONV_UOM, 'RETAIL', '185000'),
        price(BASE_UOM, 'RESELLER', '6300'),
        price(BASE_UOM, 'RETAIL', '7000'),
      ],
      BASE_UOM
    )
    expect(result).toMatchObject({ uomId: BASE_UOM, tierType: 'RETAIL', price: '7000' })
  })

  it('jatuh ke tier lain pada satuan dasar ketika RETAIL tidak ada (kasus KURUNG AYAM BESAR)', () => {
    const result = pickDisplayPrice([price(BASE_UOM, 'RESELLER', '17000')], BASE_UOM)
    expect(result).toMatchObject({ uomId: BASE_UOM, tierType: 'RESELLER', price: '17000' })
  })

  it('jatuh ke satuan konversi ketika satuan dasar belum berharga (kasus HIPRO 781 -2)', () => {
    const result = pickDisplayPrice(
      [price(CONV_UOM, 'RESELLER', '409500'), price(CONV_UOM, 'RETAIL', '409500')],
      BASE_UOM
    )
    expect(result).toMatchObject({ uomId: CONV_UOM, tierType: 'RETAIL' })
  })

  it('selalu mendahulukan satuan dasar walau tier-nya lebih rendah prioritas', () => {
    const result = pickDisplayPrice(
      [price(CONV_UOM, 'RETAIL', '185000'), price(BASE_UOM, 'RESELLER', '6300')],
      BASE_UOM
    )
    expect(result).toMatchObject({ uomId: BASE_UOM, tierType: 'RESELLER' })
  })

  it('mendahulukan tier pelanggan di satuan dasar', () => {
    const result = pickDisplayPrice(
      [price(BASE_UOM, 'RETAIL', '7000'), price(BASE_UOM, 'RESELLER', '6300')],
      BASE_UOM,
      'RESELLER'
    )
    expect(result).toMatchObject({ tierType: 'RESELLER', price: '6300' })
  })

  it('tetap mendahulukan satuan dasar walau tier pelanggan ada di satuan konversi', () => {
    const result = pickDisplayPrice(
      [price(CONV_UOM, 'RESELLER', '185000'), price(BASE_UOM, 'RETAIL', '7000')],
      BASE_UOM,
      'RESELLER'
    )
    expect(result).toMatchObject({ uomId: BASE_UOM, tierType: 'RETAIL' })
  })

  it('tidak mengubah array masukan', () => {
    const prices = [price(BASE_UOM, 'RESELLER', '6300'), price(BASE_UOM, 'RETAIL', '7000')]
    const snapshot = prices.map(p => p.tierType)
    pickDisplayPrice(prices, BASE_UOM)
    expect(prices.map(p => p.tierType)).toEqual(snapshot)
  })
})

describe('resolveTierForCustomer', () => {
  it('memakai tier pelanggan ketika harganya ada', () => {
    expect(resolveTierForCustomer(['RETAIL', 'RESELLER'], 'RESELLER')).toEqual({
      tier: 'RESELLER',
      isFallback: false,
    })
  })

  it('jatuh ke RETAIL ketika tier pelanggan belum diisi, dan menandainya', () => {
    expect(resolveTierForCustomer(['RETAIL', 'GROSIR'], 'RESELLER')).toEqual({
      tier: 'RETAIL',
      isFallback: true,
    })
  })

  it('jatuh ke tier prioritas teratas ketika RETAIL pun tidak ada', () => {
    expect(resolveTierForCustomer(['DISTRIBUTOR', 'GROSIR'], 'RESELLER')).toEqual({
      tier: 'GROSIR',
      isFallback: true,
    })
  })

  it('tanpa pelanggan berperilaku seperti sebelumnya — tier prioritas teratas, bukan fallback', () => {
    expect(resolveTierForCustomer(['GROSIR', 'RETAIL'], null)).toEqual({
      tier: 'RETAIL',
      isFallback: false,
    })
    expect(resolveTierForCustomer(['RESELLER', 'GROSIR'], null)).toEqual({
      tier: 'GROSIR',
      isFallback: false,
    })
  })

  it('mengembalikan null ketika satuan itu tidak punya harga sama sekali', () => {
    expect(resolveTierForCustomer([], 'RESELLER')).toEqual({ tier: null, isFallback: false })
  })

  it('pelanggan RETAIL yang produknya hanya punya tier lain ikut ditandai', () => {
    expect(resolveTierForCustomer(['GROSIR'], 'RETAIL')).toEqual({
      tier: 'GROSIR',
      isFallback: true,
    })
  })
})
