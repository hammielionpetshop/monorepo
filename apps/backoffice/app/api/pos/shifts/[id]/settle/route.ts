import { NextResponse } from 'next/server';
import { db, shifts, shiftCashierBreakdown, shiftCashierSessions, transactions, transactionPayments, paymentMethods, shiftExpenses, users, eq, and, inArray, sql } from '@/lib/db';
import { ShiftBreakdownSummary, ShiftCashierBreakdown as IShiftCashierBreakdown } from '@petshop/shared';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shiftId = parseInt(id);
    const { cashierInputs, settlementNotes, closedById } = await req.json();

    if (!cashierInputs || !Array.isArray(cashierInputs)) {
      return NextResponse.json({ error: 'cashierInputs is required' }, { status: 400 });
    }

    // 1. Fetch Shift
    const shiftData = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
    });

    if (!shiftData || shiftData.status !== 'OPEN') {
      return NextResponse.json({ error: 'Shift not found or already closed' }, { status: 404 });
    }

    const assignedCashierIds = shiftData.assignedCashiers as number[];

    // 2. Stop all active cashier sessions
    await db
      .update(shiftCashierSessions)
      .set({
        stoppedAt: new Date(),
        status: 'STOPPED',
      })
      .where(
        and(
          eq(shiftCashierSessions.shiftId, shiftId),
          eq(shiftCashierSessions.status, 'ACTIVE')
        )
      );

    // 3. Recalculate Breakdown
    const openingCash = Number(shiftData.openingCash);
    const modalShare = Math.floor(openingCash / assignedCashierIds.length);
    const allExpenses = await db.select().from(shiftExpenses).where(eq(shiftExpenses.shiftId, shiftId));
    const allTransactions = await db.select().from(transactions).where(eq(transactions.shiftId, shiftId));
    const cashiers = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, assignedCashierIds));

    const finalBreakdowns: IShiftCashierBreakdown[] = [];
    let totalClosingCashReal = 0;
    let totalClosingCashExpected = 0;
    let totalVariance = 0;

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
        const payments = await db
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

      const totalExpenses = allExpenses
        .filter(e => e.cashierId === user.id)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const expectedCash = modalShare + totalSalesCash - totalExpenses;
      const input = cashierInputs.find(ci => ci.cashierId === user.id);
      const realCash = input ? parseFloat(input.realCash) : 0;
      const variance = realCash - expectedCash;
      const isVarianceFlagged = variance < 0;

      totalClosingCashReal += realCash;
      totalClosingCashExpected += expectedCash;
      totalVariance += variance;

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
        modalShare: Math.round(modalShare),
        expectedCash: Math.round(expectedCash),
        realCash: Math.round(realCash),
        variance: Math.round(variance),
        isVarianceFlagged,
      };

      // Upsert breakdown
      await db.insert(shiftCashierBreakdown).values(breakdownData).onConflictDoUpdate({
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
        modalShare,
        expectedCash,
        realCash,
        variance,
      });
    }

    // 4. Update Shift
    const [updatedShift] = await db
      .update(shifts)
      .set({
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: closedById || shiftData.openedById,
        totalClosingCashReal: Math.round(totalClosingCashReal),
        totalClosingCashExpected: Math.round(totalClosingCashExpected),
        totalVariance: Math.round(totalVariance),
        settlementNotes,
      })
      .where(eq(shifts.id, shiftId))
      .returning();

    const summary: ShiftBreakdownSummary = {
      shift: {
        ...updatedShift,
        openingCash: Number(updatedShift.openingCash),
        totalClosingCashExpected,
        totalClosingCashReal,
        totalVariance,
      } as any,
      breakdowns: finalBreakdowns,
      totalExpectedCash: totalClosingCashExpected,
      totalRealCash: totalClosingCashReal,
      totalVariance: totalVariance,
    };

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('Settle shift API error:', error);
    return NextResponse.json({ error: 'Failed to settle shift' }, { status: 500 });
  }
}
