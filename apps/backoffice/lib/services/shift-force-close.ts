import { db, shifts, shiftCashierBreakdown, shiftCashierSessions, transactions, transactionPayments, paymentMethods, shiftExpenses, users, eq, and, inArray } from '@/lib/db'

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
 * Daftar kasir disusun dari GABUNGAN: ditugaskan saat buka shift, gabung di tengah shift, dan
 * siapa pun yang punya transaksi/pengeluaran — persis seperti jalur settle normal & live breakdown.
 * `assignedCashiers` hanya snapshot saat buka shift, jadi tidak boleh jadi satu-satunya sumber: shift
 * backoffice (bulk sale / PO Internal) dibuka oleh satu orang tetapi bisa menampung penjualan kasir
 * lain. Memakai assignedCashiers saja membuat transaksi kasir tak-terdaftar lenyap dari breakdown
 * begitu shift ditutup paksa (bug: omzet mereka hilang dari Riwayat Shift walau tetap di transaksi).
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

    const allExpenses = await trx.select().from(shiftExpenses).where(eq(shiftExpenses.shiftId, shiftId))
    const allTransactions = await trx.select().from(transactions).where(and(eq(transactions.shiftId, shiftId), eq(transactions.status, 'COMPLETED')))
    const sessions = await trx
      .select({ cashierId: shiftCashierSessions.cashierId })
      .from(shiftCashierSessions)
      .where(eq(shiftCashierSessions.shiftId, shiftId))

    // Gabungkan semua kasir yang terlibat: ditugaskan saat buka shift, gabung di tengah shift,
    // dan siapa pun yang punya transaksi/pengeluaran. assignedCashiers hanya snapshot saat buka shift.
    const cashierIdSet = new Set<number>([
      ...((shiftData.assignedCashiers as number[] | null) ?? []),
      ...sessions.map((s) => s.cashierId),
      ...allTransactions.map((t) => t.cashierId),
      ...allExpenses.map((e) => e.cashierId),
    ])
    const cashierIds = Array.from(cashierIdSet).filter((id): id is number => id != null)
    const cashiers = cashierIds.length > 0
      ? await trx.select({ id: users.id }).from(users).where(inArray(users.id, cashierIds))
      : []

    let totalSalesCashExpected = 0

    for (const user of cashiers) {
      const cashierTransactions = allTransactions.filter(t => t.cashierId === user.id)
      const trxIds = cashierTransactions.map(t => t.id)

      let totalSalesCash = 0
      let totalSalesQris = 0
      let totalSalesDebit = 0
      let totalSalesCredit = 0
      let totalSalesDebt = 0
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
          else if (p.type === 'DEBT') totalSalesDebt += amt
          else if (p.type === 'QRIS') totalSalesQris += amt
          else if (p.type === 'BANK_TRANSFER') totalSalesDebit += amt
          // E-WALLET & metode non-tunai lain dijumlahkan sebagai non-tunai
          else totalSalesCredit += amt
        }
      }

      const totalChange = cashierTransactions.reduce((sum, t) => sum + Number(t.changeAmount), 0)
      const totalExpenses = allExpenses
        .filter(e => e.cashierId === user.id)
        .reduce((sum, e) => sum + Number(e.amount), 0)

      // Tendered tidak pernah dicatat: simpan kas penjualan & total penjualan NET (setelah kembalian).
      totalSalesCash = totalSalesCash - totalChange
      totalSales = totalSales - totalChange

      // Sembunyikan kasir tanpa aktivitas (mis. gabung shift tapi tidak menjual & tidak ada pengeluaran).
      if (cashierTransactions.length === 0 && totalExpenses === 0) continue

      // Net cash masuk laci = kas penjualan net − pengeluaran tunai. Modal terpisah.
      const expectedCash = totalSalesCash - totalExpenses
      totalSalesCashExpected += expectedCash

      const breakdownData = {
        shiftId,
        cashierId: user.id,
        totalSalesCash: Math.round(totalSalesCash),
        totalSalesQris: Math.round(totalSalesQris),
        totalSalesDebit: Math.round(totalSalesDebit),
        totalSalesCredit: Math.round(totalSalesCredit),
        totalSalesDebt: Math.round(totalSalesDebt),
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
        set: breakdownData,
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
