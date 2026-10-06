import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({}))

import { buildTargetCosts, currentCostPerBase, decideCostSync, marginPercent, sameInboundSourceTypes } from './cost-sync-service'

const KG = 9
const SAK = 20
const uoms = [{ uomId: KG, ratio: 1 }, { uomId: SAK, ratio: 30 }]

describe('buildTargetCosts', () => {
  it('modal per SAK dibagi rasio untuk KG, SAK tetap angka mentahnya', () => {
    expect(buildTargetCosts(182500, 30, uoms)).toEqual([
      { uomId: KG, costPrice: 6083 },
      { uomId: SAK, costPrice: 182500 },
    ])
  })

  it('modal per KG dikali rasio untuk SAK', () => {
    expect(buildTargetCosts(6083, 1, uoms)).toEqual([
      { uomId: KG, costPrice: 6083 },
      { uomId: SAK, costPrice: 182490 },
    ])
  })

  it('modal 0 atau rasio tidak valid tidak menghasilkan apa-apa', () => {
    expect(buildTargetCosts(0, 30, uoms)).toEqual([])
    expect(buildTargetCosts(182500, 0, uoms)).toEqual([])
  })
})

describe('currentCostPerBase', () => {
  it('memakai modal satuan dasar bila ada', () => {
    expect(currentCostPerBase(uoms, new Map([[KG, 5500], [SAK, 165000]]), KG)).toBe(5500)
  })

  it('satuan dasar kosong → satuan terbesar dibagi rasionya', () => {
    expect(currentCostPerBase(uoms, new Map([[SAK, 165000]]), KG)).toBe(5500)
  })

  it('tidak ada modal sama sekali → null', () => {
    expect(currentCostPerBase(uoms, new Map(), KG)).toBeNull()
    expect(currentCostPerBase(uoms, new Map([[KG, 0]]), KG)).toBeNull()
  })
})

describe('decideCostSync', () => {
  it('modal lama kosong → langsung diterapkan', () => {
    expect(decideCostSync(null, 6083)).toBe('APPLY')
    expect(decideCostSync(0, 6083)).toBe('APPLY')
  })

  it('selisih di bawah 30% → langsung diterapkan (ACTIVE -2: 5.500 → 6.083)', () => {
    expect(decideCostSync(5500, 6083)).toBe('APPLY')
    expect(decideCostSync(10000, 12999)).toBe('APPLY')
    expect(decideCostSync(10000, 7001)).toBe('APPLY')
  })

  it('selisih 30% atau lebih, naik maupun turun → wajib ditinjau', () => {
    expect(decideCostSync(10000, 13000)).toBe('REVIEW')
    expect(decideCostSync(10000, 7000)).toBe('REVIEW')
    expect(decideCostSync(470000, 11625)).toBe('REVIEW')
  })
})

describe('marginPercent', () => {
  it('margin terhadap harga jual', () => {
    expect(marginPercent(6500, 6083)).toBe(6.42)
    expect(marginPercent(10000, 9900)).toBe(1)
  })

  it('rugi bernilai negatif, harga 0 tidak membagi nol', () => {
    expect(marginPercent(10000, 11000)).toBe(-10)
    expect(marginPercent(0, 5000)).toBe(0)
  })
})

describe('sameInboundSourceTypes', () => {
  it('penerimaan & faktur PO dianggap satu dokumen', () => {
    expect(sameInboundSourceTypes('PO_INVOICE')).toEqual(['PO_RECEIVING', 'PO_INVOICE'])
    expect(sameInboundSourceTypes('PO_RECEIVING')).toEqual(['PO_RECEIVING', 'PO_INVOICE'])
  })

  it('sumber lain hanya dirinya sendiri', () => {
    expect(sameInboundSourceTypes('IBT_RECEIVE')).toEqual(['IBT_RECEIVE'])
  })
})
