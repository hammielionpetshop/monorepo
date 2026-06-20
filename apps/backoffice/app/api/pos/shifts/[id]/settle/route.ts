import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { db, shifts, shiftCashierBreakdown, shiftCashierSessions, transactions, transactionPayments, paymentMethods, shiftExpenses, users, eq, and, inArray } from '@/lib/db';
import { ShiftBreakdownSummary, ShiftCashierBreakdown as IShiftCashierBreakdown } from '@petshop/shared';

export async function POST(
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
    const body = await req.json();
    const { realCash, settlementNotes } = body;
    const closedById = body.closedById || payload.userId;

    const realCashNum = Number(realCash);
    if (!Number.isFinite(realCashNum) || realCashNum < 0) {
      return NextResponse.json({ error: 'Jumlah kas fisik tidak valid' }, { status: 400 });
    }

    const summary = await db.transaction(async (trx) => {
      // 1. Fetch Shift
      const shiftData = await trx.query.shifts.findFirst({
        where: eq(shifts.id, shiftId),
      });

      if (!shiftData || shiftData.status !== 'OPEN') {
        throw new Error('SHIFT_NOT_OPEN');
      }

      const assignedCashierIds = shiftData.assignedCashiers as number[];
      const openingCash = Number(shiftData.openingCash);

      // 2. Stop all active cashier sessions
      await trx
        .update(shiftCashierSessions)
        .set({ stoppedAt: new Date(), status: 'STOPPED' })
        .where(
          and(
            eq(shiftCashierSessions.shiftId, shiftId),
            eq(shiftCashierSessions.status, 'ACTIVE')
          )
        );

      // 3. Recalculate breakdown
      const allExpenses = await trx.select().from(shiftExpenses).where(eq(shiftExpenses.shiftId, shiftId));
      const allTransactions = await trx.select().from(transactions).where(and(eq(transactions.shiftId, shiftId), eq(transactions.status, 'COMPLETED')));
      const cashiers = await trx.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, assignedCashierIds));

      const finalBreakdowns: IShiftCashierBreakdown[] = [];
      let totalNetCashContribution = 0;

      for (const user of cashiers) {
        const cashierTransactions = allTransactions.filter(t => t.cashierId === user.id);
        const trxIds = cashierTransactions.map(t => t.id);

        let totalSalesCash = 0;
        let totalSalesQris = 0;
        let totalSalesDebit = 0;
        let totalSalesCredit = 0;
        let totalSalesDebt = 0;
        let totalSales = 0;

        if (trxIds.length > 0) {
          const payments = await trx
            .select({ amount: transactionPayments.amount, type: paymentMethods.type })
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

        // Kembalian keluar dari laci → kurangi dari kas tunai
        const totalChange = cashierTransactions.reduce((sum, t) => sum + Number(t.changeAmount), 0);
        const netCash = totalSalesCash - totalChange;

        const totalExpenses = allExpenses
          .filter(e => e.cashierId === user.id)
          .reduce((sum, e) => sum + Number(e.amount), 0);

        const expectedCash = netCash - totalExpenses;
        totalNetCashContribution += expectedCash;

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
          // Rekonsiliasi kas fisik di level shift (satu laci) — bukan per kasir
          realCash: null,
          variance: null,
          isVarianceFlagged: false,
        };

        await trx.insert(shiftCashierBreakdown).values(breakdownData).onConflictDoUpdate({
          target: [shiftCashierBreakdown.shiftId, shiftCashierBreakdown.cashierId],
          set: breakdownData,
        });

        finalBreakdowns.push({
          ...breakdownData,
          cashierName: user.name,
          totalSalesCash,
          totalSalesQris,
          totalSalesDebit,
          totalSalesCredit,
          totalSalesDebt,
          totalSales,
          totalExpenses,
          modalShare: 0,
          expectedCash,
          realCash: null,
          variance: null,
        });
      }

      // 4. Rekonsiliasi level shift: modal utuh + total kontribusi kas bersih
      const totalExpectedCash = openingCash + totalNetCashContribution;
      const totalVariance = realCashNum - totalExpectedCash;

      const [updatedShift] = await trx
        .update(shifts)
        .set({
          status: 'CLOSED',
          closedAt: new Date(),
          closedById,
          totalClosingCashReal: Math.round(realCashNum),
          totalClosingCashExpected: Math.round(totalExpectedCash),
          totalVariance: Math.round(totalVariance),
          settlementNotes,
        })
        .where(eq(shifts.id, shiftId))
        .returning();

      const result: ShiftBreakdownSummary = {
        shift: {
          ...updatedShift,
          openingCash: Number(updatedShift.openingCash),
          totalClosingCashExpected: totalExpectedCash,
          totalClosingCashReal: realCashNum,
          totalVariance,
        } as any,
        breakdowns: finalBreakdowns,
        totalExpectedCash,
        totalRealCash: realCashNum,
        totalVariance,
      };

      return result;
    });

    return NextResponse.json(summary);
  } catch (error: any) {
    if (error?.message === 'SHIFT_NOT_OPEN') {
      return NextResponse.json({ error: 'Shift tidak ditemukan atau sudah ditutup' }, { status: 404 });
    }
    console.error('Settle shift API error:', error);
    return NextResponse.json({ error: 'Gagal menutup shift' }, { status: 500 });
  }
}
