import { describe, expect, it } from 'vitest'
import { buildOngkirCartItem, ongkirAmountProblem } from './delivery-step-model'

const ongkir = { productId: 9, name: 'Ongkir', uomId: 1, uomCode: 'PCS', tierPrices: { RETAIL: '1000' } }
const courier = { method: 'BRANCH_COURIER' as const, courierId: 3, courierName: 'Budi', amount: 15000, free: false }

describe('langkah Pengiriman: baris ongkir', () => {
  it('nilai ongkir jadi qty × harga per qty', () => {
    const line = buildOngkirCartItem(ongkir, 'RETAIL', courier, 10000)
    expect(line).toMatchObject({ productId: 9, qty: 15, unitPrice: '1000', subtotal: '15000', productKind: 'JASA_ONGKIR' })
    expect(line.delivery).toBeUndefined()
  })

  it('golongan tanpa harga jatuh ke RETAIL', () => {
    expect(buildOngkirCartItem(ongkir, 'GROSIR', courier, 10000)).toMatchObject({ priceTier: 'RETAIL', qty: 15 })
  })

  it('gratis ongkir memakai nilai standar', () => {
    expect(buildOngkirCartItem(ongkir, 'RETAIL', { ...courier, amount: 0, free: true }, 10000)).toMatchObject({ qty: 10 })
  })

  it('nilai harus kelipatan harga dan lebih dari 0', () => {
    expect(ongkirAmountProblem(10000, 1000)).toBeNull()
    expect(ongkirAmountProblem(0, 1000)).toMatch(/Gratis ongkir/)
    expect(ongkirAmountProblem(10500, 1000)).toMatch(/kelipatan/)
    expect(ongkirAmountProblem(10000, 0)).toMatch(/belum diisi/)
  })
})
