import { NextResponse } from 'next/server';
import { db, supplierPayables, supplierPayablePayments, eq, sql } from '@/lib/db';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const payableId = parseInt(params.id);
    const body = await req.json();
    const { amount, method, referenceNumber, note, paidById } = body;

    if (!payableId || !amount || !method || !paidById) {
      return NextResponse.json({ error: 'Missing required payload' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Fetch payable
      const payable = await tx.query.supplierPayables.findFirst({
        where: eq(supplierPayables.id, payableId),
      });

      if (!payable) throw new Error('Payable not found');

      // 2. Insert payment record
      const [payment] = await tx.insert(supplierPayablePayments).values({
        payableId,
        amount: amount.toString(),
        method,
        referenceNumber,
        note,
        paidById,
        paidAt: new Date(),
      }).returning();

      // 3. Update payable paidAmount and status
      const newPaidAmount = Number(payable.paidAmount) + Number(amount);
      const newStatus = newPaidAmount >= Number(payable.totalAmount) ? 'PAID' : 'PARTIAL';

      await tx.update(supplierPayables)
        .set({
          paidAmount: newPaidAmount.toString(),
          status: newStatus,
        })
        .where(eq(supplierPayables.id, payableId));

      return payment;
    });

    return NextResponse.json({
      success: true,
      message: 'Payment recorded',
      payment: result,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Record payment error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record payment' }, { status: 500 });
  }
}
