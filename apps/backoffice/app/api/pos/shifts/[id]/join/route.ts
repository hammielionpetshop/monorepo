import { NextResponse } from 'next/server';
import { db, shifts, shiftCashierSessions, eq, and } from '@/lib/db';

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

    const shift = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
    });

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    if (shift.status !== 'OPEN') {
      return NextResponse.json({ error: 'Shift is not open' }, { status: 400 });
    }

    // Check if already has an ACTIVE session — prevent duplicate rows
    const existingSession = await db.query.shiftCashierSessions.findFirst({
      where: and(
        eq(shiftCashierSessions.shiftId, shiftId),
        eq(shiftCashierSessions.cashierId, cashierId),
        eq(shiftCashierSessions.status, 'ACTIVE')
      ),
    });

    if (!existingSession) {
      await db.insert(shiftCashierSessions).values({
        shiftId,
        cashierId,
        status: 'ACTIVE',
      });
    }

    return NextResponse.json({ success: true, shift, alreadyJoined: !!existingSession });
  } catch (error: any) {
    console.error('Join shift API error:', error);
    return NextResponse.json({ error: 'Failed to join shift' }, { status: 500 });
  }
}
