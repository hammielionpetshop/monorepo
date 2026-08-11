import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { db, shifts, shiftCashierBreakdown, shiftCashierSessions, transactions, transactionPayments, paymentMethods, shiftExpenses, expenseCategories, users, voidRequests, eq, and, ne, inArray } from '@/lib/db';
import { getShiftDebtCash } from '@/lib/services/shift-debt-cash';
import { ShiftBreakdownSummary, ShiftCashierBreakdown as IShiftCashierBreakdown, ShiftNonCashPayment, ShiftExpenseDetail } from '@petshop/shared';

/**
 * Settlement ditahan karena masih ada permintaan void/koreksi yang belum diputuskan.
 * Membawa daftar notanya supaya pesan di layar bisa menyebut yang mana — tanpa itu kasir
 * hanya tahu ia ditolak, bukan apa yang harus dikejar.
 */
class PendingApprovalError extends Error {
  constructor(public readonly pending: { trxNumber: string; kind: string }[]) {
    super('PENDING_APPROVAL_EXISTS');
    this.name = 'PendingApprovalError';
  }
}

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

      // Permintaan void/koreksi yang masih menggantung untuk nota DI SHIFT INI.
      //
      // Settlement memotret kas: begitu shift tertutup, angkanya jadi arsip. Persetujuan yang
      // mendarat sesudahnya mengubah nota milik potret itu, dan selisihnya tidak lagi bisa
      // direkonsiliasi ke mana pun. Karena itu shift ditahan sampai tiap permintaan diputuskan.
      //
      // Dibatasi pada nota shift ini, bukan seluruh cabang: permintaan atas nota kemarin tidak
      // ada urusannya dengan kas hari ini, dan menahannya di sini hanya akan mengunci kasir
      // untuk sesuatu yang bukan miliknya.
      //
      // Jalan keluarnya selalu ada: menolak permintaan juga membuka kuncinya, jadi shift tidak
      // bisa terkunci permanen selama ada penyetuju yang bisa memutuskan.
      const pending = await trx
        .select({ trxNumber: transactions.trxNumber, kind: voidRequests.kind })
        .from(voidRequests)
        .innerJoin(transactions, eq(voidRequests.transactionId, transactions.id))
        .where(and(eq(voidRequests.status, 'PENDING'), eq(transactions.shiftId, shiftId)));

      if (pending.length > 0) {
        throw new PendingApprovalError(pending);
      }

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
      const sessions = await trx
        .select({ cashierId: shiftCashierSessions.cashierId })
        .from(shiftCashierSessions)
        .where(eq(shiftCashierSessions.shiftId, shiftId));

      // Gabungkan semua kasir yang terlibat: ditugaskan saat buka shift, gabung di tengah shift,
      // dan siapapun yang punya transaksi/expense. assignedCashiers hanya snapshot saat buka shift.
      const cashierIdSet = new Set<number>([
        ...((shiftData.assignedCashiers as number[] | null) ?? []),
        ...sessions.map((s) => s.cashierId),
        ...allTransactions.map((t) => t.cashierId),
        ...allExpenses.map((e) => e.cashierId),
      ]);
      const cashierIds = Array.from(cashierIdSet).filter((id): id is number => id != null);
      const cashiers = cashierIds.length > 0
        ? await trx.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, cashierIds))
        : [];

      const finalBreakdowns: IShiftCashierBreakdown[] = [];
      let totalSalesCashExpected = 0;

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
          const payments = await trx
            .select({ amount: transactionPayments.amount, type: paymentMethods.type })
            .from(transactionPayments)
            .innerJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
            .where(inArray(transactionPayments.transactionId, trxIds));

          for (const p of payments) {
            const amt = Number(p.amount);
            totalSales += amt;
            if (p.type === 'CASH') totalSalesCash += amt;
            else if (p.type === 'DEBT') totalSalesDebt += amt;
            else if (p.type === 'QRIS') totalSalesQris += amt;
            else if (p.type === 'BANK_TRANSFER') totalSalesDebit += amt;
            // E-WALLET & metode non-tunai lain dijumlahkan sebagai non-tunai
            else totalSalesCredit += amt;
          }
        }

        const totalChange = cashierTransactions.reduce((sum, t) => sum + Number(t.changeAmount), 0);
        totalDiscount = cashierTransactions.reduce((sum, t) => sum + Number(t.discountAmount), 0);

        const totalExpenses = allExpenses
          .filter(e => e.cashierId === user.id)
          .reduce((sum, e) => sum + Number(e.amount), 0);

        // Tendered tidak pernah dicatat: simpan kas penjualan & total penjualan NET (setelah kembalian).
        totalSalesCash = totalSalesCash - totalChange;
        totalSales = totalSales - totalChange;

        // Sembunyikan kasir tanpa aktivitas (mis. gabung shift tapi tidak menjual & tidak ada pengeluaran).
        if (cashierTransactions.length === 0 && totalExpenses === 0) continue;

        // Net cash masuk laci = kas penjualan net − pengeluaran tunai. Modal terpisah.
        const expectedCash = totalSalesCash - totalExpenses;
        totalSalesCashExpected += expectedCash;

        const breakdownData = {
          shiftId,
          cashierId: user.id,
          totalSalesCash: Math.round(totalSalesCash),
          totalSalesQris: Math.round(totalSalesQris),
          totalSalesDebit: Math.round(totalSalesDebit),
          totalSalesCredit: Math.round(totalSalesCredit),
          totalSalesDebt: Math.round(totalSalesDebt),
          totalSales: Math.round(totalSales),
          totalDiscount: Math.round(totalDiscount),
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
          totalDiscount,
          totalExpenses,
          modalShare: 0,
          expectedCash,
          realCash: null,
          variance: null,
        });
      }

      // 4. Rekonsiliasi level shift (DI LUAR modal): kas yang harus ada di laci.
      // Pelunasan piutang tunai ikut dihitung — uangnya nyata masuk laci walau bukan penjualan
      // shift ini. Omzetnya sendiri sudah diakui saat transaksi hutang dibuat, tidak dihitung ulang.
      // Modal terpisah & dikembalikan utuh, tidak masuk variance.
      const debtCash = await getShiftDebtCash(trx, shiftId);
      const totalExpectedCash = totalSalesCashExpected + debtCash.totalCash;
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

      // 5. Daftar transaksi non-tunai (untuk cetak settlement): tgl | nominal | metode
      const nonCashRows = await trx
        .select({
          createdAt: transactions.createdAt,
          amount: transactionPayments.amount,
          paymentMethodName: paymentMethods.name,
        })
        .from(transactionPayments)
        .innerJoin(transactions, eq(transactionPayments.transactionId, transactions.id))
        .innerJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
        .where(and(eq(transactions.shiftId, shiftId), eq(transactions.status, 'COMPLETED'), ne(paymentMethods.type, 'CASH'), ne(paymentMethods.type, 'DEBT')))
        .orderBy(transactions.createdAt);

      const nonCashPayments: ShiftNonCashPayment[] = nonCashRows.map((r) => ({
        createdAt: r.createdAt,
        amount: Number(r.amount),
        paymentMethodName: r.paymentMethodName,
      }));

      // 6. Rincian pengeluaran (untuk cetak settlement): tgl | kategori | nominal | catatan
      const expenseRows = await trx
        .select({
          createdAt: shiftExpenses.createdAt,
          amount: shiftExpenses.amount,
          note: shiftExpenses.note,
          categoryName: expenseCategories.name,
          categoryCustom: shiftExpenses.categoryCustom,
          cashierId: shiftExpenses.cashierId,
        })
        .from(shiftExpenses)
        .leftJoin(expenseCategories, eq(shiftExpenses.categoryId, expenseCategories.id))
        .where(eq(shiftExpenses.shiftId, shiftId))
        .orderBy(shiftExpenses.createdAt);

      const cashierNameMap = new Map(cashiers.map((c) => [c.id, c.name]));
      const expenses: ShiftExpenseDetail[] = expenseRows.map((e) => ({
        createdAt: e.createdAt,
        amount: Number(e.amount),
        note: e.note,
        categoryName: e.categoryName,
        categoryCustom: e.categoryCustom,
        cashierName: cashierNameMap.get(e.cashierId) ?? null,
      }));

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
        totalDebtPaymentCash: debtCash.totalCash,
        totalDiscount: finalBreakdowns.reduce((sum, b) => sum + b.totalDiscount, 0),
        totalRealCash: realCashNum,
        totalVariance,
        nonCashPayments,
        debtPaymentsReceived: debtCash.payments,
        expenses,
      };

      return result;
    });

    return NextResponse.json(summary);
  } catch (error: any) {
    if (error?.message === 'SHIFT_NOT_OPEN') {
      return NextResponse.json({ error: 'Shift tidak ditemukan atau sudah ditutup' }, { status: 404 });
    }
    if (error instanceof PendingApprovalError) {
      const daftar = error.pending
        .map((p) => `${p.trxNumber} (${p.kind === 'KOREKSI' ? 'koreksi' : 'void'})`)
        .join(', ');
      return NextResponse.json(
        {
          error:
            `Masih ada ${error.pending.length} permintaan yang belum diputuskan untuk shift ini: ${daftar}. ` +
            'Minta atasan menyetujui atau menolaknya dulu — kalau shift ditutup sekarang, ' +
            'perubahan yang disetujui belakangan tidak akan tercermin di kas yang sudah direkonsiliasi.',
          pendingApprovals: error.pending,
        },
        { status: 409 },
      );
    }
    console.error('Settle shift API error:', error);
    return NextResponse.json({ error: 'Gagal menutup shift' }, { status: 500 });
  }
}
