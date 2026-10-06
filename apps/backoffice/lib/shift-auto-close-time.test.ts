import { describe, expect, it } from 'vitest'
import { isShiftOverdue, shiftAutoCloseAt } from './shift-auto-close-time'

// Semua instan ditulis dalam UTC; WIB = UTC+7.
describe('shiftAutoCloseAt', () => {
  it('shift dibuka 07.00 WIB → ditutup 23.59 WIB hari yang sama (16.59 UTC)', () => {
    expect(shiftAutoCloseAt(new Date('2026-10-07T00:00:00Z')).toISOString()).toBe('2026-10-07T16:59:00.000Z')
  })

  it('shift dibuka 01.00 WIB (masih 18.00 UTC hari sebelumnya) → ikut tanggal WIB-nya', () => {
    expect(shiftAutoCloseAt(new Date('2026-10-06T18:00:00Z')).toISOString()).toBe('2026-10-07T16:59:00.000Z')
  })

  it('shift dibuka 23.59 WIB lewat sedikit → tutup di 23.59 hari itu (langsung jatuh tempo)', () => {
    expect(shiftAutoCloseAt(new Date('2026-10-07T16:59:30Z')).toISOString()).toBe('2026-10-07T16:59:00.000Z')
  })
})

describe('isShiftOverdue', () => {
  const opened = new Date('2026-10-07T00:00:00Z') // 07.00 WIB

  it('belum jam 23.59 WIB → belum', () => {
    expect(isShiftOverdue(opened, new Date('2026-10-07T16:58:59Z'))).toBe(false)
  })

  it('tepat 23.59 WIB dan sesudahnya (termasuk besok pagi) → ya', () => {
    expect(isShiftOverdue(opened, new Date('2026-10-07T16:59:00Z'))).toBe(true)
    expect(isShiftOverdue(opened, new Date('2026-10-08T01:00:00Z'))).toBe(true)
  })
})
