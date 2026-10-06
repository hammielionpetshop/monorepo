import { describe, expect, it } from 'vitest'
import { PERIOD_RANGES, lastMonthRange } from './date-ranges'

describe('lastMonthRange', () => {
  it('tanggal 1 s/d akhir bulan sebelumnya', () => {
    expect(lastMonthRange(new Date(2026, 9, 7))).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('Januari mundur ke Desember tahun lalu', () => {
    expect(lastMonthRange(new Date(2026, 0, 15))).toEqual({ start: '2025-12-01', end: '2025-12-31' })
  })

  it('Februari kabisat & tanggal 31 tidak meluap ke bulan berikutnya', () => {
    expect(lastMonthRange(new Date(2028, 2, 31))).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })
})

describe('PERIOD_RANGES', () => {
  it('menyediakan Bulan Lalu setelah Bulan Ini', () => {
    const labels = PERIOD_RANGES.map((r) => r.label)
    expect(labels.indexOf('Bulan Lalu')).toBe(labels.indexOf('Bulan Ini') + 1)
  })
})
