import { describe, expect, it } from 'vitest'
import {
  addMonths, amountFor, billMonths, billStatus, checkAmountChange, checkCostChange, checkPay, dueDateFor, monthsBetween, splitPaid,
} from './recurring-cost-rules'

// Aturan Biaya Rutin F2-5a (spec docs/work/specs/2026-11-11-f2-5-biaya-rutin-sewa-mobil-design.md §2.6).
describe('Biaya Rutin — hitung tagihan', () => {
  it('bulan berurutan melewati pergantian tahun', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(addMonths('2026-12', 12)).toBe('2027-12')
    expect(monthsBetween('2026-12', '2026-11')).toEqual([])
  })

  it('jatuh tempo tanggal 31 di Februari dipotong ke tanggal terakhir', () => {
    expect(dueDateFor('2027-02', 31)).toBe('2027-02-28')
    expect(dueDateFor('2028-02', 30)).toBe('2028-02-29')
    expect(dueDateFor('2026-11', 5)).toBe('2026-11-05')
  })

  it('jumlah berubah mulai bulan X; bulan sebelumnya tetap', () => {
    const steps = [{ effectiveMonth: '2026-09', amount: 2_000_000 }, { effectiveMonth: '2027-01', amount: 2_500_000 }]
    expect(amountFor(steps, '2026-08')).toBeNull()
    expect(amountFor(steps, '2026-12')).toBe(2_000_000)
    expect(amountFor(steps, '2027-01')).toBe(2_500_000)
  })

  it('bulan bertagihan dari mulai sampai bulan berjalan atau Berlaku sampai; nonaktif tidak bertagihan', () => {
    expect(billMonths({ startMonth: '2026-09', endMonth: null, isActive: true }, '2026-11')).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(billMonths({ startMonth: '2026-09', endMonth: '2026-10', isActive: true }, '2026-11')).toEqual(['2026-09', '2026-10'])
    expect(billMonths({ startMonth: '2026-12', endMonth: null, isActive: true }, '2026-11')).toEqual([])
    expect(billMonths({ startMonth: '2026-09', endMonth: null, isActive: false }, '2026-11')).toEqual([])
  })

  it('status: merah lewat jatuh tempo, kuning ≤ 3 hari, lunas', () => {
    expect(billStatus('2026-11-05', '2026-11-11', false)).toBe('OVERDUE')
    expect(billStatus('2026-11-14', '2026-11-11', false)).toBe('DUE_SOON')
    expect(billStatus('2026-11-15', '2026-11-11', false)).toBe('UNPAID')
    expect(billStatus('2026-11-05', '2026-11-11', true)).toBe('PAID')
  })
})

describe('Biaya Rutin — bayar', () => {
  const schedule = { startMonth: '2026-10', endMonth: null, isActive: true }
  const base = {
    schedule, fromMonth: '2026-10', toMonth: '2026-10', paidMonths: new Set<string>(), currentMonth: '2026-11',
    billed: [{ month: '2026-10', amount: 2_000_000 }], amount: 2_000_000, differenceReason: null,
  }

  it('sah untuk satu bulan dengan jumlah sama', () => {
    expect(checkPay(base)).toBeNull()
  })

  it('menolak bulan yang sudah dibayar, sebelum mulai, sesudah berakhir, dan lewat batas bayar di muka', () => {
    expect(checkPay({ ...base, paidMonths: new Set(['2026-10']) })).toMatch(/sudah dibayar/)
    expect(checkPay({ ...base, fromMonth: '2026-09' })).toMatch(/sebelum biaya ini berlaku/)
    expect(checkPay({ ...base, schedule: { ...schedule, endMonth: '2026-10' }, toMonth: '2026-11' })).toMatch(/berakhir/)
    expect(checkPay({ ...base, toMonth: '2027-12' })).toMatch(/12 bulan/)
  })

  it('jumlah beda wajib beralasan; tagihan tanpa jumlah ditolak', () => {
    expect(checkPay({ ...base, amount: 1_800_000 })).toMatch(/alasan wajib/)
    expect(checkPay({ ...base, amount: 1_800_000, differenceReason: 'potongan pemilik' })).toBeNull()
    expect(checkPay({ ...base, billed: [{ month: '2026-10', amount: null }] })).toMatch(/belum diatur/)
  })

  it('jumlah dibayar dibagi per bulan, total selalu sama', () => {
    expect(splitPaid([2_000_000, 2_000_000], 4_000_000)).toEqual([2_000_000, 2_000_000])
    const parts = splitPaid([2_000_000, 2_000_000, 2_000_000], 5_000_000)
    expect(parts.reduce((s, p) => s + p, 0)).toBe(5_000_000)
    expect(parts).toEqual([1_666_666, 1_666_666, 1_666_668])
  })
})

describe('Biaya Rutin — ubah pengaturan', () => {
  const current = { categoryId: 1, branchId: 2, startMonth: '2026-10' }
  const next = { ...current, endMonth: null, isActive: true, wasActive: true }

  it('sebelum ada pembayaran semua boleh diubah', () => {
    expect(checkCostChange({ hasPayments: false, lastPaidMonth: null, current, next: { ...next, categoryId: 9, branchId: null, isActive: false } })).toBeNull()
  })

  it('sesudah ada pembayaran: kategori, cabang, mulai, nonaktif, dan berakhir sebelum bulan dibayar ditolak', () => {
    const paid = { hasPayments: true, lastPaidMonth: '2026-11', current }
    expect(checkCostChange({ ...paid, next: { ...next, categoryId: 9 } })).toMatch(/Kategori dan cabang/)
    expect(checkCostChange({ ...paid, next: { ...next, branchId: null } })).toMatch(/Kategori dan cabang/)
    expect(checkCostChange({ ...paid, next: { ...next, startMonth: '2026-09' } })).toMatch(/Berlaku mulai/)
    expect(checkCostChange({ ...paid, next: { ...next, isActive: false } })).toMatch(/nonaktifkan/)
    expect(checkCostChange({ ...paid, next: { ...next, endMonth: '2026-10' } })).toMatch(/sudah dibayar/)
    expect(checkCostChange({ ...paid, next: { ...next, endMonth: '2026-12' } })).toBeNull()
  })

  it('ubah jumlah tidak menyentuh bulan yang sudah dibayar', () => {
    expect(checkAmountChange({ effectiveMonth: '2026-11', startMonth: '2026-10', lastPaidMonth: '2026-11', amount: 1 })).toMatch(/sudah dibayar/)
    expect(checkAmountChange({ effectiveMonth: '2026-12', startMonth: '2026-10', lastPaidMonth: '2026-11', amount: 1 })).toBeNull()
    expect(checkAmountChange({ effectiveMonth: '2026-09', startMonth: '2026-10', lastPaidMonth: null, amount: 1 })).toMatch(/sebelum biaya ini berlaku/)
  })
})
