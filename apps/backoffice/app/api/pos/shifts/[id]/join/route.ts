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

    const assignedCashiers = shift.assignedCashiers as number[];
    if (!assignedCashiers.includes(cashierId)) {
      return NextResponse.json({ error: 'Cashier is not assigned to this shift' }, { status: 403 });
    }

    // Insert into sessions
    const [session] = await db.insert(shiftCashierSessions).values({
      shiftId,
      cashierId,
      status: 'ACTIVE',
    }).onConflictDoNothing().returning();

    // Note: If conflict (already joined), we still return success or the session
    
    return NextResponse.json({ success: true, shift });
  } catch (error: any) {
    console.error('Join shift API error:', error);
    return NextResponse.json({ error: 'Failed to join shift' }, { status: 500 });
  }
}
