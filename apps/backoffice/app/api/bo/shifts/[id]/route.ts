import { NextResponse } from 'next/server'
import {
  db, shifts, branches, users, shiftCashierBreakdown, shiftExpenses,
  shiftCashierSessions, expenseCategories, transactions, transactionPayments,
  paymentMethods, eq, and, ne, inArray,
} from '@/lib/db'
import { requirePermission } from '@/lib/authz'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('shift.read')
    if (gate instanceof NextResponse) return gate

    const { id } = await params
    const shiftId = parseInt(id)
    if (isNaN(shiftId)) {
      return NextResponse.json({ error: 'ID shift tidak valid' }, { status: 400 })
    }

    const shiftData = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
    })
    if (!shiftData) {
      return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 })
    }

    // Branch & user names via separate queries to avoid alias complexity
    const [branchRow] = await db
      .select({ name: branches.name })
      .from(branches)
      .where(eq(branches.id, shiftData.branchId))

    const userIds = Array.from(
      new Set([
        shiftData.openedById,
        shiftData.closedById,
        shiftData.forceClosedById,
      ].filter(Boolean) as number[])
    )
    const userRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, userIds))
    const userMap = Object.fromEntries(userRows.map((u) => [u.id, u.name]))

    // Cashier breakdowns (only for settled shifts)
    let breakdowns: object[] = []
    if (shiftData.status !== 'OPEN') {
      const settled = await db
        .select({
          cashierId: shiftCashierBreakdown.cashierId,
          totalSalesCash: shiftCashierBreakdown.totalSalesCash,
          totalSalesQris: shiftCashierBreakdown.totalSalesQris,
          totalSalesDebit: shiftCashierBreakdown.totalSalesDebit,
          totalSalesCredit: shiftCashierBreakdown.totalSalesCredit,
          totalSalesDebt: shiftCashierBreakdown.totalSalesDebt,
          totalSales: shiftCashierBreakdown.totalSales,
          totalTransactions: shiftCashierBreakdown.totalTransactions,
          totalExpenses: shiftCashierBreakdown.totalExpenses,
          modalShare: shiftCashierBreakdown.modalShare,
          expectedCash: shiftCashierBreakdown.expectedCash,
          realCash: shiftCashierBreakdown.realCash,
          variance: shiftCashierBreakdown.variance,
          isVarianceFlagged: shiftCashierBreakdown.isVarianceFlagged,
        })
        .from(shiftCashierBreakdown)
        .where(eq(shiftCashierBreakdown.shiftId, shiftId))

      const cashierIds = settled.map((b) => b.cashierId)
      const cashierRows = cashierIds.length > 0
        ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, cashierIds))
        : []
      const cashierMap = Object.fromEntries(cashierRows.map((u) => [u.id, u.name]))

      // Compute totalDiscount per cashier from completed transactions (not stored in breakdown table)
      const completedTrx = await db.select().from(transactions).where(and(eq(transactions.shiftId, shiftId), eq(transactions.status, 'COMPLETED')))
      const discountByCashier: Record<number, number> = {}
      for (const t of completedTrx) {
        discountByCashier[t.cashierId] = (discountByCashier[t.cashierId] ?? 0) + Number(t.discountAmount)
      }

      breakdowns = settled.map((b) => ({
        cashierId: b.cashierId,
        cashierName: cashierMap[b.cashierId] ?? null,
        totalSalesCash: Number(b.totalSalesCash),
        totalSalesQris: Number(b.totalSalesQris),
        totalSalesDebit: Number(b.totalSalesDebit),
        totalSalesCredit: Number(b.totalSalesCredit),
        totalSalesDebt: Number(b.totalSalesDebt),
        totalSales: Number(b.totalSales),
        totalDiscount: discountByCashier[b.cashierId] ?? 0,
        totalTransactions: Number(b.totalTransactions),
        totalExpenses: Number(b.totalExpenses),
        modalShare: b.modalShare != null ? Number(b.modalShare) : null,
        expectedCash: b.expectedCash != null ? Number(b.expectedCash) : null,
        realCash: b.realCash != null ? Number(b.realCash) : null,
        variance: b.variance != null ? Number(b.variance) : null,
        isVarianceFlagged: b.isVarianceFlagged,
      }))
    }

    // Expenses
    const expenseRows = await db
      .select({
        id: shiftExpenses.id,
        cashierId: shiftExpenses.cashierId,
        categoryId: shiftExpenses.categoryId,
        categoryName: expenseCategories.name,
        categoryCustom: shiftExpenses.categoryCustom,
        amount: shiftExpenses.amount,
        note: shiftExpenses.note,
        proofImage: shiftExpenses.proofImage,
        createdAt: shiftExpenses.createdAt,
      })
      .from(shiftExpenses)
      .leftJoin(expenseCategories, eq(shiftExpenses.categoryId, expenseCategories.id))
      .where(eq(shiftExpenses.shiftId, shiftId))

    const expenseCashierIds = [...new Set(expenseRows.map((e) => e.cashierId))]
    const expenseCashierRows = expenseCashierIds.length > 0
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, expenseCashierIds))
      : []
    const expenseCashierMap = Object.fromEntries(expenseCashierRows.map((u) => [u.id, u.name]))

    const expenses = expenseRows.map((e) => ({
      ...e,
      cashierName: expenseCashierMap[e.cashierId] ?? null,
      amount: Number(e.amount),
    }))

    // Sessions
    const sessionRows = await db
      .select({
        id: shiftCashierSessions.id,
        cashierId: shiftCashierSessions.cashierId,
        joinedAt: shiftCashierSessions.joinedAt,
        stoppedAt: shiftCashierSessions.stoppedAt,
        status: shiftCashierSessions.status,
      })
      .from(shiftCashierSessions)
      .where(eq(shiftCashierSessions.shiftId, shiftId))

    const sessionCashierIds = [...new Set(sessionRows.map((s) => s.cashierId))]
    const sessionCashierRows = sessionCashierIds.length > 0
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, sessionCashierIds))
      : []
    const sessionCashierMap = Object.fromEntries(sessionCashierRows.map((u) => [u.id, u.name]))

    const sessions = sessionRows.map((s) => ({
      ...s,
      cashierName: sessionCashierMap[s.cashierId] ?? null,
    }))

    // Daftar transaksi non-tunai (untuk cetak settlement): tgl | nominal | metode
    const nonCashRows = shiftData.status !== 'OPEN'
      ? await db
          .select({
            createdAt: transactions.createdAt,
            amount: transactionPayments.amount,
            paymentMethodName: paymentMethods.name,
          })
          .from(transactionPayments)
          .innerJoin(transactions, eq(transactionPayments.transactionId, transactions.id))
          .innerJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
          .where(and(eq(transactions.shiftId, shiftId), eq(transactions.status, 'COMPLETED'), ne(paymentMethods.type, 'CASH'), ne(paymentMethods.type, 'DEBT')))
          .orderBy(transactions.createdAt)
      : []

    const nonCashPayments = nonCashRows.map((r) => ({
      createdAt: r.createdAt,
      amount: Number(r.amount),
      paymentMethodName: r.paymentMethodName,
    }))

    return NextResponse.json({
      shift: {
        ...shiftData,
        openingCash: Number(shiftData.openingCash),
        totalClosingCashReal: shiftData.totalClosingCashReal != null ? Number(shiftData.totalClosingCashReal) : null,
        totalClosingCashExpected: shiftData.totalClosingCashExpected != null ? Number(shiftData.totalClosingCashExpected) : null,
        totalVariance: shiftData.totalVariance != null ? Number(shiftData.totalVariance) : null,
        cashierCount: Array.isArray(shiftData.assignedCashiers) ? (shiftData.assignedCashiers as number[]).length : 0,
        branchName: branchRow?.name ?? null,
        openedByName: userMap[shiftData.openedById] ?? null,
        closedByName: shiftData.closedById ? (userMap[shiftData.closedById] ?? null) : null,
        forceClosedByName: shiftData.forceClosedById ? (userMap[shiftData.forceClosedById] ?? null) : null,
      },
      breakdowns,
      expenses,
      sessions,
      nonCashPayments,
    })
  } catch (error: unknown) {
    console.error('[bo/shifts/[id]] GET error:', error)
    return NextResponse.json({ error: 'Gagal mengambil detail shift' }, { status: 500 })
  }
}
