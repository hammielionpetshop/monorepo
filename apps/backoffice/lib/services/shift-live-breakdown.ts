import {
  db, shiftCashierSessions, transactions, transactionPayments, paymentMethods,
  shiftExpenses, users, eq, and, inArray,
} from '@/lib/db'
import { getShiftDebtCash } from './shift-debt-cash'
import type { ShiftCashierBreakdown, ShiftDebtPaymentReceived } from '@petshop/shared'

type Runner = Pick<typeof db, 'select'>

export interface LiveShiftBreakdown {
  breakdowns: ShiftCashierBreakdown[]
  /** Kas penjualan semua kasir + pelunasan piutang tunai. Modal awal tidak termasuk. */
  totalExpectedCash: number
  totalDebtPaymentCash: number
  debtPaymentsReceived: ShiftDebtPaymentReceived[]
  totalDiscount: number
  totalSales: number
  totalExpenses: number
  totalTransactions: number
}

/**
 * Hitung rincian per kasir langsung dari transaksi & pengeluaran shift — tanpa menunggu
 * settlement. Rumusnya sengaja disamakan dengan pratinjau POS & settlement, supaya angka
 * estimasi di backoffice tidak berbeda dengan yang nanti tercatat saat shift ditutup.
 */
export async function computeLiveShiftBreakdown(
  runner: Runner,
  shiftId: number,
  assignedCashiers: number[] | null
): Promise<LiveShiftBreakdown> {
  const allExpenses = await runner
    .select({ cashierId: shiftExpenses.cashierId, amount: shiftExpenses.amount })
    .from(shiftExpenses)
    .where(eq(shiftExpenses.shiftId, shiftId))

  const allTransactions = await runner
    .select({
      id: transactions.id,
      cashierId: transactions.cashierId,
      changeAmount: transactions.changeAmount,
      discountAmount: transactions.discountAmount,
    })
    .from(transactions)
    .where(and(eq(transactions.shiftId, shiftId), eq(transactions.status, 'COMPLETED')))

  const sessions = await runner
    .select({ cashierId: shiftCashierSessions.cashierId })
    .from(shiftCashierSessions)
    .where(eq(shiftCashierSessions.shiftId, shiftId))

  // Gabungkan semua kasir yang terlibat: yang ditugaskan saat buka shift, yang gabung di
  // tengah shift, dan siapapun yang punya transaksi/pengeluaran. assignedCashiers hanyalah
  // snapshot saat buka shift — tidak boleh jadi satu-satunya sumber.
  const cashierIdSet = new Set<number>([
    ...(assignedCashiers ?? []),
    ...sessions.map((s) => s.cashierId),
    ...allTransactions.map((t) => t.cashierId),
    ...allExpenses.map((e) => e.cashierId),
  ])
  const cashierIds = Array.from(cashierIdSet).filter((id): id is number => id != null)

  const cashiers = cashierIds.length > 0
    ? await runner.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, cashierIds))
    : []

  const paymentRows = allTransactions.length > 0
    ? await runner
        .select({
          cashierId: transactions.cashierId,
          amount: transactionPayments.amount,
          type: paymentMethods.type,
        })
        .from(transactionPayments)
        .innerJoin(transactions, eq(transactionPayments.transactionId, transactions.id))
        .innerJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
        .where(and(eq(transactions.shiftId, shiftId), eq(transactions.status, 'COMPLETED')))
    : []

  const breakdowns = aggregateShiftBreakdown({
    cashiers,
    transactions: allTransactions,
    payments: paymentRows,
    expenses: allExpenses,
  })

  // Pelunasan piutang tunai juga masuk laci walau bukan penjualan shift ini, jadi harus
  // ikut dihitung — kalau tidak, uangnya muncul sebagai kelebihan kas tanpa asal-usul.
  const debtCash = await getShiftDebtCash(runner, shiftId)

  return {
    breakdowns,
    totalExpectedCash: breakdowns.reduce((sum, b) => sum + b.expectedCash, 0) + debtCash.totalCash,
    totalDebtPaymentCash: debtCash.totalCash,
    debtPaymentsReceived: debtCash.payments,
    totalDiscount: breakdowns.reduce((sum, b) => sum + b.totalDiscount, 0),
    totalSales: breakdowns.reduce((sum, b) => sum + b.totalSales, 0),
    totalExpenses: breakdowns.reduce((sum, b) => sum + b.totalExpenses, 0),
    totalTransactions: breakdowns.reduce((sum, b) => sum + b.totalTransactions, 0),
  }
}

export interface AggregateInput {
  cashiers: { id: number; name: string }[]
  transactions: { cashierId: number; changeAmount: number | string; discountAmount: number | string }[]
  payments: { cashierId: number; amount: number | string; type: string }[]
  expenses: { cashierId: number; amount: number | string }[]
}

/** Bagian murni dari perhitungan — dipisah supaya bisa diuji tanpa database. */
export function aggregateShiftBreakdown(input: AggregateInput): ShiftCashierBreakdown[] {
  const breakdowns: ShiftCashierBreakdown[] = []

  for (const user of input.cashiers) {
    const cashierTransactions = input.transactions.filter((t) => t.cashierId === user.id)

    let totalSalesCash = 0
    let totalSalesQris = 0
    let totalSalesDebit = 0
    let totalSalesCredit = 0
    let totalSalesDebt = 0
    let totalSales = 0

    for (const p of input.payments) {
      if (p.cashierId !== user.id) continue
      const amt = Number(p.amount)
      totalSales += amt
      if (p.type === 'CASH') totalSalesCash += amt
      else if (p.type === 'DEBT') totalSalesDebt += amt
      else if (p.type === 'QRIS') totalSalesQris += amt
      else if (p.type === 'BANK_TRANSFER') totalSalesDebit += amt
      // E-WALLET & metode non-tunai lain dijumlahkan sebagai non-tunai
      else totalSalesCredit += amt
    }

    const totalChange = cashierTransactions.reduce((sum, t) => sum + Number(t.changeAmount), 0)
    const totalDiscount = cashierTransactions.reduce((sum, t) => sum + Number(t.discountAmount), 0)

    const totalExpenses = input.expenses
      .filter((e) => e.cashierId === user.id)
      .reduce((sum, e) => sum + Number(e.amount), 0)

    // Tendered tidak pernah dicatat: pakai kas penjualan & total penjualan NET (setelah kembalian).
    totalSalesCash = totalSalesCash - totalChange
    totalSales = totalSales - totalChange

    // Sembunyikan kasir tanpa aktivitas (mis. gabung shift tapi tidak menjual & tidak ada pengeluaran).
    if (cashierTransactions.length === 0 && totalExpenses === 0) continue

    breakdowns.push({
      cashierId: user.id,
      cashierName: user.name,
      totalSalesCash,
      totalSalesQris,
      totalSalesDebit,
      totalSalesCredit,
      totalSalesDebt,
      totalSales,
      totalDiscount,
      totalTransactions: cashierTransactions.length,
      totalExpenses,
      modalShare: 0,
      // Net cash masuk laci = kas penjualan net − pengeluaran tunai. Modal terpisah.
      expectedCash: totalSalesCash - totalExpenses,
      isVarianceFlagged: false, // belum settle — tidak ada selisih yang bisa dihitung
    })
  }

  return breakdowns
}
