import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { db, shifts, shiftCashierSessions, transactions, transactionPayments, paymentMethods, shiftExpenses, users, eq, and, inArray } from '@/lib/db';
import { ShiftBreakdownSummary, ShiftCashierBreakdown } from '@petshop/shared';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const payload = token ? await verifyAccessToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
    }

    const { id } = await params;
    const shiftId = parseInt(id);

    // 1. Fetch Shift
    const shiftData = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
    });

    if (!shiftData) {
      return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
    }

    // 2. Fetch all expenses for this shift
    const allExpenses = await db.select().from(shiftExpenses).where(eq(shiftExpenses.shiftId, shiftId));

    // 3. Fetch all transactions for this shift (only COMPLETED ones)
    const allTransactions = await db.select().from(transactions).where(and(eq(transactions.shiftId, shiftId), eq(transactions.status, 'COMPLETED')));

    // 4. Fetch all cashier sessions (termasuk kasir yang menyusul / gabung di tengah shift)
    const sessions = await db
      .select({ cashierId: shiftCashierSessions.cashierId })
      .from(shiftCashierSessions)
      .where(eq(shiftCashierSessions.shiftId, shiftId));

    // Gabungkan semua kasir yang terlibat: yang ditugaskan saat buka shift,
    // yang gabung di tengah shift, dan siapapun yang punya transaksi/expense.
    // assignedCashiers hanyalah snapshot saat buka shift — tidak boleh jadi satu-satunya sumber.
    const cashierIdSet = new Set<number>([
      ...((shiftData.assignedCashiers as number[] | null) ?? []),
      ...sessions.map((s) => s.cashierId),
      ...allTransactions.map((t) => t.cashierId),
      ...allExpenses.map((e) => e.cashierId),
    ]);
    const cashierIds = Array.from(cashierIdSet).filter((id): id is number => id != null);

    // Fetch User names
    const cashiers = cashierIds.length > 0
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, cashierIds))
      : [];

    // 5. Build breakdowns (rincian penjualan per kasir — informatif)
    const breakdowns: ShiftCashierBreakdown[] = [];

    for (const user of cashiers) {
      const cashierTransactions = allTransactions.filter(t => t.cashierId === user.id);

      const trxIds = cashierTransactions.map(t => t.id);

      let totalSalesCash = 0;
      let totalSalesQris = 0;
      let totalSalesDebit = 0;
      let totalSalesCredit = 0;
      let totalSalesDebt = 0;
      let totalSales = 0;
      let totalDiscount = 0;

      if (trxIds.length > 0) {
        // Query payments for these transactions
        const payments = await db
          .select({
            amount: transactionPayments.amount,
            type: paymentMethods.type,
          })
          .from(transactionPayments)
          .innerJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
          .where(inArray(transactionPayments.transactionId, trxIds));

        for (const p of payments) {
          const amt = Number(p.amount);
          totalSales += amt;
          if (p.type === 'CASH') totalSalesCash += amt;
          else if (p.type === 'QRIS') totalSalesQris += amt;
          else if (p.type === 'DEBIT') totalSalesDebit += amt;
          else if (p.type === 'CREDIT') totalSalesCredit += amt;
          else if (p.type === 'DEBT') totalSalesDebt += amt;
        }
      }

      const totalChange = cashierTransactions.reduce((sum, t) => sum + Number(t.changeAmount), 0);
      totalDiscount = cashierTransactions.reduce((sum, t) => sum + Number(t.discountAmount), 0);

      const totalExpenses = allExpenses
        .filter(e => e.cashierId === user.id)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      // Tendered tidak pernah dicatat: pakai kas penjualan & total penjualan NET (setelah kembalian).
      totalSalesCash = totalSalesCash - totalChange;
      totalSales = totalSales - totalChange;

      // Net cash masuk laci = kas penjualan net − pengeluaran tunai. Modal terpisah (tidak dihitung di sini).
      const expectedCash = totalSalesCash - totalExpenses;

      // Sembunyikan kasir tanpa aktivitas (mis. gabung shift tapi tidak menjual & tidak ada pengeluaran).
      if (cashierTransactions.length === 0 && totalExpenses === 0) continue;

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
        expectedCash,
        isVarianceFlagged: false, // preview only
      });
    }

    // Kas penjualan yang harus ada di laci (DI LUAR modal) = total kas penjualan semua kasir.
    // Modal terpisah dan dikembalikan utuh, tidak masuk rekonsiliasi kas penjualan.
    const totalExpectedCash = breakdowns.reduce((sum, b) => sum + b.expectedCash, 0);
    const totalDiscount = breakdowns.reduce((sum, b) => sum + b.totalDiscount, 0);

    const summary: ShiftBreakdownSummary = {
      shift: {
        ...shiftData,
        openingCash: Number(shiftData.openingCash),
        totalClosingCashExpected: Number(shiftData.totalClosingCashExpected || 0),
        totalClosingCashReal: Number(shiftData.totalClosingCashReal || 0),
        totalVariance: Number(shiftData.totalVariance || 0),
      } as any,
      breakdowns,
      totalExpectedCash,
      totalDiscount,
    };

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('Shift breakdown API error:', error);
    return NextResponse.json({ error: 'Gagal menghitung breakdown' }, { status: 500 });
  }
}
