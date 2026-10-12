import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MANUAL_DISCOUNT_POLICY,
  MANUAL_DISCOUNT_REASONS,
  checkManualDiscount,
  isManualDiscountReason,
  lineGrossAmount,
  manualDiscountAmount,
  manualDiscountReasonLabel,
  maxManualDiscount,
} from './manual-discount'

const sah = { lineGross: 50000, amount: 5000, reasonCode: 'KEMASAN_RUSAK' }

describe('mesin diskon manual — hitungan', () => {
  it('nilai baris = qty × harga', () => {
    expect(lineGrossAmount(3, 25000)).toBe(75000)
    expect(lineGrossAmount(2, '12500')).toBe(25000)
  })

  it('potongan per pcs dikali qty; potongan per baris apa adanya', () => {
    expect(manualDiscountAmount('PER_PCS', 2000, 3)).toBe(6000)
    expect(manualDiscountAmount('PER_BARIS', 2000, 3)).toBe(2000)
    expect(manualDiscountAmount('PER_PCS', Number.NaN, 3)).toBe(0)
  })
})

describe('mesin diskon manual — pemeriksaan', () => {
  it('potongan wajar dengan alasan pilihan → sah', () => {
    expect(checkManualDiscount(sah)).toBeNull()
  })

  it('boleh sampai seharga barangnya, tidak boleh lebih', () => {
    expect(checkManualDiscount({ ...sah, amount: 50000 })).toBeNull()
    expect(checkManualDiscount({ ...sah, amount: 50001 })).toMatch(/melebihi harga/)
  })

  it('potongan nol, minus, atau pecahan ditolak', () => {
    for (const amount of [0, -1000, 1500.5, Number.NaN]) {
      expect(checkManualDiscount({ ...sah, amount })).toMatch(/lebih dari 0/)
    }
  })

  it('baris yang sudah kena promo tidak bisa didiskon manual', () => {
    expect(checkManualDiscount({ ...sah, hasOtherDiscount: true })).toMatch(/promo/)
  })

  it('alasan wajib dari daftar', () => {
    expect(checkManualDiscount({ ...sah, reasonCode: null })).toBe('Pilih alasan diskon')
    expect(checkManualDiscount({ ...sah, reasonCode: 'ASAL' })).toBe('Pilih alasan diskon')
  })

  it('"Lainnya" wajib diketik', () => {
    expect(checkManualDiscount({ ...sah, reasonCode: 'LAINNYA' })).toMatch(/wajib diketik/)
    expect(checkManualDiscount({ ...sah, reasonCode: 'LAINNYA', reasonNote: '  a ' })).toMatch(/wajib diketik/)
    expect(checkManualDiscount({ ...sah, reasonCode: 'LAINNYA', reasonNote: 'teman owner' })).toBeNull()
  })

  it('catatan terlalu panjang ditolak', () => {
    expect(checkManualDiscount({ ...sah, reasonNote: 'x'.repeat(201) })).toMatch(/paling panjang/)
  })
})

describe('mesin diskon manual — batas diskon', () => {
  it('bawaan: tanpa batas (owner belum menetapkan)', () => {
    expect(DEFAULT_MANUAL_DISCOUNT_POLICY).toEqual({ maxPercentOfLine: null, maxAmountPerLine: null })
    expect(maxManualDiscount(50000)).toBe(50000)
  })

  it('batas persen dan batas rupiah: yang paling ketat berlaku', () => {
    expect(maxManualDiscount(50000, { maxPercentOfLine: 10, maxAmountPerLine: null })).toBe(5000)
    expect(maxManualDiscount(50000, { maxPercentOfLine: null, maxAmountPerLine: 3000 })).toBe(3000)
    expect(maxManualDiscount(50000, { maxPercentOfLine: 10, maxAmountPerLine: 3000 })).toBe(3000)
    expect(maxManualDiscount(33333, { maxPercentOfLine: 10, maxAmountPerLine: null })).toBe(3333)
  })

  it('potongan di atas batas ditolak dengan menyebut batasnya', () => {
    const policy = { maxPercentOfLine: 10, maxAmountPerLine: null }
    expect(checkManualDiscount({ ...sah, amount: 5000, policy })).toBeNull()
    expect(checkManualDiscount({ ...sah, amount: 5001, policy })).toMatch(/batas diskon.*5\.000/)
  })
})

describe('mesin diskon manual — alasan', () => {
  it('daftar alasan memuat "Lainnya" dan kodenya tidak kembar', () => {
    const codes = MANUAL_DISCOUNT_REASONS.map((r) => r.code)
    expect(codes).toContain('LAINNYA')
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.every((c) => c.length <= 30)).toBe(true)
    expect(isManualDiscountReason('LANGGANAN')).toBe(true)
    expect(isManualDiscountReason(undefined)).toBe(false)
  })

  it('tulisan alasan: pilihan, atau ketikan kasir bila "Lainnya"', () => {
    expect(manualDiscountReasonLabel('KEMASAN_RUSAK')).toBe('Kemasan rusak')
    expect(manualDiscountReasonLabel('LAINNYA', ' teman owner ')).toBe('teman owner')
    expect(manualDiscountReasonLabel('LAINNYA')).toBe('Lainnya')
    expect(manualDiscountReasonLabel('KODE_LAMA')).toBe('-')
  })
})
