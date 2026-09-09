import { describe, it, expect } from 'vitest'
import { digitsOnly, parseRupiahInput, formatRupiahInput } from './number-input'

describe('digitsOnly', () => {
  it('membuang titik, spasi, dan huruf', () => {
    expect(digitsOnly('1.250.000')).toBe('1250000')
    expect(digitsOnly('Rp 12.500')).toBe('12500')
    expect(digitsOnly('abc')).toBe('')
  })
})

describe('parseRupiahInput', () => {
  it('mengubah teks berkelompok jadi integer', () => {
    expect(parseRupiahInput('1.250.000')).toBe(1_250_000)
    expect(parseRupiahInput('0')).toBe(0)
    expect(parseRupiahInput('')).toBe(0)
  })

  it('menolak angka di luar batas aman', () => {
    expect(parseRupiahInput('9'.repeat(20))).toBe(0)
  })
})

describe('formatRupiahInput', () => {
  it('mengelompokkan ribuan gaya id-ID', () => {
    expect(formatRupiahInput('1250000')).toBe('1.250.000')
    expect(formatRupiahInput(50_000)).toBe('50.000')
  })

  it('input kosong tetap kosong', () => {
    expect(formatRupiahInput('')).toBe('')
    expect(formatRupiahInput('abc')).toBe('')
  })

  it('mengabaikan digit yang sudah diketik bersama pemisah', () => {
    expect(formatRupiahInput('1.2')).toBe('12')
  })
})
