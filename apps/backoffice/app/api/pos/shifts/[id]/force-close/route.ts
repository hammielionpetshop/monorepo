import { NextResponse } from 'next/server';
import { db, shifts, shiftCashierBreakdown, transactions, transactionPayments, paymentMethods, shiftExpenses, users, eq, and, inArray, sql } from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shiftId = parseInt(id);
    const { reason, forceClosedById } = await req.json();

    if (!reason || !forceClosedById) {
      return NextResponse.json({ error: 'Reason and forceClosedById are required' }, { status: 400 });
    }

    // 1. Fetch Shift
    const shiftData = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
    });

    if (!shiftData || shiftData.status !== 'OPEN') {
      return NextResponse.json({ error: 'Shift not found or already closed' }, { status: 404 });
    }

    // 2. Calculate Breakdown automatically (no real cash)
    const assignedCashierIds = shiftData.assignedCashiers as number[];
    const openingCash = parseFloat(shiftData.openingCash);
    const modalShare = Math.floor(openingCash / assignedCashierIds.length);
    const allExpenses = await db.select().from(shiftExpenses).where(eq(shiftExpenses.shiftId, shiftId));
    const allTransactions = await db.select().from(transactions).where(eq(transactions.shiftId, shiftId));
    const cashiers = await db.select({ id: users.id }).from(users).where(inArray(users.id, assignedCashierIds));

    let totalClosingCashExpected = 0;

    for (const user of cashiers) {
      const cashierTransactions = allTransactions.filter(t => t.cashierId === user.id);
      const trxIds = cashierTransactions.map(t => t.id);
      
      let totalSalesCash = 0;
      let totalSales = 0;

      if (trxIds.length > 0) {
        const payments = await db
          .select({ amount: transactionPayments.amount, type: paymentMethods.type })
          .from(transactionPayments)
          .innerJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
          .where(inArray(transactionPayments.transactionId, trxIds));

        for (const p of payments) {
          const amt = parseFloat(p.amount);
          totalSales += amt;
          if (p.type === 'CASH') totalSalesCash += amt;
        }
      }

      const totalExpenses = allExpenses
        .filter(e => e.cashierId === user.id)
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

      const expectedCash = modalShare + totalSalesCash - totalExpenses;
      totalClosingCashExpected += expectedCash;

      await db.insert(shiftCashierBreakdown).values({
        shiftId,
        cashierId: user.id,
        totalSalesCash: totalSalesCash.toString(),
        totalSales: totalSales.toString(),
        totalTransactions: cashierTransactions.length,
        totalExpenses: totalExpenses.toString(),
        modalShare: modalShare.toString(),
        expectedCash: expectedCash.toString(),
        realCash: null,
        variance: null,
        isVarianceFlagged: false,
      }).onConflictDoUpdate({
        target: [shiftCashierBreakdown.shiftId, shiftCashierBreakdown.cashierId],
        set: {
            expectedCash: expectedCash.toString(),
            realCash: null,
            variance: null,
            isVarianceFlagged: false,
        }
      });
    }

    // 3. Update Shift to FORCE_CLOSED
    const [updatedShift] = await db
      .update(shifts)
      .set({
        status: 'FORCE_CLOSED',
        forceClosedAt: new Date(),
        forceClosedById: forceClosedById,
        settlementNotes: reason,
        totalClosingCashExpected: totalClosingCashExpected.toString(),
      })
      .where(eq(shifts.id, shiftId))
      .returning();

    return NextResponse.json(updatedShift);
  } catch (error: any) {
    console.error('Force close shift API error:', error);
    return NextResponse.json({ error: 'Failed to force close shift' }, { status: 500 });
  }
}
