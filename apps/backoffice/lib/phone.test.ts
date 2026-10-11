import { describe, expect, it } from 'vitest'
import { normalizePhone } from './phone'

describe('normalizePhone', () => {
  it('menyamakan berbagai cara menulis nomor yang sama', () => {
    for (const v of ['0812-3456 789', '+62 812 3456789', '62812 3456789', '08123456789']) {
      expect(normalizePhone(v)).toBe('08123456789')
    }
  })
  it('kosong tetap kosong', () => {
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone(' - ')).toBe('')
  })
})
