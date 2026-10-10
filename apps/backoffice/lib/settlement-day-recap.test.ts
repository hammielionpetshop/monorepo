import { describe, expect, it } from 'vitest'
import { buildDayRecapView } from './settlement-day-recap'

const s = (shiftId: number, realCash: number | null) => ({
  shiftId,
  shiftNumber: shiftId,
  status: 'CLOSED' as const,
  openedAt: new Date(),
  closedAt: new Date(),
  closedByName: null,
  cashSales: 100,
  nonCash: 50,
  debt: 10,
  discount: 0,
  expenses: 5,
  debtPaymentCash: 7,
  omzet: 160,
  realCash,
  expectedCash: null,
  variance: null,
})

describe('buildDayRecapView', () => {
  it('kosong bila hanya satu shift hari itu', () => {
    expect(buildDayRecapView(null)).toBeNull()
    expect(buildDayRecapView({ shifts: [s(1, 100)], nonCashPayments: [] })).toBeNull()
  })

  it('menjumlah semua shift; setoran yang belum dihitung dianggap 0', () => {
    const view = buildDayRecapView({
      shifts: [s(1, 95), s(2, null)],
      nonCashPayments: [
        { shiftId: 1, createdAt: new Date(), amount: 30, paymentMethodName: 'QRIS' },
        { shiftId: 2, createdAt: new Date(), amount: 20, paymentMethodName: 'QRIS' },
        { shiftId: 2, createdAt: new Date(), amount: 5, paymentMethodName: 'Transfer' },
      ],
    })!
    expect(view.total).toEqual({ cashSales: 200, nonCash: 100, debt: 20, discount: 0, expenses: 10, debtPaymentCash: 14, omzet: 320, realCash: 95 })
    expect(view.nonCashByShift.map((g) => [g.shiftNumber, g.payments.length])).toEqual([[1, 1], [2, 2]])
    expect(view.nonCashTotals).toEqual([['QRIS', 50], ['Transfer', 5]])
  })
})
