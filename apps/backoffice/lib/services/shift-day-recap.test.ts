import { describe, expect, it, vi } from 'vitest'

// Hanya `db` yang dipalsukan (butuh DATABASE_URL); yang diuji di sini murni rumus hitungnya.
vi.mock('@/lib/db', () => ({ db: {} }))

const { aggregateDayRecap } = await import('./shift-day-recap')

const shift = (id: number, o: Record<string, unknown> = {}) => ({
  id,
  shiftNumber: id,
  status: 'CLOSED',
  openedAt: new Date('2026-10-10T00:00:00Z'),
  closedAt: new Date('2026-10-10T10:00:00Z'),
  forceClosedAt: null,
  closedByName: 'Andi',
  totalClosingCashReal: 100_000,
  ...o,
})

describe('aggregateDayRecap — rekap estafet per shift', () => {
  it('memisahkan tunai/non-tunai/hutang per shift dan mengurangi kembalian dari tunai', () => {
    const [s1, s2] = aggregateDayRecap({
      shifts: [shift(1), shift(2)],
      payments: [
        { shiftId: 1, type: 'CASH', amount: 120_000 },
        { shiftId: 1, type: 'QRIS', amount: 50_000 },
        { shiftId: 1, type: 'E_WALLET', amount: 10_000 },
        { shiftId: 1, type: 'DEBT', amount: 30_000 },
        { shiftId: 2, type: 'BANK_TRANSFER', amount: 75_000 },
      ],
      transactions: [
        { shiftId: 1, changeAmount: 20_000, discountAmount: 5_000 },
        { shiftId: 2, changeAmount: 0, discountAmount: 0 },
      ],
      expenses: [{ shiftId: 1, amount: 15_000 }],
      debtPaymentsCash: [{ shiftId: 2, amount: 40_000 }],
    })
    expect(s1).toMatchObject({ cashSales: 100_000, nonCash: 60_000, debt: 30_000, discount: 5_000, expenses: 15_000, omzet: 190_000 })
    expect(s2).toMatchObject({ cashSales: 0, nonCash: 75_000, debt: 0, debtPaymentCash: 40_000, omzet: 75_000 })
  })

  it('shift ditutup paksa memakai jam tutup paksa dan setoran kosong tetap null', () => {
    const [s] = aggregateDayRecap({
      shifts: [shift(1, { status: 'FORCE_CLOSED', closedAt: null, forceClosedAt: new Date('2026-10-10T16:59:00Z'), totalClosingCashReal: null })],
      payments: [],
      transactions: [],
      expenses: [],
      debtPaymentsCash: [],
    })
    expect(s.closedAt).toEqual(new Date('2026-10-10T16:59:00Z'))
    expect(s.realCash).toBeNull()
  })
})
