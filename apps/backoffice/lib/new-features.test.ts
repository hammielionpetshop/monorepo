import { describe, expect, it } from 'vitest'
import { NEW_BADGE_DAYS, NEW_FEATURES, isNewFeature } from './new-features'

describe('isNewFeature', () => {
  const key = '/purchase-orders/retur' // rilis 2026-10-11

  it('tampil sejak 00.00 WIB hari rilis sampai 7 hari sesudahnya', () => {
    expect(NEW_BADGE_DAYS).toBe(7)
    expect(isNewFeature(key, new Date('2026-10-10T16:59:59Z'))).toBe(false) // 10 Okt 23.59 WIB
    expect(isNewFeature(key, new Date('2026-10-10T17:00:00Z'))).toBe(true) // 11 Okt 00.00 WIB
    expect(isNewFeature(key, new Date('2026-10-17T16:59:59Z'))).toBe(true) // 17 Okt 23.59 WIB
    expect(isNewFeature(key, new Date('2026-10-17T17:00:00Z'))).toBe(false) // 18 Okt 00.00 WIB
  })

  it('menu yang tidak terdaftar tidak pernah bertanda', () => {
    expect(isNewFeature('/master-data/products', new Date('2026-10-11T05:00:00Z'))).toBe(false)
  })

  it('semua tanggal rilis berformat YYYY-MM-DD yang sah', () => {
    for (const [name, date] of Object.entries(NEW_FEATURES)) {
      expect(date, name).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(new Date(`${date}T00:00:00+07:00`).getTime()), name).toBe(false)
    }
  })
})
