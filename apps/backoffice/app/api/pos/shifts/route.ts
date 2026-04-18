import { NextResponse } from 'next/server';
import { db, shifts, shiftCashierSessions, eq, and, sql, desc, count } from '@/lib/db';
import { Shift } from '@petshop/shared';

export const dynamic = 'force-dynamic';

// GET: active shift for a branch
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = parseInt(searchParams.get('branchId') || '');

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    }

    const activeShift = await db.query.shifts.findFirst({
      where: and(
        eq(shifts.branchId, branchId),
        eq(shifts.status, 'OPEN')
      ),
    });

    if (activeShift) {
      const sessions = await db
        .select({ cashierId: shiftCashierSessions.cashierId })
        .from(shiftCashierSessions)
        .where(
          and(
            eq(shiftCashierSessions.shiftId, activeShift.id),
            eq(shiftCashierSessions.status, 'ACTIVE')
          )
        );
      
      return NextResponse.json({
        ...activeShift,
        joinedCashierIds: sessions.map(s => s.cashierId)
      });
    }

    return NextResponse.json(null);
  } catch (error: any) {
    console.error('Active shift API error:', error);
    return NextResponse.json({ error: 'Failed to fetch active shift' }, { status: 500 });
  }
}

// POST: open new shift
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { branchId, openingCash, assignedCashiers, targetEndTime } = body;

    if (!branchId || !openingCash || !assignedCashiers) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check for existing OPEN shift
    const existingOpen = await db.query.shifts.findFirst({
      where: and(
        eq(shifts.branchId, branchId),
        eq(shifts.status, 'OPEN')
      ),
    });

    if (existingOpen) {
      return NextResponse.json({ error: 'A shift is already open for this branch' }, { status: 400 });
    }

    // Check Role - assuming user info is in header or session (needs implementation, but for now allow)
    // In a real app, we'd get this from the JWT session.
    // For this context, we proceed with insertion.

    // Calculate shiftNumber: COUNT(shifts for branch today) + 1
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const countResult = await db
      .select({ count: count() })
      .from(shifts)
      .where(
        and(
          eq(shifts.branchId, branchId),
          sql`DATE(opened_at) = CURRENT_DATE`
        )
      );
    
    const shiftNumber = (Number(countResult[0]?.count) || 0) + 1;

    // Get current user ID (manager/owner opening the shift)
    // For now, assume it's provided in body or headers. Using assignedCashiers[0] as a placeholder if not found.
    // Ideally we have auth.
    const openedById = body.openedById || assignedCashiers[0];

    let targetDate = null;
    if (targetEndTime && targetEndTime.includes(':')) {
      const [hours, minutes] = targetEndTime.split(':').map(Number);
      targetDate = new Date();
      targetDate.setHours(hours, minutes, 0, 0);
    }

    const [newShift] = await db.insert(shifts).values({
      branchId,
      openedById,
      shiftNumber,
      assignedCashiers,
      openingCash: openingCash.toString(),
      targetEndTime: targetDate,
      status: 'OPEN',
    }).returning();

    return NextResponse.json(newShift);
  } catch (error: any) {
    console.error('Open shift API error:', error);
    return NextResponse.json({ error: 'Failed to open new shift' }, { status: 500 });
  }
}
