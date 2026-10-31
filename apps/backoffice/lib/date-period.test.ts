import { describe, expect, it } from 'vitest'
import { datePeriodPresets, EMPTY_DATE_PERIOD, getDatePeriodRange, matchesDatePeriod } from './date-period'

describe('Filter periode tanggal', () => {
  it('mencakup satu hari penuh WIB tanpa mengambil hari sebelahnya', () => {
    const range = getDatePeriodRange({ ...EMPTY_DATE_PERIOD, mode: 'day', date: '2026-10-31' })
    expect(matchesDatePeriod('2026-10-30T16:59:59.999Z', range)).toBe(false)
    expect(matchesDatePeriod('2026-10-30T17:00:00.000Z', range)).toBe(true)
    expect(matchesDatePeriod(new Date('2026-10-31T16:59:59.999Z'), range)).toBe(true)
    expect(matchesDatePeriod('2026-10-31T17:00:00.000Z', range)).toBe(false)
  })

  it('menentukan Senin sampai Minggu saat minggu melewati pergantian tahun', () => {
    expect(getDatePeriodRange({ ...EMPTY_DATE_PERIOD, mode: 'week', date: '2027-01-01' }))
      .toEqual({ start: '2026-12-28', end: '2027-01-03' })
    expect(getDatePeriodRange({ ...EMPTY_DATE_PERIOD, mode: 'week', date: '2027-01-03' }))
      .toEqual({ start: '2026-12-28', end: '2027-01-03' })
  })

  it('mencakup seluruh bulan beserta tahun dan tahun kabisat', () => {
    expect(getDatePeriodRange({ ...EMPTY_DATE_PERIOD, mode: 'month', month: '2024-02' }))
      .toEqual({ start: '2024-02-01', end: '2024-02-29' })
    expect(getDatePeriodRange({ ...EMPTY_DATE_PERIOD, mode: 'month', month: '2026-12' }))
      .toEqual({ start: '2026-12-01', end: '2026-12-31' })
  })

  it('mencakup tanggal akhir rentang serta menerima batas satu sisi', () => {
    const range = getDatePeriodRange({ ...EMPTY_DATE_PERIOD, mode: 'range', start: '2026-09-01', end: '2026-10-31' })
    expect(matchesDatePeriod('2026-10-31T23:59:59.999+07:00', range)).toBe(true)
    expect(matchesDatePeriod('2026-11-01T00:00:00+07:00', range)).toBe(false)
    expect(matchesDatePeriod('2026-09-01T00:00:00+07:00', getDatePeriodRange({ ...EMPTY_DATE_PERIOD, mode: 'range', end: '2026-10-31' }))).toBe(true)
  })

  it('menolak tanggal kalender tidak valid dan rentang terbalik', () => {
    expect(getDatePeriodRange({ ...EMPTY_DATE_PERIOD, mode: 'day', date: '2026-02-30' })).toBeNull()
    expect(getDatePeriodRange({ ...EMPTY_DATE_PERIOD, mode: 'month', month: '2026-13' })).toBeNull()
    expect(getDatePeriodRange({ ...EMPTY_DATE_PERIOD, mode: 'range', start: '2026-11-01', end: '2026-10-31' })).toBeNull()
    expect(matchesDatePeriod('2026-10-31T12:00:00Z', null)).toBe(false)
  })

  it('membiarkan seluruh tanggal terlihat pada pilihan awal dan setelah reset', () => {
    expect(matchesDatePeriod('2020-01-01T00:00:00Z', getDatePeriodRange(EMPTY_DATE_PERIOD))).toBe(true)
  })

  it('menghitung tombol cepat dari hari WIB yang diberikan server', () => {
    expect(datePeriodPresets('2027-01-01')).toEqual([
      { label: 'Hari Ini', range: { start: '2027-01-01', end: '2027-01-01' } },
      { label: 'Kemarin', range: { start: '2026-12-31', end: '2026-12-31' } },
      { label: 'Minggu Ini', range: { start: '2026-12-28', end: '2027-01-01' } },
      { label: 'Bulan Ini', range: { start: '2027-01-01', end: '2027-01-01' } },
    ])
  })
})
