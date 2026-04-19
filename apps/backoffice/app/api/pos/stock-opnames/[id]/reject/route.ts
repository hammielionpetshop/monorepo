import { NextRequest, NextResponse } from 'next/server';
import { db, stockOpnames, eq, and } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const soId = Number(params.id);
    const body = await req.json();
    const { rejectedById, reason } = body;

    if (!rejectedById || !reason) {
      return NextResponse.json({ error: 'rejectedById and reason are required' }, { status: 400 });
    }

    const [updatedSo] = await db.update(stockOpnames)
      .set({
        status: 'REJECTED',
        rejectedById: Number(rejectedById),
        rejectedAt: new Date(),
        rejectionNote: reason,
        completedAt: new Date(),
      })
      .where(and(
        eq(stockOpnames.id, soId),
        eq(stockOpnames.status, 'PENDING')
      ))
      .returning();

    if (!updatedSo) {
      return NextResponse.json({ error: 'Stock Opname not found or already processed' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      so: updatedSo
    });

  } catch (error: any) {
    console.error('Reject Stock Opname API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to reject stock opname' }, { status: 500 });
  }
}
