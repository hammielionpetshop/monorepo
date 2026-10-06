import { db, shifts, shiftCashierBreakdown, transactions, transactionPayments, paymentMethods, shiftExpenses, users, eq, and, inArray } from '@/lib/db'

export class ShiftNotOpenError extends Error {
  constructor() {
    super('SHIFT_NOT_OPEN')
    this.name = 'ShiftNotOpenError'
  }
}

/**
 * Tutup paksa shift: hitung rincian per kasir dari transaksi & pengeluaran, tanpa kas fisik.
 * Dipakai tombol Tutup Paksa di kasir dan penutupan otomatis 23.59 (kanban #53).
 *
 * `recordRealCashZero`: tutup otomatis mencatat kas nyata Rp 0 — tidak ada yang menghitung
 * laci, jadi selisihnya (= minus kas yang seharusnya ada) sengaja terlihat di riwayat shift
 * sampai finance memverifikasi setoran. Tutup paksa manual tetap mengosongkan angka itu.
 */
export async function forceCloseShift(
  shiftId: number,
  options: { forceClosedById: number | null; reason: string; recordRealCashZero?: boolean },
) {
  return await db.transaction(async (trx) => {
    const shiftData = await trx.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
    })

    if (!shiftData || shiftData.status !== 'OPEN') {
      throw new ShiftNotOpenError()
    }

    const assignedCashierIds = shiftData.assignedCashiers as number[]
    const allExpenses = await trx.select().from(shiftExpenses).where(eq(shiftExpenses.shiftId, shiftId))
    const allTransactions = await trx.select().from(transactions).where(and(eq(transactions.shiftId, shiftId), eq(transactions.status, 'COMPLETED')))
    const cashiers = assignedCashierIds.length > 0
      ? await trx.select({ id: users.id }).from(users).where(inArray(users.id, assignedCashierIds))
      : []

    let totalSalesCashExpected = 0

    for (const user of cashiers) {
      const cashierTransactions = allTransactions.filter(t => t.cashierId === user.id)
      const trxIds = cashierTransactions.map(t => t.id)

      let totalSalesCash = 0
      let totalSales = 0

      if (trxIds.length > 0) {
        const payments = await trx
          .select({ amount: transactionPayments.amount, type: paymentMethods.type })
          .from(transactionPayments)
          .innerJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
          .where(inArray(transactionPayments.transactionId, trxIds))

        for (const p of payments) {
          const amt = Number(p.amount)
          totalSales += amt
          if (p.type === 'CASH') totalSalesCash += amt
        }
      }

      const totalChange = cashierTransactions.reduce((sum, t) => sum + Number(t.changeAmount), 0)
      const totalExpenses = allExpenses
        .filter(e => e.cashierId === user.id)
        .reduce((sum, e) => sum + Number(e.amount), 0)

      // Tendered tidak pernah dicatat: simpan kas penjualan & total penjualan NET (setelah kembalian).
      totalSalesCash = totalSalesCash - totalChange
      totalSales = totalSales - totalChange

      // Net cash masuk laci = kas penjualan net − pengeluaran tunai. Modal terpisah.
      const expectedCash = totalSalesCash - totalExpenses
      totalSalesCashExpected += expectedCash

      const breakdownData = {
        shiftId,
        cashierId: user.id,
        totalSalesCash: Math.round(totalSalesCash),
        totalSales: Math.round(totalSales),
        totalTransactions: cashierTransactions.length,
        totalExpenses: Math.round(totalExpenses),
        modalShare: 0,
        expectedCash: Math.round(expectedCash),
        realCash: null,
        variance: null,
        isVarianceFlagged: false,
      }

      await trx.insert(shiftCashierBreakdown).values(breakdownData).onConflictDoUpdate({
        target: [shiftCashierBreakdown.shiftId, shiftCashierBreakdown.cashierId],
        set: {
          expectedCash: breakdownData.expectedCash,
          modalShare: 0,
          realCash: null,
          variance: null,
          isVarianceFlagged: false,
        },
      })
    }

    // Kas penjualan yang harus ada di laci (DI LUAR modal). Modal terpisah & dikembalikan utuh.
    const totalClosingCashExpected = Math.round(totalSalesCashExpected)

    const [updated] = await trx
      .update(shifts)
      .set({
        status: 'FORCE_CLOSED',
        forceClosedAt: new Date(),
        forceClosedById: options.forceClosedById,
        settlementNotes: options.reason,
        totalClosingCashExpected,
        ...(options.recordRealCashZero
          ? { totalClosingCashReal: 0, totalVariance: -totalClosingCashExpected }
          : {}),
      })
      .where(and(eq(shifts.id, shiftId), eq(shifts.status, 'OPEN')))
      .returning()

    if (!updated) throw new ShiftNotOpenError()
    return updated
  })
}
