import { describe, expect, it } from 'vitest'
import { checkAdjustment, checkCount, countFreshness } from './cash-count-rules'

const place = { kind: 'CASH', isActive: true }
const base = { place, countedOn: '2026-11-12', today: '2026-11-12', amount: 1_500_000 }

describe('checkCount', () => {
  it('menerima hitungan Tunai/Rekening yang sah, termasuk 0', () => {
    expect(checkCount(base)).toBeNull()
    expect(checkCount({ ...base, place: { kind: 'BANK', isActive: true }, amount: 0 })).toBeNull()
  })
  it('menolak Laci, tempat nonaktif, dan tempat tidak ada', () => {
    expect(checkCount({ ...base, place: { kind: 'DRAWER', isActive: true } })).toMatch(/Laci/)
    expect(checkCount({ ...base, place: { kind: 'CASH', isActive: false } })).toMatch(/nonaktif/)
    expect(checkCount({ ...base, place: null })).toMatch(/tidak ditemukan/)
  })
  it('menolak tanggal sebelum 1 Nov 2026, masa depan, dan tanggal rusak', () => {
    expect(checkCount({ ...base, countedOn: '2026-10-31' })).toMatch(/1 November/)
    expect(checkCount({ ...base, countedOn: '2026-11-13' })).toMatch(/melewati/)
    expect(checkCount({ ...base, countedOn: '2026-11-31' })).toMatch(/tidak valid/)
  })
  it('menolak jumlah minus atau pecahan', () => {
    expect(checkCount({ ...base, amount: -1 })).toMatch(/bulat/)
    expect(checkCount({ ...base, amount: 10.5 })).toMatch(/bulat/)
  })
})

describe('checkAdjustment', () => {
  const ok = { isCancelled: false, hasActiveAdjustment: false, amount: 50_000, reason: 'tidak ketemu sebabnya' }
  it('menerima penyesuaian yang sah', () => expect(checkAdjustment(ok)).toBeNull())
  it('menolak hitungan batal, penyesuaian ganda, jumlah 0, alasan kosong', () => {
    expect(checkAdjustment({ ...ok, isCancelled: true })).toMatch(/dibatalkan/)
    expect(checkAdjustment({ ...ok, hasActiveAdjustment: true })).toMatch(/sudah punya/)
    expect(checkAdjustment({ ...ok, amount: 0 })).toMatch(/lebih dari 0/)
    expect(checkAdjustment({ ...ok, reason: ' a ' })).toMatch(/Alasan/)
  })
})

describe('countFreshness', () => {
  it('belum pernah, lewat 7 hari, dan masih baru', () => {
    expect(countFreshness(null, '2026-11-12')).toBe('NEVER')
    expect(countFreshness('2026-11-04', '2026-11-12')).toBe('STALE')
    expect(countFreshness('2026-11-05', '2026-11-12')).toBe('FRESH')
  })
})
