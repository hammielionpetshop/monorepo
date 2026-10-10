import Big from 'big.js'
import type { ShiftDayRecap, ShiftDayRecapNonCash, ShiftDayRecapShift } from '@petshop/shared'
import { formatWIB } from '@petshop/shared'

/**
 * Angka "Rekap Hari Ini" untuk struk settlement estafet. Dipakai bersama oleh struk ESC/POS
 * dan struk browser supaya keduanya selalu sama.
 */
export interface DayRecapView {
  shifts: ShiftDayRecapShift[]
  total: {
    cashSales: number
    nonCash: number
    debt: number
    discount: number
    expenses: number
    debtPaymentCash: number
    omzet: number
    realCash: number
  }
  nonCashByShift: { shiftNumber: number; payments: ShiftDayRecapNonCash[] }[]
  nonCashTotals: [string, number][]
}

export function buildDayRecapView(recap: ShiftDayRecap | null | undefined): DayRecapView | null {
  if (!recap || recap.shifts.length <= 1) return null

  const sum = (pick: (s: ShiftDayRecapShift) => number | null) =>
    recap.shifts.reduce((acc, s) => acc.add(pick(s) ?? 0), new Big(0)).toNumber()

  const nonCashByShift = recap.shifts
    .map((s) => ({
      shiftNumber: s.shiftNumber,
      payments: recap.nonCashPayments.filter((p) => p.shiftId === s.shiftId),
    }))
    .filter((g) => g.payments.length > 0)

  const totals = new Map<string, Big>()
  for (const p of recap.nonCashPayments) {
    totals.set(p.paymentMethodName, (totals.get(p.paymentMethodName) ?? new Big(0)).add(p.amount))
  }

  return {
    shifts: recap.shifts,
    total: {
      cashSales: sum((s) => s.cashSales),
      nonCash: sum((s) => s.nonCash),
      debt: sum((s) => s.debt),
      discount: sum((s) => s.discount),
      expenses: sum((s) => s.expenses),
      debtPaymentCash: sum((s) => s.debtPaymentCash),
      omzet: sum((s) => s.omzet),
      realCash: sum((s) => s.realCash),
    },
    nonCashByShift,
    nonCashTotals: Array.from(totals, ([method, amount]) => [method, amount.toNumber()]),
  }
}

function fmtTime(date: Date | string | null): string {
  return formatWIB(date, { hour: '2-digit', minute: '2-digit' })
}

/** "Shift #1  07.07-17.02  Tutup: Andi" (+ penanda ditutup paksa). */
export function dayRecapShiftTitle(s: ShiftDayRecapShift): string {
  const by = s.closedByName ? `  Tutup: ${s.closedByName}` : ''
  const forced = s.status === 'FORCE_CLOSED' ? ' (ditutup paksa)' : ''
  return `Shift #${s.shiftNumber}  ${fmtTime(s.openedAt)}-${fmtTime(s.closedAt)}${by}${forced}`
}
