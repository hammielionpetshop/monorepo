import { describe, expect, it } from 'vitest'
import type { ShiftBreakdownSummary, ShiftCashierBreakdown } from '@petshop/shared'
import { buildSettlementEscpos, type SettlementPrintData } from './escpos-settlement'

const COLUMNS = 56

function breakdown(overrides: Partial<ShiftCashierBreakdown> = {}): ShiftCashierBreakdown {
  return {
    cashierId: 1,
    cashierName: 'Budi',
    totalSalesCash: 500_000,
    totalSalesQris: 200_000,
    totalSalesDebit: 0,
    totalSalesCredit: 0,
    totalSalesDebt: 0,
    totalSales: 700_000,
    totalDiscount: 0,
    totalTransactions: 12,
    totalExpenses: 0,
    modalShare: 0,
    expectedCash: 500_000,
    realCash: null,
    variance: null,
    isVarianceFlagged: false,
    ...overrides,
  }
}

function summary(overrides: Partial<ShiftBreakdownSummary> = {}): ShiftBreakdownSummary {
  return {
    shift: {
      id: 1,
      branchId: 1,
      openedById: 1,
      shiftNumber: 7,
      assignedCashiers: [1],
      openingCash: 300_000,
      status: 'CLOSED',
      openedAt: new Date('2026-08-31T01:00:00Z'),
      closedAt: new Date('2026-08-31T10:00:00Z'),
      totalClosingCashExpected: 500_000,
      totalClosingCashReal: 495_000,
      totalVariance: -5_000,
      settlementNotes: null,
    },
    breakdowns: [breakdown()],
    totalExpectedCash: 500_000,
    totalRealCash: 495_000,
    totalVariance: -5_000,
    nonCashPayments: [],
    debtPaymentsReceived: [],
    expenses: [],
    ...overrides,
  }
}

function data(overrides: Partial<SettlementPrintData> = {}): SettlementPrintData {
  return {
    summary: summary(),
    storeName: 'HAMMIELION',
    storeAddress: 'Jl. Contoh No. 1',
    storePhone: '0812345678',
    closedByName: 'Budi',
    shiftNumber: 7,
    ...overrides,
  }
}

/** Buang semua perintah ESC/POS, sisakan baris teks yang benar-benar tercetak. */
function printedLines(escpos: string): string[] {
  return escpos
    .replace(/\x1B@/g, '')
    .replace(/\x1B[Mat]./g, '')
    .replace(/\x1BE./g, '')
    .replace(/\x1Bd./g, '')
    .replace(/\x1D!./g, '')
    .replace(/\x1DV../g, '')
    .split('\n')
    .filter((line) => line.length > 0)
}

describe('lebar kertas', () => {
  it('tidak ada baris yang melebihi lebar kolom, bahkan dengan teks bebas yang panjang', () => {
    const escpos = buildSettlementEscpos(
      data({
        storeAddress: 'Jl. Raya Pahlawan Seribu Ruko Golden Boulevard Blok A No. 12 Serpong Tangerang Selatan',
        closedByName: 'Bapak Muhammad Abdurrahman Wahid Hasyim Asyari Yang Terhormat',
        summary: summary({
          breakdowns: [
            breakdown({ cashierName: 'Kasir Dengan Nama Yang Sangat Panjang Sekali Melebihi Kertas', totalExpenses: 50_000, totalDiscount: 12_345, totalSalesDebt: 99_000 }),
          ],
          nonCashPayments: [
            { createdAt: new Date('2026-08-31T05:00:00Z'), amount: 12_500_000, paymentMethodName: 'QRIS BCA Merchant Utama' },
          ],
          debtPaymentsReceived: [
            {
              createdAt: new Date('2026-08-31T06:00:00Z'),
              amount: 250_000,
              paymentMethodName: 'Transfer Bank Mandiri',
              isCash: false,
              customerName: 'Toko Sumber Rejeki Makmur Sentosa Abadi',
              trxNumber: 'TRX-20260830-000123',
              receivedByName: 'Siti Nurhaliza',
            },
          ],
          expenses: [
            {
              createdAt: new Date('2026-08-31T07:00:00Z'),
              amount: 75_000,
              note: 'Beli galon air minum isi ulang dan camilan untuk semua kasir yang lembur hari ini',
              categoryName: 'Konsumsi Operasional Harian Toko',
              cashierName: 'Budi Santoso',
            },
          ],
          shift: { ...summary().shift, settlementNotes: 'Uang receh kurang, sudah dilaporkan ke supervisor. Selisih ditanggung bersama sesuai kesepakatan.' },
        }),
      })
    )

    for (const line of printedLines(escpos)) {
      expect(line.length).toBeLessThanOrEqual(COLUMNS)
    }
  })
})

describe('perataan angka', () => {
  it('OMZET dan SELISIH rata kanan tepat di kolom terakhir', () => {
    const lines = printedLines(buildSettlementEscpos(data()))
    const omzet = lines.find((l) => l.startsWith('OMZET'))
    const selisih = lines.find((l) => l.startsWith('SELISIH'))
    expect(omzet).toBeDefined()
    expect(omzet!.length).toBe(COLUMNS)
    expect(selisih!.length).toBe(COLUMNS)
  })
})

describe('isi laporan', () => {
  it('omzet = kas penjualan (net kembalian) + non-tunai + hutang', () => {
    // 1 kasir: expectedCash 500rb + expenses 0 + qris 200rb + debt 0 = 700rb
    const lines = printedLines(buildSettlementEscpos(data()))
    expect(lines.find((l) => l.startsWith('OMZET'))!.replace(/\D/g, '')).toBe('700000')
  })

  it('selisih negatif ditandai (Kurang)', () => {
    const lines = printedLines(buildSettlementEscpos(data()))
    expect(lines.find((l) => l.startsWith('SELISIH'))).toContain('(Kurang)')
  })

  it('selisih positif ditandai (Lebih)', () => {
    const lines = printedLines(
      buildSettlementEscpos(data({ summary: summary({ totalVariance: 3_000, totalRealCash: 503_000 }) }))
    )
    expect(lines.find((l) => l.startsWith('SELISIH'))).toContain('(Lebih)')
  })

  it('blok opsional muncul hanya bila ada datanya', () => {
    const kosong = printedLines(buildSettlementEscpos(data()))
    expect(kosong.some((l) => l.includes('TRANSAKSI NON-TUNAI'))).toBe(false)
    expect(kosong.some((l) => l.includes('PELUNASAN PIUTANG'))).toBe(false)
    expect(kosong.some((l) => l.includes('RINCIAN PENGELUARAN'))).toBe(false)

    const isi = printedLines(
      buildSettlementEscpos(
        data({
          summary: summary({
            nonCashPayments: [{ createdAt: new Date(), amount: 50_000, paymentMethodName: 'QRIS' }],
            expenses: [{ createdAt: new Date(), amount: 20_000, note: 'parkir', categoryName: 'Transport', cashierName: 'Budi' }],
          }),
        })
      )
    )
    expect(isi.some((l) => l.includes('TRANSAKSI NON-TUNAI'))).toBe(true)
    expect(isi.some((l) => l.includes('RINCIAN PENGELUARAN'))).toBe(true)
  })

  it('nama toko jatuh ke HAMMIELION bila tidak diberikan', () => {
    const lines = printedLines(buildSettlementEscpos(data({ storeName: undefined })))
    expect(lines[0]).toBe('HAMMIELION')
  })

  it('alamat & telepon kosong tidak menyisakan baris hampa', () => {
    const lines = printedLines(buildSettlementEscpos(data({ storeAddress: null, storePhone: null })))
    expect(lines.some((l) => l.trim() === '')).toBe(false)
    expect(lines.some((l) => l.includes('Telp:'))).toBe(false)
  })
})

describe('keamanan CP437', () => {
  it('seluruh keluaran bebas dari karakter di luar ASCII cetak', () => {
    const escpos = buildSettlementEscpos(
      data({
        storeName: 'HAMMIELION – PUSAT',
        closedByName: 'Budi “Bos” Santoso',
        summary: summary({ shift: { ...summary().shift, settlementNotes: 'Selisih ± 5.000 — sudah dicek' } }),
      })
    )
    for (const line of printedLines(escpos)) {
      expect(line).toMatch(/^[\x20-\x7E]*$/)
    }
  })
})

describe('perintah printer', () => {
  it('diawali inisialisasi, tabel kode, dan pemilihan font', () => {
    expect(buildSettlementEscpos(data()).startsWith('\x1B@\x1Bt\x00\x1BM')).toBe(true)
  })

  it('diakhiri feed lalu potong kertas', () => {
    expect(buildSettlementEscpos(data()).endsWith('\x1Bd\x04\x1DV\x42\x00')).toBe(true)
  })

  it('tidak meninggalkan bold atau rata tengah menyala di akhir', () => {
    const escpos = buildSettlementEscpos(data())
    expect(escpos.lastIndexOf('\x1BE\x00')).toBeGreaterThan(escpos.lastIndexOf('\x1BE\x01'))
    expect(escpos.lastIndexOf('\x1Ba\x00')).toBeGreaterThan(escpos.lastIndexOf('\x1Ba\x01'))
  })
})

describe('estafet — rekap hari ini di struk shift ke-2', () => {
  const recapShift = (o: Partial<import('@petshop/shared').ShiftDayRecapShift>) => ({
    shiftId: 1,
    shiftNumber: 1,
    status: 'CLOSED' as const,
    openedAt: new Date('2026-10-10T00:07:00Z'),
    closedAt: new Date('2026-10-10T10:02:00Z'),
    closedByName: 'Andi',
    cashSales: 6_750_000,
    nonCash: 2_310_000,
    debt: 150_000,
    discount: 0,
    expenses: 27_410,
    debtPaymentCash: 0,
    omzet: 9_210_000,
    realCash: 6_723_000,
    ...o,
  })
  const dayRecap = {
    shifts: [
      recapShift({}),
      recapShift({ shiftId: 2, shiftNumber: 2, openedAt: new Date('2026-10-10T10:05:00Z'), closedAt: new Date('2026-10-10T12:57:00Z'), closedByName: 'Rina', cashSales: 893_000, nonCash: 412_000, debt: 0, expenses: 0, omzet: 1_305_000, realCash: 893_000, debtPaymentCash: 0 }),
    ],
    nonCashPayments: [
      { shiftId: 1, createdAt: new Date('2026-10-10T01:15:00Z'), amount: 85_000, paymentMethodName: 'QRIS' },
      { shiftId: 2, createdAt: new Date('2026-10-10T10:30:00Z'), amount: 112_000, paymentMethodName: 'QRIS' },
    ],
  }
  const lines = () => printedLines(buildSettlementEscpos(data({ shiftNumber: 2, summary: summary({ dayRecap }) })))

  it('menampilkan tiap shift dan total hari ini', () => {
    const text = lines().join('\n')
    expect(text).toContain('REKAP HARI INI (SEMUA SHIFT)')
    expect(text).toContain('Shift #1  07.07-17.02  Tutup: Andi')
    expect(text).toContain('Shift #2  17.05-19.57  Tutup: Rina')
    expect(text).toContain('TOTAL HARI INI')
    expect(text).toMatch(/OMZET +Rp 10\.515\.000/)
    expect(text).toMatch(/Kas Disetor +Rp 7\.616\.000/)
  })

  it('non-tunai mencakup semua shift hari ini, dikelompokkan per shift', () => {
    const text = lines().join('\n')
    expect(text).toContain('TRANSAKSI NON-TUNAI (HARI INI)')
    expect(text).toContain('-- Shift #1 --')
    expect(text).toContain('-- Shift #2 --')
    expect(text).toMatch(/QRIS +Rp 197\.000/)
  })

  it('rekonsiliasi kas tetap hanya shift ini', () => {
    const text = lines().join('\n')
    expect(text).toContain('REKONSILIASI KAS (SHIFT #2 SAJA)')
    expect(text).toMatch(/Kas Disetor +Rp 495\.000/)
  })

  it('shift ditutup paksa diberi tanda dan setoran kosong tertulis belum dihitung', () => {
    const text = printedLines(
      buildSettlementEscpos(
        data({
          shiftNumber: 2,
          summary: summary({
            dayRecap: { ...dayRecap, shifts: [recapShift({ status: 'FORCE_CLOSED', closedByName: null, realCash: null }), dayRecap.shifts[1]] },
          }),
        })
      )
    ).join('\n')
    expect(text).toContain('(ditutup paksa)')
    expect(text).toMatch(/Kas Disetor +belum dihitung/)
  })

  it('tetap dalam lebar kertas', () => {
    for (const line of lines()) expect(line.length).toBeLessThanOrEqual(COLUMNS)
  })

  it('tanpa rekap (shift pertama), struk tetap seperti dulu', () => {
    const text = printedLines(buildSettlementEscpos(data())).join('\n')
    expect(text).not.toContain('REKAP HARI INI')
    expect(text).toContain('REKONSILIASI KAS')
    expect(text).not.toContain('SAJA)')
  })
})
