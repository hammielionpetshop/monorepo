import { describe, expect, it } from 'vitest'
import { normalizePhone, phoneSearchDigits } from './phone'

describe('normalizePhone', () => {
  it('menyamakan berbagai cara menulis nomor yang sama', () => {
    for (const v of ['0812-3456 789', '+62 812 3456789', '62812 3456789', '08123456789']) {
      expect(normalizePhone(v)).toBe('08123456789')
    }
  })
  it('kotak cari: hanya dianggap nomor bila isinya memang nomor', () => {
    expect(phoneSearchDigits('0812 3456')).toBe('08123456')
    expect(phoneSearchDigits('+62 812-3456')).toBe('08123456')
    expect(phoneSearchDigits('Sari 12')).toBe('')
    expect(phoneSearchDigits('TRX-20261012-0481')).toBe('')
    expect(phoneSearchDigits('  ')).toBe('')
  })
  it('kosong tetap kosong', () => {
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone(' - ')).toBe('')
  })
})
