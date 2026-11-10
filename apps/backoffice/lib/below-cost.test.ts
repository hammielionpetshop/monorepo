import { describe, expect, it } from 'vitest'
import { BelowCostSaleError, findBelowCostLines, netUnitPrice, unitCostFor, type BelowCostLineInput } from './below-cost'

const line = (over: Partial<BelowCostLineInput> = {}): BelowCostLineInput => ({
  productId: 1,
  productName: 'MR VET PC OMEGA',
  uomId: 10,
  uomCode: 'PCS',
  qty: 2,
  unitPrice: 5000,
  discountAmount: 0,
  ...over,
})

describe('netUnitPrice', () => {
  it('potongan baris dibagi rata ke qty', () => {
    expect(netUnitPrice(line({ qty: 3, unitPrice: 5000, discountAmount: 1000 })).toFixed(2)).toBe('4666.67')
  })
  it('baris promo resmi memakai harga sebelum promo', () => {
    expect(netUnitPrice(line({ discountAmount: 4000, promo: { promoId: 1 } })).toNumber()).toBe(5000)
  })
})

describe('unitCostFor', () => {
  const ratios: Record<number, number> = { 20: 12 }
  const ratioOf = (u: number) => ratios[u] ?? null
  it('memakai modal satuan itu bila ada', () => {
    expect(unitCostFor([{ uomId: 20, costPrice: 50000 }], 20, 10, ratioOf)).toBe(50000)
  })
  it('satuan tanpa modal = modal satuan dasar × rasio', () => {
    expect(unitCostFor([{ uomId: 10, costPrice: 3750 }], 20, 10, ratioOf)).toBe(45000)
  })
  it('satuan dasar tanpa modal diturunkan dari satuan besar', () => {
    expect(unitCostFor([{ uomId: 20, costPrice: 45000 }], 10, 10, ratioOf)).toBe(3750)
  })
  it('modal tidak diketahui → null (tidak dicek)', () => {
    expect(unitCostFor([], 10, 10, ratioOf)).toBeNull()
    expect(unitCostFor([{ uomId: 10, costPrice: 0 }], 10, 10, ratioOf)).toBeNull()
  })
})

describe('findBelowCostLines', () => {
  const cost = (c: number | null) => () => c

  it('harga di atas atau sama dengan modal → lolos', () => {
    expect(findBelowCostLines([line()], cost(5000))).toEqual([])
    expect(findBelowCostLines([line()], cost(3750))).toEqual([])
  })

  it('harga di bawah modal → tercatat dengan rugi per baris', () => {
    const [found] = findBelowCostLines([line({ unitPrice: 4500, qty: 2 })], cost(5000))
    expect(found).toMatchObject({ netUnitPrice: 4500, unitCost: 5000, loss: 1000, qty: 2 })
  })

  it('diskon manual yang membuat harga bersih di bawah modal → tertangkap', () => {
    const [found] = findBelowCostLines([line({ unitPrice: 5500, qty: 2, discountAmount: 2000 })], cost(5000))
    expect(found).toMatchObject({ netUnitPrice: 4500, loss: 1000 })
  })

  it('promo resmi boleh di bawah modal', () => {
    expect(findBelowCostLines([line({ unitPrice: 5500, discountAmount: 3000, promo: { promoId: 7 } })], cost(5000))).toEqual([])
  })

  it('modal tidak diketahui → tidak dicek', () => {
    expect(findBelowCostLines([line({ unitPrice: 1 })], cost(null))).toEqual([])
  })

  it('pesan kasir menyebut barang, harga, dan modal', () => {
    const err = new BelowCostSaleError(findBelowCostLines([line({ unitPrice: 4500 })], cost(5000)))
    expect(err.message).toContain('hubungi kantor')
    expect(err.message).toContain('MR VET PC OMEGA: harga Rp 4.500/PCS, modal Rp 5.000/PCS')
    expect(err.code).toBe('BELOW_COST')
  })
})
