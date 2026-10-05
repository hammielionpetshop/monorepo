import { describe, expect, it } from 'vitest'
import { proposeBatchCost, type ProposalInput, type UomCostRow } from './zero-cost-batch-proposal'

const BASE = 10
const SAK = 20

function input(uomCosts: UomCostRow[], extra: Partial<ProposalInput> = {}): ProposalInput {
  return {
    branchId: 2,
    baseUomId: BASE,
    defaultCostPrice: null,
    uomCosts,
    branchNames: new Map([[2, 'Gudang'], [3, 'Toko Pusat']]),
    baseSellingPrice: null,
    minOtherBatchCost: null,
    ...extra,
  }
}

const cost = (branchId: number, uomId: number, costPrice: number, ratio: number | null, uomCode = uomId === BASE ? 'KG' : 'SAK'): UomCostRow => ({
  branchId, uomId, uomCode, costPrice, ratio,
})

describe('proposeBatchCost', () => {
  it('modal satuan dasar cabang itu dipakai lebih dulu', () => {
    const p = proposeBatchCost(input([cost(2, BASE, 24000, null), cost(2, SAK, 462520, 20)]))
    expect(p).toMatchObject({ costPerBase: 24000, source: 'BASE', recommended: true })
  })

  it('hanya modal SAK → dibagi rasio (bukan qty dikali rasio)', () => {
    const p = proposeBatchCost(input([cost(2, SAK, 462520, 20)]))
    expect(p).toMatchObject({ costPerBase: 23126, source: 'BIG_UOM', detail: 'SAK Rp 462.520 ÷ 20', recommended: true })
  })

  it('beberapa satuan besar → rasio terbesar (satuan beli grosir)', () => {
    const p = proposeBatchCost(input([cost(2, 30, 60000, 5, 'PAK'), cost(2, SAK, 240000, 20)]))
    expect(p?.costPerBase).toBe(12000)
  })

  it('tanpa modal satuan → modal default produk', () => {
    const p = proposeBatchCost(input([], { defaultCostPrice: 7500 }))
    expect(p).toMatchObject({ costPerBase: 7500, source: 'DEFAULT', recommended: true })
  })

  it('modal cabang lain hanya ditawarkan, tidak dicentang otomatis', () => {
    const p = proposeBatchCost(input([cost(3, SAK, 300000, 20)]))
    expect(p).toMatchObject({ costPerBase: 15000, source: 'OTHER_BRANCH', recommended: false })
    expect(p?.detail).toContain('Toko Pusat')
  })

  it('tidak ada sumber sama sekali → null', () => {
    expect(proposeBatchCost(input([cost(2, SAK, 0, 20)]))).toBeNull()
  })

  it('modal ≥ harga jual satuan dasar ditandai dan tidak dicentang', () => {
    const p = proposeBatchCost(input([cost(2, SAK, 2349960, 60)], { baseSellingPrice: 30000 }))
    expect(p).toMatchObject({ costPerBase: 39166, recommended: false })
    expect(p?.flags).toContain('MODAL_MELEBIHI_HARGA_JUAL')
  })

  it('modal > 4× batch lain produk yang sama ditandai dan tidak dicentang', () => {
    const p = proposeBatchCost(input([cost(2, SAK, 2349960, 60)], { minOtherBatchCost: 2500 }))
    expect(p?.flags).toEqual(['JAUH_DI_ATAS_BATCH_LAIN'])
    expect(p?.recommended).toBe(false)
  })
})
