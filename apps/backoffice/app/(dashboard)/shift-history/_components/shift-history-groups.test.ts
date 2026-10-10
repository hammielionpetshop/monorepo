import { describe, expect, it } from 'vitest'
import { groupEstafetShifts, groupTotals, type GroupableShift } from './shift-history-groups'

let nextId = 1
function shift(o: Partial<GroupableShift> = {}): GroupableShift {
  return {
    id: nextId++,
    branchId: 3,
    openedAt: '2026-10-10T00:07:00.000Z',
    closedAt: '2026-10-10T10:02:00.000Z',
    forceClosedAt: null,
    status: 'CLOSED',
    origin: 'POS',
    totalClosingCashExpected: 1_000,
    totalClosingCashReal: 1_000,
    totalVariance: 0,
    depositVerifiedAt: null,
    depositVariance: null,
    ...o,
  }
}

describe('groupEstafetShifts', () => {
  it('menggabung shift kasir cabang yang sama di hari WIB yang sama, urut #1 lalu #2', () => {
    const s2 = shift({ openedAt: '2026-10-10T10:05:00.000Z' })
    const s1 = shift({ openedAt: '2026-10-10T00:07:00.000Z' })
    const markas = shift({ branchId: 7 })
    const groups = groupEstafetShifts([s2, markas, s1])
    expect(groups.map((g) => g.shifts.map((s) => s.id))).toEqual([[s1.id, s2.id], [markas.id]])
  })

  it('hari WIB dipakai, bukan hari UTC: 23.30 WIB dan 00.30 WIB besoknya terpisah', () => {
    const malam = shift({ openedAt: '2026-10-10T16:30:00.000Z' })
    const pagi = shift({ openedAt: '2026-10-10T17:30:00.000Z' })
    expect(groupEstafetShifts([pagi, malam])).toHaveLength(2)
  })

  it('shift backoffice (penjualan grosir) tidak pernah digabung', () => {
    const pos = shift()
    const bo = shift({ origin: 'BACKOFFICE', openedAt: '2026-10-10T13:00:00.000Z' })
    expect(groupEstafetShifts([bo, pos]).map((g) => g.shifts.length)).toEqual([1, 1])
  })
})

describe('groupTotals', () => {
  it('menjumlah kas; jam tutup dari shift terakhir; setoran dihitung per shift', () => {
    const t = groupTotals([
      shift({ totalClosingCashExpected: 6_722_590, totalClosingCashReal: 6_723_000, totalVariance: 410, depositVerifiedAt: '2026-10-10T11:00:00Z', depositVariance: 0 }),
      shift({ closedAt: '2026-10-10T12:57:00.000Z', totalClosingCashExpected: 892_500, totalClosingCashReal: 893_000, totalVariance: 500 }),
    ])
    expect(t).toMatchObject({
      closedAt: '2026-10-10T12:57:00.000Z',
      status: 'CLOSED',
      expected: 7_615_090,
      real: 7_616_000,
      variance: 910,
      depositEligible: 2,
      depositVerified: 1,
    })
  })

  it('shift terakhir masih berjalan: status Berlangsung, jam tutup kosong, tidak dihitung untuk setoran', () => {
    const t = groupTotals([
      shift(),
      shift({ status: 'OPEN', closedAt: null, totalClosingCashExpected: null, totalClosingCashReal: null, totalVariance: null }),
    ])
    expect(t).toMatchObject({ status: 'OPEN', closedAt: null, expected: 1_000, depositEligible: 1 })
  })
})
