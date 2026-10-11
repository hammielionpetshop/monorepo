import { describe, expect, it } from 'vitest'
import { ageFromBirthDate, birthDateFromAge, formatPetAge } from './pet-age'

const hariIni = new Date('2026-10-11T03:00:00Z')

describe('umur kucing', () => {
  it('umur → perkiraan tanggal lahir → umur yang sama', () => {
    expect(birthDateFromAge(2, 3, hariIni)).toBe('2024-07-01')
    expect(ageFromBirthDate('2024-07-01', hariIni)).toEqual({ years: 2, months: 3 })
    expect(birthDateFromAge(0, 10, hariIni)).toBe('2025-12-01')
    expect(ageFromBirthDate('2025-12-01', hariIni)).toEqual({ years: 0, months: 10 })
  })

  it('umur bertambah sendiri seiring waktu', () => {
    expect(formatPetAge('2024-07-01', new Date('2027-01-15T00:00:00Z'))).toBe('2 th 6 bln')
  })

  it('umur kosong tidak menghasilkan tanggal lahir', () => {
    expect(birthDateFromAge(0, 0, hariIni)).toBeNull()
    expect(birthDateFromAge(null, undefined, hariIni)).toBeNull()
    expect(formatPetAge(null, hariIni)).toBe('-')
  })

  it('format ringkas', () => {
    expect(formatPetAge('2025-10-01', hariIni)).toBe('1 th')
    expect(formatPetAge('2026-05-01', hariIni)).toBe('5 bln')
    expect(formatPetAge('2026-10-01', hariIni)).toBe('< 1 bln')
    expect(formatPetAge('2027-01-01', hariIni)).toBe('< 1 bln')
  })
})
