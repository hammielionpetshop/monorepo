import { NextResponse } from 'next/server';
import { db, shifts, transactions, transactionPayments, paymentMethods, shiftExpenses, users, eq, and, inArray, sql } from '@/lib/db';
import { ShiftBreakdownSummary, ShiftCashierBreakdown } from '@petshop/shared';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shiftId = parseInt(id);

    // 1. Fetch Shift
    const shiftData = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
    });

    if (!shiftData) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    const assignedCashierIds = shiftData.assignedCashiers as number[];
    const openingCash = parseFloat(shiftData.openingCash);
    const modalShare = Math.floor(openingCash / assignedCashierIds.length);

    // 2. Fetch User names
    const cashiers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, assignedCashierIds));

    // 3. Fetch all expenses for this shift
    const allExpenses = await db.select().from(shiftExpenses).where(eq(shiftExpenses.shiftId, shiftId));

    // 4. Fetch all transactions for this shift
    const allTransactions = await db.select().from(transactions).where(eq(transactions.shiftId, shiftId));

    // 5. Build breakdowns
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
          const amt = parseFloat(p.amount);
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
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

      const expectedCash = modalShare + totalSalesCash - totalExpenses;

      breakdowns.push({
        cashierId: user.id,
        cashierName: user.name,
        totalSalesCash,
        totalSalesQris,
        totalSalesDebit,
        totalSalesCredit,
        totalSalesDebt,
        totalSales,
        totalTransactions: cashierTransactions.length,
        totalExpenses,
        modalShare,
        expectedCash,
        isVarianceFlagged: false, // preview only
      });
    }

    const totalExpectedCash = breakdowns.reduce((sum, b) => sum + b.expectedCash, 0);

    const summary: ShiftBreakdownSummary = {
      shift: {
        ...shiftData,
        openingCash: parseFloat(shiftData.openingCash),
        totalClosingCashExpected: parseFloat(shiftData.totalClosingCashExpected || '0'),
        totalClosingCashReal: parseFloat(shiftData.totalClosingCashReal || '0'),
        totalVariance: parseFloat(shiftData.totalVariance || '0'),
      } as any,
      breakdowns,
      totalExpectedCash,
    };

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('Shift breakdown API error:', error);
    return NextResponse.json({ error: 'Failed to calculate breakdown' }, { status: 500 });
  }
}
