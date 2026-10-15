import { describe, expect, it } from 'vitest'
import {
  assemblePromoReport,
  type PromoMetaRow,
  type PromoUsageRow,
  type PromoBaselineRow,
  type BranchUsageRow,
} from './promo-report'

const meta = (id: number, name: string): PromoMetaRow => ({
  promotionId: id, name, status: 'BERJALAN', branchNames: ['Toko'], startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-31T00:00:00.000Z',
})
const usage = (id: number, over: Partial<PromoUsageRow> = {}): PromoUsageRow => ({
  promotionId: id, promotionName: null, noteCount: 1, qty: 2, omzet: 50000, discount: 2000, cogs: 20000, ...over,
})

describe('assemblePromoReport', () => {
  it('menghitung laba, menggabungkan pembanding, dan menjumlahkan total', () => {
    const baseline: PromoBaselineRow[] = [{ promotionId: 1, periodQty: 10, periodOmzet: 100000, beforeQty: 8, beforeOmzet: 80000 }]
    const view = assemblePromoReport([meta(1, 'Promo A')], [usage(1, { omzet: 90000, cogs: 30000, discount: 5000, qty: 10, noteCount: 4 })], baseline, [])
    const p = view.promos[0]
    expect(p.profit).toBe(60000) // 90000 − 30000
    expect(p.comparison).toMatchObject({ periodQty: 10, beforeQty: 8, qtyDelta: 2, qtyChangePct: 25 })
    expect(view.totals).toMatchObject({ noteCount: 4, qty: 10, omzet: 90000, discount: 5000, profit: 60000 })
  })

  it('pembanding = null bila tak ada baseline; persen = null bila sebelumnya nol', () => {
    const view = assemblePromoReport(
      [meta(1, 'A'), meta(2, 'B')],
      [usage(1), usage(2)],
      [{ promotionId: 2, periodQty: 5, periodOmzet: 1, beforeQty: 0, beforeOmzet: 0 }],
      [],
    )
    const a = view.promos.find((p) => p.promotionId === 1)!
    const b = view.promos.find((p) => p.promotionId === 2)!
    expect(a.comparison).toBeNull()
    expect(b.comparison).toMatchObject({ qtyDelta: 5, qtyChangePct: null })
  })

  it('promo terpakai tanpa keterangan memakai nama tersimpan; promo tanpa pemakaian = nol', () => {
    const view = assemblePromoReport(
      [meta(9, 'Promo Terdaftar')],
      [usage(7, { promotionName: 'Promo Lama', noteCount: 3 })],
      [],
      [],
    )
    const terpakai = view.promos.find((p) => p.promotionId === 7)!
    const kosong = view.promos.find((p) => p.promotionId === 9)!
    expect(terpakai.name).toBe('Promo Lama')
    expect(terpakai.status).toBeNull()
    expect([kosong.noteCount, kosong.qty, kosong.omzet, kosong.discount, kosong.profit]).toEqual([0, 0, 0, 0, 0])
    expect(kosong.status).toBe('BERJALAN')
  })

  it('promo diurutkan potongan terbesar dulu', () => {
    const view = assemblePromoReport(
      [meta(1, 'A'), meta(2, 'B'), meta(3, 'C')],
      [usage(1, { discount: 1000 }), usage(2, { discount: 9000 }), usage(3, { discount: 5000 })],
      [],
      [],
    )
    expect(view.promos.map((p) => p.promotionId)).toEqual([2, 3, 1])
  })

  it('peringkat toko diurutkan potongan terbesar dulu', () => {
    const branches: BranchUsageRow[] = [
      { branchId: 1, branchName: 'Toko A', noteCount: 1, qty: 1, omzet: 1, discount: 1000 },
      { branchId: 2, branchName: 'Toko B', noteCount: 1, qty: 1, omzet: 1, discount: 7000 },
    ]
    const view = assemblePromoReport([], [], [], branches)
    expect(view.branches.map((b) => b.branchId)).toEqual([2, 1])
  })
})
