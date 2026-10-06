import { describe, expect, it } from 'vitest'
import { defaultUnitCost, effectiveUnitCost, isPricePending, pickDefaultUom, type PoProductUom } from './po-item-defaults'

const KG: PoProductUom = { uomId: 1, code: 'KG', ratio: 1, isBase: true, cost: null }
const SAK: PoProductUom = { uomId: 2, code: 'SAK', ratio: 25, isBase: false, cost: null }
const BAL: PoProductUom = { uomId: 3, code: 'BAL', ratio: 5, isBase: false, cost: null }

describe('pickDefaultUom', () => {
  it('memilih satuan terbesar', () => {
    expect(pickDefaultUom([KG, BAL, SAK])?.code).toBe('SAK')
  })

  it('produk satu satuan → satuan dasar', () => {
    expect(pickDefaultUom([KG])?.code).toBe('KG')
  })

  it('tanpa satuan → null', () => {
    expect(pickDefaultUom([])).toBeNull()
  })
})

describe('defaultUnitCost', () => {
  it('memakai modal tersimpan satuan itu', () => {
    expect(defaultUnitCost([KG, { ...SAK, cost: 420000 }], 2)).toBe(420000)
  })

  it('satuan besar belum bermodal → dikali rasio dari modal satuan dasar', () => {
    expect(defaultUnitCost([{ ...KG, cost: 16800 }, SAK], 2)).toBe(420000)
  })

  it('satuan dasar belum bermodal → dibagi rasio dari satuan terbesar bermodal', () => {
    expect(defaultUnitCost([KG, { ...SAK, cost: 420000 }], 1)).toBe(16800)
  })

  it('tidak ada modal sama sekali → null (harga diisi manual)', () => {
    expect(defaultUnitCost([KG, SAK], 2)).toBeNull()
  })
})

describe('isPricePending', () => {
  it('harga PO 0 dan faktur belum diisi → menyusul', () => {
    expect(isPricePending({ unitCost: 0, invoiceUnitCost: null })).toBe(true)
    expect(isPricePending({ unitCost: '0', invoiceUnitCost: '0' })).toBe(true)
  })

  it('sudah ada harga PO atau harga faktur → tidak menyusul', () => {
    expect(isPricePending({ unitCost: 5000, invoiceUnitCost: null })).toBe(false)
    expect(isPricePending({ unitCost: 0, invoiceUnitCost: 4500 })).toBe(false)
  })
})

describe('effectiveUnitCost', () => {
  it('harga faktur > 0 menggantikan harga PO', () => {
    expect(effectiveUnitCost({ unitCost: '165000', invoiceUnitCost: '160000' })).toBe(160000)
  })

  it('harga faktur kosong atau 0 → harga PO, bukan Rp 0', () => {
    expect(effectiveUnitCost({ unitCost: '165000', invoiceUnitCost: null })).toBe(165000)
    expect(effectiveUnitCost({ unitCost: '165000', invoiceUnitCost: '0' })).toBe(165000)
  })
})
