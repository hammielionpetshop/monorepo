import { NextResponse } from 'next/server';
import { TransactionService } from '@/lib/services/transaction-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Ideally, validate body schema here (Zod)
    if (!body.branchId || !body.shiftId || !body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Missing required payload' }, { status: 400 });
    }

    const transaction = await TransactionService.createTransaction(body);

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
