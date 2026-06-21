import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { db, shifts, shiftCashierBreakdown, transactions, transactionPayments, paymentMethods, shiftExpenses, users, eq, and, inArray } from '@/lib/db';

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
    const { reason } = body;
    const forceClosedById = body.forceClosedById || payload.userId;

    if (!reason) {
      return NextResponse.json({ error: 'Alasan tutup paksa wajib diisi' }, { status: 400 });
    }

    const updatedShift = await db.transaction(async (trx) => {
      // 1. Fetch Shift
      const shiftData = await trx.query.shifts.findFirst({
        where: eq(shifts.id, shiftId),
      });

      if (!shiftData || shiftData.status !== 'OPEN') {
        throw new Error('SHIFT_NOT_OPEN');
      }

      // 2. Calculate breakdown automatically (no real cash)
      const assignedCashierIds = shiftData.assignedCashiers as number[];
      const allExpenses = await trx.select().from(shiftExpenses).where(eq(shiftExpenses.shiftId, shiftId));
      const allTransactions = await trx.select().from(transactions).where(and(eq(transactions.shiftId, shiftId), eq(transactions.status, 'COMPLETED')));
      const cashiers = await trx.select({ id: users.id }).from(users).where(inArray(users.id, assignedCashierIds));

      let totalSalesCashExpected = 0;

      for (const user of cashiers) {
        const cashierTransactions = allTransactions.filter(t => t.cashierId === user.id);
        const trxIds = cashierTransactions.map(t => t.id);

        let totalSalesCash = 0;
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
          }
        }

        const totalChange = cashierTransactions.reduce((sum, t) => sum + Number(t.changeAmount), 0);

        const totalExpenses = allExpenses
          .filter(e => e.cashierId === user.id)
          .reduce((sum, e) => sum + Number(e.amount), 0);

        // Tendered tidak pernah dicatat: simpan kas penjualan & total penjualan NET (setelah kembalian).
        totalSalesCash = totalSalesCash - totalChange;
        totalSales = totalSales - totalChange;

        // Net cash masuk laci = kas penjualan net − pengeluaran tunai. Modal terpisah.
        const expectedCash = totalSalesCash - totalExpenses;
        totalSalesCashExpected += expectedCash;

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
        };

        await trx.insert(shiftCashierBreakdown).values(breakdownData).onConflictDoUpdate({
          target: [shiftCashierBreakdown.shiftId, shiftCashierBreakdown.cashierId],
          set: {
            expectedCash: breakdownData.expectedCash,
            modalShare: 0,
            realCash: null,
            variance: null,
            isVarianceFlagged: false,
          },
        });
      }

      // Kas penjualan yang harus ada di laci (DI LUAR modal). Modal terpisah & dikembalikan utuh.
      const totalClosingCashExpected = totalSalesCashExpected;

      // 3. Update Shift to FORCE_CLOSED
      const [updated] = await trx
        .update(shifts)
        .set({
          status: 'FORCE_CLOSED',
          forceClosedAt: new Date(),
          forceClosedById,
          settlementNotes: reason,
          totalClosingCashExpected: Math.round(totalClosingCashExpected),
        })
        .where(eq(shifts.id, shiftId))
        .returning();

      return updated;
    });

    return NextResponse.json(updatedShift);
  } catch (error: any) {
    if (error?.message === 'SHIFT_NOT_OPEN') {
      return NextResponse.json({ error: 'Shift tidak ditemukan atau sudah ditutup' }, { status: 404 });
    }
    console.error('Force close shift API error:', error);
    return NextResponse.json({ error: 'Gagal menutup paksa shift' }, { status: 500 });
  }
}
