import { describe, expect, it } from 'vitest'
import {
  depositNumberPrefix, formatDepositNumber, parseDepositSettings, shiftDepositCash, shiftSettleVariance,
  undepositedLevel, validateCashVarianceLines, validateNoncashCause,
} from './deposit-rules'

describe('aturan Setoran F2-2', () => {
  it('kas setoran: hitungan kasir untuk tutup normal, kas sistem untuk tutup paksa & Bulk Sale', () => {
    expect(shiftDepositCash({ origin: 'POS', status: 'CLOSED', totalClosingCashReal: 90, totalClosingCashExpected: 100 })).toBe(90)
    expect(shiftDepositCash({ origin: 'POS', status: 'FORCE_CLOSED', totalClosingCashReal: 0, totalClosingCashExpected: 100 })).toBe(100)
    expect(shiftDepositCash({ origin: 'BACKOFFICE', status: 'CLOSED', totalClosingCashReal: 0, totalClosingCashExpected: 70 })).toBe(70)
    expect(shiftSettleVariance({ origin: 'POS', status: 'CLOSED', totalClosingCashReal: 90, totalClosingCashExpected: 100 })).toBe(-10)
    expect(shiftSettleVariance({ origin: 'POS', status: 'FORCE_CLOSED', totalClosingCashReal: 0, totalClosingCashExpected: 100 })).toBe(0)
  })

  it('nomor setoran STN-<kode>-<YYMMDD>-<urut>', () => {
    expect(formatDepositNumber(depositNumberPrefix('raja', '2026-11-08'), 3)).toBe('STN-RAJA-261108-03')
  })

  it('rincian sebab harus menutup selisih dengan arah yang benar', () => {
    const cashiers = new Map([[1, new Set([7])]])
    expect(validateCashVarianceLines(0, [], cashiers)).toBeNull()
    expect(validateCashVarianceLines(-5000, [], cashiers)).toMatch(/wajib/)
    expect(validateCashVarianceLines(-5000, [{ amount: 5000, cause: 'BANK_FEE' }], cashiers)).toMatch(/minus/)
    expect(validateCashVarianceLines(-5000, [{ amount: -5000, cause: 'CASHIER_SHORT', shiftId: 1, cashierId: 8 }], cashiers)).toMatch(/tidak bertugas/)
    expect(validateCashVarianceLines(-5000, [{ amount: -5000, cause: 'OTHER' }], cashiers)).toMatch(/catatan/)
    expect(validateCashVarianceLines(-7000, [
      { amount: -2000, cause: 'BANK_FEE' },
      { amount: -5000, cause: 'CASHIER_SHORT', shiftId: 1, cashierId: 7 },
    ], cashiers)).toBeNull()
    expect(validateCashVarianceLines(-7000, [{ amount: -2000, cause: 'BANK_FEE' }], cashiers)).toMatch(/harus sama/)
  })

  it('sebab non-tunai: potongan bank hanya untuk kurang, Lainnya wajib catatan', () => {
    expect(validateNoncashCause(0, null, null)).toBeNull()
    expect(validateNoncashCause(-700, null, null)).toMatch(/pilih/)
    expect(validateNoncashCause(500, 'BANK_FEE', null)).toMatch(/lebih sedikit/)
    expect(validateNoncashCause(-700, 'OTHER', ' ')).toMatch(/catatan/)
  })

  it('tanda tunai belum disetor: merah di batas, jingga mendekati', () => {
    const s = { warnDays: 5, warnAmount: 25_000_000 }
    expect(undepositedLevel(5, 1, s)).toBe('OVER')
    expect(undepositedLevel(0, 25_000_000, s)).toBe('OVER')
    expect(undepositedLevel(4, 1, s)).toBe('WARN')
    expect(undepositedLevel(1, 1_000_000, s)).toBe('OK')
  })

  it('pengaturan rusak kembali ke bawaan', () => {
    expect(parseDepositSettings('{"startDate":"2026-13-40"}', '2026-11-08')).toMatchObject({ startDate: '2026-11-08', warnDays: 5 })
    expect(parseDepositSettings('{"startDate":"2026-11-10","warnDays":3,"warnAmount":1000,"awaitingFundsDays":2}', '2026-11-08'))
      .toEqual({ startDate: '2026-11-10', warnDays: 3, warnAmount: 1000, awaitingFundsDays: 2 })
  })
})
