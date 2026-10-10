import Big from 'big.js'
import { db, shifts, transactions, transactionPayments, paymentMethods, shiftExpenses, debtPayments, users, eq, and, or, ne, gte, lt, inArray, isNull, asc, sql } from '@/lib/db'
import type { ShiftDayRecap, ShiftDayRecapShift } from '@petshop/shared'
import { wibDayStart } from '@/lib/shift-auto-close-time'

type Runner = Pick<typeof db, 'select'>

interface RecapShiftRow {
  id: number
  shiftNumber: number
  status: string
  openedAt: Date
  closedAt: Date | null
  forceClosedAt: Date | null
  closedByName: string | null
  totalClosingCashReal: number | null
}

/**
 * Susun angka rekap per shift. Rumusnya sama dengan settlement: kas penjualan dikurangi
 * kembalian, E-WALLET & metode lain dihitung non-tunai, hutang terpisah.
 */
export function aggregateDayRecap(input: {
  shifts: RecapShiftRow[]
  payments: { shiftId: number; type: string; amount: number }[]
  transactions: { shiftId: number; changeAmount: number; discountAmount: number }[]
  expenses: { shiftId: number; amount: number }[]
  debtPaymentsCash: { shiftId: number; amount: number }[]
}): ShiftDayRecapShift[] {
  return input.shifts.map((s) => {
    let cash = new Big(0)
    let nonCash = new Big(0)
    let debt = new Big(0)
    for (const p of input.payments) {
      if (p.shiftId !== s.id) continue
      if (p.type === 'CASH') cash = cash.add(p.amount)
      else if (p.type === 'DEBT') debt = debt.add(p.amount)
      else nonCash = nonCash.add(p.amount)
    }
    let discount = new Big(0)
    for (const t of input.transactions) {
      if (t.shiftId !== s.id) continue
      cash = cash.minus(t.changeAmount)
      discount = discount.add(t.discountAmount)
    }
    const expenses = input.expenses
      .filter((e) => e.shiftId === s.id)
      .reduce((sum, e) => sum.add(e.amount), new Big(0))
    const debtPaymentCash = input.debtPaymentsCash
      .filter((d) => d.shiftId === s.id)
      .reduce((sum, d) => sum.add(d.amount), new Big(0))

    return {
      shiftId: s.id,
      shiftNumber: s.shiftNumber,
      status: s.status as ShiftDayRecapShift['status'],
      openedAt: s.openedAt,
      closedAt: s.closedAt ?? s.forceClosedAt,
      closedByName: s.closedByName,
      cashSales: cash.toNumber(),
      nonCash: nonCash.toNumber(),
      debt: debt.toNumber(),
      discount: discount.toNumber(),
      expenses: expenses.toNumber(),
      debtPaymentCash: debtPaymentCash.toNumber(),
      omzet: cash.add(nonCash).add(debt).toNumber(),
      realCash: s.totalClosingCashReal,
    }
  })
}

/**
 * Rekap estafet: semua shift cabang yang dibuka di hari WIB yang sama dengan shift ini,
 * sampai shift ini sendiri. Shift lain yang masih OPEN tidak ikut (angkanya belum final).
 * Mengembalikan null bila hari itu hanya ada satu shift — struk tetap seperti biasa.
 */
export async function getShiftDayRecap(
  runner: Runner,
  shift: { id: number; branchId: number; openedAt: Date }
): Promise<ShiftDayRecap | null> {
  const shiftRows = await runner
    .select({
      id: shifts.id,
      shiftNumber: shifts.shiftNumber,
      status: shifts.status,
      openedAt: shifts.openedAt,
      closedAt: shifts.closedAt,
      forceClosedAt: shifts.forceClosedAt,
      closedByName: users.name,
      totalClosingCashReal: shifts.totalClosingCashReal,
    })
    .from(shifts)
    .leftJoin(users, sql`${users.id} = coalesce(${shifts.closedById}, ${shifts.forceClosedById})`)
    .where(
      and(
        eq(shifts.branchId, shift.branchId),
        gte(shifts.openedAt, wibDayStart(shift.openedAt)),
        // Shift ini sendiri dicocokkan lewat id: opened_at di DB presisi mikrodetik, Date JS
        // hanya milidetik, jadi perbandingan waktu bisa menyingkirkan shift ini.
        or(
          eq(shifts.id, shift.id),
          and(ne(shifts.status, 'OPEN'), lt(shifts.openedAt, shift.openedAt))
        )
      )
    )
    .orderBy(asc(shifts.openedAt))

  if (shiftRows.length <= 1) return null

  const shiftIds = shiftRows.map((s) => s.id)

  const [paymentRows, trxRows, expenseRows, debtCashRows, nonCashRows] = await Promise.all([
    runner
      .select({ shiftId: transactions.shiftId, type: paymentMethods.type, amount: transactionPayments.amount })
      .from(transactionPayments)
      .innerJoin(transactions, eq(transactionPayments.transactionId, transactions.id))
      .innerJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
      .where(and(inArray(transactions.shiftId, shiftIds), eq(transactions.status, 'COMPLETED'))),
    runner
      .select({ shiftId: transactions.shiftId, changeAmount: transactions.changeAmount, discountAmount: transactions.discountAmount })
      .from(transactions)
      .where(and(inArray(transactions.shiftId, shiftIds), eq(transactions.status, 'COMPLETED'))),
    runner
      .select({ shiftId: shiftExpenses.shiftId, amount: shiftExpenses.amount })
      .from(shiftExpenses)
      .where(inArray(shiftExpenses.shiftId, shiftIds)),
    // Sama dengan getShiftDebtCash: pelunasan tunai yang belum di-void.
    runner
      .select({ shiftId: debtPayments.shiftId, amount: debtPayments.amount })
      .from(debtPayments)
      .innerJoin(paymentMethods, eq(debtPayments.paymentMethodId, paymentMethods.id))
      .where(and(inArray(debtPayments.shiftId, shiftIds), isNull(debtPayments.voidedAt), eq(paymentMethods.type, 'CASH'))),
    runner
      .select({
        shiftId: transactions.shiftId,
        createdAt: transactions.createdAt,
        amount: transactionPayments.amount,
        paymentMethodName: paymentMethods.name,
      })
      .from(transactionPayments)
      .innerJoin(transactions, eq(transactionPayments.transactionId, transactions.id))
      .innerJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
      .where(
        and(
          inArray(transactions.shiftId, shiftIds),
          eq(transactions.status, 'COMPLETED'),
          ne(paymentMethods.type, 'CASH'),
          ne(paymentMethods.type, 'DEBT')
        )
      )
      .orderBy(asc(transactions.createdAt)),
  ])

  const recapShifts = aggregateDayRecap({
    shifts: shiftRows.map((s) => ({
      ...s,
      totalClosingCashReal: s.totalClosingCashReal != null ? Number(s.totalClosingCashReal) : null,
    })),
    payments: paymentRows.map((p) => ({ shiftId: Number(p.shiftId), type: p.type, amount: Number(p.amount) })),
    transactions: trxRows.map((t) => ({
      shiftId: Number(t.shiftId),
      changeAmount: Number(t.changeAmount),
      discountAmount: Number(t.discountAmount),
    })),
    expenses: expenseRows.map((e) => ({ shiftId: e.shiftId, amount: Number(e.amount) })),
    debtPaymentsCash: debtCashRows.map((d) => ({ shiftId: Number(d.shiftId), amount: Number(d.amount) })),
  })

  return {
    shifts: recapShifts,
    nonCashPayments: nonCashRows.map((r) => ({
      shiftId: Number(r.shiftId),
      createdAt: r.createdAt,
      amount: Number(r.amount),
      paymentMethodName: r.paymentMethodName,
    })),
  }
}
