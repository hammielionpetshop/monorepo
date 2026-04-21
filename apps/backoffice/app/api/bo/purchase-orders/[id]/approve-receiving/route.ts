import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { applyPOReceivingBatches } from '@/lib/po-batch-updater';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const poId = parseInt(params.id);
    const body = await req.json();
    const { approvedById } = body;

    if (!poId || !approvedById) {
      return NextResponse.json({ error: 'Missing required payload' }, { status: 400 });
    }

    await applyPOReceivingBatches(db, poId, approvedById);

    return NextResponse.json({
      success: true,
      message: 'Receiving approved, stock updated, and payables created',
    });
  } catch (error: any) {
    console.error('Approve receiving PO error:', error);
    return NextResponse.json({ error: error.message || 'Failed to approve receiving' }, { status: 500 });
  }
}
