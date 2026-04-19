import { NextRequest, NextResponse } from 'next/server';
import { db, notifications, stockOpnames } from '@/lib/db';

export const dynamic = 'force-dynamic';

function generateSONumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SO-${dateStr}-${random}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { branchId, shiftId, cashierId, reason } = body;

    if (!branchId || !cashierId || !reason) {
      return NextResponse.json({ error: 'Missing required payload: branchId, cashierId, and reason are required.' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Create Skipped SO Header
      const [header] = await tx.insert(stockOpnames).values({
        soNumber: generateSONumber(),
        branchId: Number(branchId),
        shiftId: shiftId ? Number(shiftId) : null,
        type: 'DAILY',
        status: 'APPROVED', // Skipped SO doesn't need approval, or can be auto-approved
        isSkipped: true,
        skipReason: reason,
        createdById: Number(cashierId),
      }).returning();

      // 2. Insert Notification for Backoffice
      await tx.insert(notifications).values({
        type: 'SO_SKIPPED',
        branchId: Number(branchId),
        title: 'Stock Opname Harian Dilewati',
        message: `Kasir melewatkan Stock Opname harian. Alasan: ${reason}`,
        metadata: {
            soId: header.id,
            shiftId: shiftId,
            cashierId: cashierId
        }
      });

      return header;
    });

    return NextResponse.json({
      success: true,
      so: result
    }, { status: 201 });

  } catch (error: any) {
    console.error('Skip Stock Opname API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to skip stock opname' }, { status: 500 });
  }
}
