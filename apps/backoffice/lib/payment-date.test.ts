import { describe, expect, it } from 'vitest'
import { resolvePaidAt, todayWibDate } from './payment-date'

// 10 Okt 2026 pukul 01.00 WIB = 9 Okt 18.00 UTC
const now = new Date('2026-10-09T18:00:00Z')

describe('resolvePaidAt', () => {
  it('memakai waktu sekarang bila tanggal kosong', () => {
    expect(resolvePaidAt(undefined, now)).toBe(now)
  })

  it('memakai waktu sekarang bila tanggal = hari ini WIB', () => {
    expect(todayWibDate(now)).toBe('2026-10-10')
    expect(resolvePaidAt('2026-10-10', now)).toBe(now)
  })

  it('tanggal lampau disimpan pukul 12.00 WIB', () => {
    expect(resolvePaidAt('2026-09-01', now)?.toISOString()).toBe('2026-09-01T05:00:00.000Z')
  })

  it('menolak tanggal masa depan dan tanggal tidak valid', () => {
    expect(resolvePaidAt('2026-10-11', now)).toBeNull()
    expect(resolvePaidAt('2026-02-31', now)).toBeNull()
    expect(resolvePaidAt('10-10-2026', now)).toBeNull()
  })
})
