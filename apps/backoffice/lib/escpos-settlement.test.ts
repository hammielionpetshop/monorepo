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
