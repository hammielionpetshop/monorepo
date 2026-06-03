import { NextResponse } from 'next/server';
import { TransactionService } from '@/lib/services/transaction-service';
import { z } from 'zod';

const transactionSchema = z.object({
  branchId: z.number().int(),
  shiftId: z.number().int(),
  cashierId: z.number().int(),
  customerId: z.number().int().nullable().optional(),
  items: z.array(z.object({
    productId: z.number().int(),
    productName: z.string().optional(),
    uomId: z.number().int(),
    uomCode: z.string().optional(),
    qty: z.number().int().positive(),
    unitPrice: z.number().int().nonnegative(),
    priceTier: z.string(),
    discountAmount: z.number().int().nonnegative(),
    subtotal: z.number().int().nonnegative(),
    isOwnerOverride: z.boolean().optional(),
  })).min(1),
  payments: z.array(z.object({
    paymentMethodId: z.number().int(),
    amount: z.number().int().nonnegative(),
    referenceNumber: z.string().nullable().optional(),
  })),
  totals: z.object({
    subtotal: z.number().int().nonnegative(),
    discountTotal: z.number().int().nonnegative(),
    grandTotal: z.number().int().nonnegative(),
    itemCount: z.number().int().nonnegative().optional(),
  }),
  amountPaid: z.number().int().nonnegative(),
  change: z.number().int().nonnegative(),
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
