import { NextResponse } from 'next/server';
import { db, shiftCashierSessions, eq, and } from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shiftId = parseInt(id);
    const { cashierId } = await req.json();

    if (!cashierId) {
      return NextResponse.json({ error: 'cashierId is required' }, { status: 400 });
    }

    // Find ACTIVE session
    const [activeSession] = await db
      .select()
      .from(shiftCashierSessions)
      .where(
        and(
          eq(shiftCashierSessions.shiftId, shiftId),
          eq(shiftCashierSessions.cashierId, cashierId),
          eq(shiftCashierSessions.status, 'ACTIVE')
        )
      )
      .limit(1);

    if (!activeSession) {
      return NextResponse.json({ error: 'No active session found for this cashier' }, { status: 404 });
    }

    // Update session
    await db
      .update(shiftCashierSessions)
      .set({
        stoppedAt: new Date(),
        status: 'STOPPED',
      })
      .where(eq(shiftCashierSessions.id, activeSession.id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Stop session API error:', error);
    return NextResponse.json({ error: 'Failed to stop session' }, { status: 500 });
  }
}
