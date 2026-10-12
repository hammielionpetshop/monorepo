import { describe, expect, it } from 'vitest'
import { buildGroomingCartItems, cartTotal, priceForTier, type IntakeLine, type ServiceOption } from './types'

const sehat: ServiceOption = { productId: 1, name: 'GROOMING SEHAT', uomId: 4, uomCode: 'EKR', tierPrices: { RETAIL: '40000' } }
const hotelish: ServiceOption = { productId: 2, name: 'GROOMING PREMIUM', uomId: 4, uomCode: 'EKR', tierPrices: { RETAIL: '100000', RESELLER: '90000' } }
const ongkir: ServiceOption = { productId: 9, name: 'ONGKIR', uomId: 7, uomCode: 'M', tierPrices: { RETAIL: '1000', RESELLER: '1000' } }
const pet = (id: number, name: string) => ({ id, name, species: 'Persia', color: 'putih', birthDate: null })
const line = (petId: number, name: string, service: ServiceOption, groomerId = 5): IntakeLine => ({
  pet: pet(petId, name), service, groomer: { id: groomerId, name: 'Dedi' }, condition: '  sehat  ',
})

describe('harga jasa mengikuti golongan pelanggan', () => {
  it('pakai harga golongan bila ada; kalau tidak, jatuh ke Retail', () => {
    expect(priceForTier(hotelish.tierPrices, 'RESELLER')).toEqual({ tier: 'RESELLER', price: '90000' })
    expect(priceForTier(sehat.tierPrices, 'RESELLER')).toEqual({ tier: 'RETAIL', price: '40000' })
    expect(priceForTier({}, 'RETAIL')).toBeNull()
  })
})

describe('baris nota dari Terima Kucing', () => {
  it('dua ekor dengan jasa yang sama tetap DUA baris qty 1, masing-masing membawa kucing & groomernya', () => {
    const items = buildGroomingCartItems([line(11, 'Mochi', sehat, 5), line(12, 'Oyen', sehat, 6)], 'RETAIL', null, ongkir)
    expect(items).toHaveLength(2)
    expect(items.map((i) => [i.qty, i.unitPrice, i.subtotal, i.grooming])).toEqual([
      [1, '40000', '40000', { petId: 11, groomerId: 5, condition: 'sehat' }],
      [1, '40000', '40000', { petId: 12, groomerId: 6, condition: 'sehat' }],
    ])
    expect(items[0].productName).toBe('GROOMING SEHAT - Mochi')
    expect(cartTotal(items)).toBe('80000')
  })

  it('delivery menambah SATU baris ongkir: qty × 1.000, membawa pengantar & alamat', () => {
    const items = buildGroomingCartItems(
      [line(11, 'Mochi', hotelish), line(12, 'Oyen', sehat)],
      'RESELLER',
      { courier: { id: 8, name: 'Ujang' }, address: ' Jl. Cikupang no. 12 ', qty: 15 },
      ongkir,
    )
    expect(items).toHaveLength(3)
    expect(items[0]).toMatchObject({ unitPrice: '90000', priceTier: 'RESELLER' })
    expect(items[1]).toMatchObject({ unitPrice: '40000', priceTier: 'RETAIL' })
    expect(items[2]).toMatchObject({
      productId: 9, qty: 15, unitPrice: '1000', subtotal: '15000', delivery: { courierId: 8, address: 'Jl. Cikupang no. 12' },
    })
    expect(items[2].grooming).toBeUndefined()
    expect(cartTotal(items)).toBe('145000')
  })

  it('delivery tanpa produk ongkir, atau jasa tanpa harga, ditolak dengan pesan jelas', () => {
    expect(() => buildGroomingCartItems([line(11, 'Mochi', sehat)], 'RETAIL', { courier: { id: 8, name: 'Ujang' }, address: 'Jl. A', qty: 10 }, null))
      .toThrow('Produk ongkos kirim belum tersedia')
    expect(() => buildGroomingCartItems([line(11, 'Mochi', { ...sehat, tierPrices: {} })], 'RETAIL', null, ongkir)).toThrow('belum punya harga')
  })
})

describe('gratis antar-jemput', () => {
  it('baris ongkir tercatat nilainya tetapi Rp 0 di nota, bertanda gratis', () => {
    const ongkir: ServiceOption = { productId: 9, name: 'ONGKIR', uomId: 2, uomCode: 'METER', tierPrices: { RETAIL: '1000' } }
    const pet = { id: 5, name: 'Mochi', species: 'Persia', color: 'putih', birthDate: null }
    const items = buildGroomingCartItems(
      [{ pet, service: sehat, groomer: { id: 3, name: 'Dedi' }, condition: 'sehat' }],
      'RETAIL',
      { courier: { id: 9, name: 'Ujang' }, address: 'Jl. Mawar 1', qty: 15, free: true },
      ongkir,
    )
    expect(items[1]).toMatchObject({ qty: 15, unitPrice: '1000', discountAmount: '15000', subtotal: '0', delivery: { courierId: 9, address: 'Jl. Mawar 1', freeShipping: true } })
    expect(cartTotal(items)).toBe('40000')
  })
})
