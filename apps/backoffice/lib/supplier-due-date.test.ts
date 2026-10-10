import { describe, expect, it } from 'vitest'
import { daysUntilDue, dueState, supplierDueDate } from './supplier-due-date'

describe('supplierDueDate', () => {
  it('tanggal diterima (WIB) + termin', () => {
    // 26 Agu 2026 20.00 UTC = 27 Agu 03.00 WIB → hitung dari 27 Agu
    expect(supplierDueDate(new Date('2026-08-26T20:00:00Z'), 30)).toBe('2026-09-26')
  })

  it('termin 0 = jatuh tempo hari diterima', () => {
    expect(supplierDueDate(new Date('2026-10-01T03:00:00Z'), 0)).toBe('2026-10-01')
  })

  it('termin kosong = tanpa jatuh tempo', () => {
    expect(supplierDueDate(new Date('2026-10-01T03:00:00Z'), null)).toBeNull()
  })

  it('due_at tersimpan mengalahkan termin', () => {
    expect(supplierDueDate(new Date('2026-10-01T03:00:00Z'), 30, new Date('2026-10-05T03:00:00Z'))).toBe('2026-10-05')
  })
})

describe('dueState', () => {
  const today = '2026-10-10'
  it('mengelompokkan terlambat / ≤7 hari / masih lama / tanpa jatuh tempo', () => {
    expect(dueState('2026-10-09', today)).toBe('OVERDUE')
    expect(dueState('2026-10-10', today)).toBe('SOON')
    expect(dueState('2026-10-17', today)).toBe('SOON')
    expect(dueState('2026-10-18', today)).toBe('LATER')
    expect(dueState(null, today)).toBe('NONE')
    expect(daysUntilDue('2026-09-26', today)).toBe(-14)
  })
})
