import { NextResponse } from 'next/server';
import { TransactionService } from '@/lib/services/transaction-service';
import { z } from 'zod';

const transactionSchema = z.object({
  branchId: z.number(),
  shiftId: z.number(),
  cashierId: z.number(),
  customerId: z.number().nullable().optional(),
  items: z.array(z.object({
    productId: z.number(),
    productName: z.string().optional(),
    uomId: z.number(),
    uomCode: z.string().optional(),
    qty: z.number().positive(),
    unitPrice: z.number(),
    priceTier: z.string(),
    discountAmount: z.number(),
    subtotal: z.number(),
    isOwnerOverride: z.boolean().optional(),
  })).min(1),
  payments: z.array(z.object({
    paymentMethodId: z.number(),
    amount: z.number().nonnegative(),
    referenceNumber: z.string().nullable().optional(),
  })),
  totals: z.object({
    subtotal: z.number(),
    discountTotal: z.number(),
    grandTotal: z.number(),
    itemCount: z.number().optional(),
  }),
  amountPaid: z.number().nonnegative(),
  change: z.number().nonnegative(),
});

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const result = transactionSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ 
        error: 'Invalid payload', 
        details: result.error.format() 
      }, { status: 400 });
    }

    const transaction = await TransactionService.createTransaction(result.data);

    return NextResponse.json({
      success: true,
      message: 'Transaction completed safely',
      transaction,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create transaction API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create transaction' }, { status: 500 });
  }
}
