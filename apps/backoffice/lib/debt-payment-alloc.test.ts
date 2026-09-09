import { describe, it, expect } from 'vitest'
import { alokasiPembayaranHutang, type BarisHutangBayar } from './debt-payment-alloc'

function hutang(over: Partial<BarisHutangBayar> & { id: number; createdAt: string }): BarisHutangBayar {
  const total = over.totalAmount ?? 100_000
  const paid = over.paidAmount ?? 0
  return {
    totalAmount: total,
    paidAmount: paid,
    remainingAmount: over.remainingAmount ?? total - paid,
    status: over.status ?? (paid > 0 ? 'PARTIAL' : 'UNPAID'),
    ...over,
  }
}

describe('alokasiPembayaranHutang', () => {
  it('melunasi berurutan dari yang paling lama saat nominal menutup semua', () => {
    const debts = [
      hutang({ id: 2, createdAt: '2026-02-01', totalAmount: 50_000 }),
      hutang({ id: 1, createdAt: '2026-01-01', totalAmount: 30_000 }),
    ]
    const hasil = alokasiPembayaranHutang(debts, 80_000)

    expect(hasil.totalDialokasikan).toBe(80_000)
    expect(hasil.sisaTakTeralokasi).toBe(0)
    expect(hasil.alokasi.map((a) => a.debtId)).toEqual([1, 2])
    expect(hasil.alokasi.every((a) => a.statusBaru === 'PAID')).toBe(true)
  })

  it('nominal sebagian: hutang tertua lunas, berikutnya jadi PARTIAL, sisanya tak tersentuh', () => {
    const debts = [
      hutang({ id: 1, createdAt: '2026-01-01', totalAmount: 30_000 }),
      hutang({ id: 2, createdAt: '2026-02-01', totalAmount: 50_000 }),
      hutang({ id: 3, createdAt: '2026-03-01', totalAmount: 20_000 }),
    ]
    const hasil = alokasiPembayaranHutang(debts, 45_000)

    expect(hasil.alokasi).toHaveLength(2)
    expect(hasil.alokasi[0]).toMatchObject({ debtId: 1, bayar: 30_000, remainingAmountBaru: 0, statusBaru: 'PAID' })
    expect(hasil.alokasi[1]).toMatchObject({ debtId: 2, bayar: 15_000, remainingAmountBaru: 35_000, statusBaru: 'PARTIAL' })
    expect(hasil.sisaTakTeralokasi).toBe(0)
  })

  it('menghormati cicilan yang sudah masuk — hanya menutup sisa', () => {
    const debts = [
      hutang({ id: 1, createdAt: '2026-01-01', totalAmount: 100_000, paidAmount: 80_000 }),
    ]
    const hasil = alokasiPembayaranHutang(debts, 20_000)

    expect(hasil.alokasi[0]).toMatchObject({
      debtId: 1,
      bayar: 20_000,
      paidAmountBaru: 100_000,
      remainingAmountBaru: 0,
      statusBaru: 'PAID',
    })
  })

  it('melewati hutang PAID dan VOIDED', () => {
    const debts = [
      hutang({ id: 1, createdAt: '2026-01-01', status: 'PAID', totalAmount: 30_000, paidAmount: 30_000, remainingAmount: 0 }),
      hutang({ id: 2, createdAt: '2026-01-02', status: 'VOIDED', totalAmount: 10_000, remainingAmount: 0 }),
      hutang({ id: 3, createdAt: '2026-01-03', totalAmount: 40_000 }),
    ]
    const hasil = alokasiPembayaranHutang(debts, 40_000)

    expect(hasil.alokasi).toHaveLength(1)
    expect(hasil.alokasi[0]).toMatchObject({ debtId: 3, statusBaru: 'PAID' })
  })

  it('nominal melebihi total sisa: mengalokasi semaksimal mungkin, sisa dilaporkan', () => {
    const debts = [hutang({ id: 1, createdAt: '2026-01-01', totalAmount: 30_000 })]
    const hasil = alokasiPembayaranHutang(debts, 50_000)

    expect(hasil.totalDialokasikan).toBe(30_000)
    expect(hasil.sisaTakTeralokasi).toBe(20_000)
  })

  it('tidak ada hutang aktif: alokasi kosong', () => {
    expect(alokasiPembayaranHutang([], 10_000)).toEqual({
      alokasi: [],
      totalDialokasikan: 0,
      sisaTakTeralokasi: 10_000,
    })
  })
})
