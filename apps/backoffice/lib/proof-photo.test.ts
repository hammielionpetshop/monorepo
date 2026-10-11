import { describe, expect, it } from 'vitest'
import { isNonCashMethod, proofPhotoUrlSchema } from './proof-photo'

describe('proofPhotoUrlSchema', () => {
  it('menerima alamat hasil rute unggah dan nilai kosong', () => {
    expect(proofPhotoUrlSchema.safeParse('/uploads/3f2b6c1e-aaaa-bbbb-cccc-0123456789ab.jpg').success).toBe(true)
    expect(proofPhotoUrlSchema.safeParse(undefined).success).toBe(true)
  })

  it('menolak alamat luar, jalur naik folder, dan skema lain', () => {
    for (const value of ['https://contoh.test/a.jpg', '/uploads/../.env', '/uploads/a/b.jpg', 'javascript:alert(1)', '/api/x', '']) {
      expect(proofPhotoUrlSchema.safeParse(value).success).toBe(false)
    }
  })
})

describe('isNonCashMethod', () => {
  it('memakai jenis metode bila ada', () => {
    expect(isNonCashMethod({ name: 'Tunai', type: 'CASH' })).toBe(false)
    expect(isNonCashMethod({ name: 'BCA', type: 'BANK_TRANSFER' })).toBe(true)
    expect(isNonCashMethod({ name: 'QRIS', type: 'QRIS' })).toBe(true)
  })

  it('tanpa jenis: menebak dari nama; tanpa metode: tidak tampil', () => {
    expect(isNonCashMethod({ name: 'Tunai' })).toBe(false)
    expect(isNonCashMethod({ name: 'CASH' })).toBe(false)
    expect(isNonCashMethod({ name: 'Transfer BCA' })).toBe(true)
    expect(isNonCashMethod(undefined)).toBe(false)
  })
})
