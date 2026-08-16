import { describe, it, expect } from 'vitest'
import { hitungPemotonganPiutang, hitungPengembalianPiutang } from './retur-debt'

/** Piutang penuh belum dibayar sepeser pun. */
function hutangBaru(total: number, id = 1) {
  return { id, totalAmount: total, paidAmount: 0, remainingAmount: total }
}

describe('hitungPemotonganPiutang', () => {
  it('memotong piutang sebesar nilai retur saat hutangnya masih utuh', () => {
    const hasil = hitungPemotonganPiutang([hutangBaru(100_000)], 30_000)

    expect(hasil.totalPotongan).toBe(30_000)
    expect(hasil.refundTunai).toBe(0)
    expect(hasil.potongan[0]).toMatchObject({
      debtId: 1,
      potongan: 30_000,
      totalAmountBaru: 70_000,
      remainingAmountBaru: 70_000,
      statusBaru: 'UNPAID',
    })
  })

  it('menandai VOIDED saat retur menghabiskan hutang yang belum pernah dibayar', () => {
    const hasil = hitungPemotonganPiutang([hutangBaru(100_000)], 100_000)

    expect(hasil.totalPotongan).toBe(100_000)
    expect(hasil.refundTunai).toBe(0)
    expect(hasil.potongan[0]).toMatchObject({
      totalAmountBaru: 0,
      remainingAmountBaru: 0,
      statusBaru: 'VOIDED',
    })
  })

  it('hanya memotong SISA hutang; uang yang sudah dibayar dikembalikan tunai', () => {
    // Total 100rb, sudah dibayar 80rb, sisa 20rb. Retur 50rb.
    const hutang = { id: 1, totalAmount: 100_000, paidAmount: 80_000, remainingAmount: 20_000 }
    const hasil = hitungPemotonganPiutang([hutang], 50_000)

    expect(hasil.totalPotongan).toBe(20_000)
    // 30rb sisanya uang pelanggan yang sudah masuk — harus dikembalikan, bukan dihapus.
    expect(hasil.refundTunai).toBe(30_000)
    expect(hasil.potongan[0]).toMatchObject({
      totalAmountBaru: 80_000,
      remainingAmountBaru: 0,
      statusBaru: 'PAID',
    })
    // Invarian yang tidak boleh pecah: remaining = total - paid, dan total tidak pernah
    // jatuh di bawah uang yang sudah diterima.
    const p = hasil.potongan[0]
    expect(p.remainingAmountBaru).toBe(p.totalAmountBaru - hutang.paidAmount)
    expect(p.totalAmountBaru).toBeGreaterThanOrEqual(hutang.paidAmount)
  })

  it('menyisakan status PARTIAL bila masih ada sisa setelah dipotong', () => {
    const hutang = { id: 1, totalAmount: 100_000, paidAmount: 40_000, remainingAmount: 60_000 }
    const hasil = hitungPemotonganPiutang([hutang], 10_000)

    expect(hasil.potongan[0]).toMatchObject({
      totalAmountBaru: 90_000,
      remainingAmountBaru: 50_000,
      statusBaru: 'PARTIAL',
    })
  })

  it('mengembalikan seluruh refund sebagai tunai saat transaksi tidak punya piutang', () => {
    const hasil = hitungPemotonganPiutang([], 75_000)

    expect(hasil.potongan).toHaveLength(0)
    expect(hasil.totalPotongan).toBe(0)
    expect(hasil.refundTunai).toBe(75_000)
  })

  it('membagi refund ke beberapa baris hutang secara berurutan', () => {
    const hasil = hitungPemotonganPiutang([hutangBaru(30_000, 1), hutangBaru(50_000, 2)], 60_000)

    expect(hasil.totalPotongan).toBe(60_000)
    expect(hasil.refundTunai).toBe(0)
    expect(hasil.potongan.map((p) => [p.debtId, p.potongan])).toEqual([
      [1, 30_000],
      [2, 30_000],
    ])
    expect(hasil.potongan[1].statusBaru).toBe('UNPAID')
  })

  it('melewati baris hutang yang sisanya sudah nol', () => {
    const lunas = { id: 1, totalAmount: 50_000, paidAmount: 50_000, remainingAmount: 0 }
    const hasil = hitungPemotonganPiutang([lunas, hutangBaru(40_000, 2)], 25_000)

    expect(hasil.potongan).toHaveLength(1)
    expect(hasil.potongan[0].debtId).toBe(2)
    expect(hasil.totalPotongan).toBe(25_000)
  })

  it('tidak memotong apa pun saat nilai retur nol', () => {
    const hasil = hitungPemotonganPiutang([hutangBaru(100_000)], 0)

    expect(hasil.potongan).toHaveLength(0)
    expect(hasil.totalPotongan).toBe(0)
    expect(hasil.refundTunai).toBe(0)
  })
})

describe('hitungPengembalianPiutang', () => {
  it('mengembalikan hutang persis sebesar yang dulu dipotong', () => {
    const setelahRetur = { id: 1, totalAmount: 70_000, paidAmount: 0, remainingAmount: 70_000 }
    const pulih = hitungPengembalianPiutang(setelahRetur, 30_000)

    expect(pulih).toMatchObject({
      debtId: 1,
      pengembalian: 30_000,
      totalAmountBaru: 100_000,
      remainingAmountBaru: 100_000,
      statusBaru: 'UNPAID',
    })
  })

  it('menghidupkan kembali hutang yang sempat habis jadi VOIDED', () => {
    const habis = { id: 1, totalAmount: 0, paidAmount: 0, remainingAmount: 0 }
    const pulih = hitungPengembalianPiutang(habis, 100_000)

    expect(pulih.totalAmountBaru).toBe(100_000)
    expect(pulih.remainingAmountBaru).toBe(100_000)
    expect(pulih.statusBaru).toBe('UNPAID')
  })

  it('kembali ke PARTIAL bila hutangnya sudah dibayar sebagian', () => {
    const setelahRetur = { id: 1, totalAmount: 80_000, paidAmount: 80_000, remainingAmount: 0 }
    const pulih = hitungPengembalianPiutang(setelahRetur, 20_000)

    expect(pulih.totalAmountBaru).toBe(100_000)
    expect(pulih.remainingAmountBaru).toBe(20_000)
    expect(pulih.statusBaru).toBe('PARTIAL')
  })

  it('potong lalu batalkan mengembalikan hutang ke keadaan semula', () => {
    const awal = { id: 1, totalAmount: 100_000, paidAmount: 40_000, remainingAmount: 60_000 }
    const potong = hitungPemotonganPiutang([awal], 25_000).potongan[0]

    const setelahRetur = {
      id: awal.id,
      totalAmount: potong.totalAmountBaru,
      paidAmount: awal.paidAmount,
      remainingAmount: potong.remainingAmountBaru,
    }
    const pulih = hitungPengembalianPiutang(setelahRetur, potong.potongan)

    expect(pulih.totalAmountBaru).toBe(awal.totalAmount)
    expect(pulih.remainingAmountBaru).toBe(awal.remainingAmount)
    expect(pulih.statusBaru).toBe('PARTIAL')
  })
})
