import { NextRequest, NextResponse } from 'next/server';
import { db, stockOpnames } from '@/lib/db';

export const dynamic = 'force-dynamic';

function generateSONumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SO-FULL-${dateStr}-${random}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { branchId, createdById, categoryScope, assignedUserIds, notes } = body;

    if (!branchId || !createdById) {
      return NextResponse.json({ error: 'branchId and createdById are required' }, { status: 400 });
    }

    const [header] = await db.insert(stockOpnames).values({
      soNumber: generateSONumber(),
      branchId: Number(branchId),
      type: 'FULL',
      status: 'PENDING',
      createdById: Number(createdById),
      categoryScope: categoryScope || null,
      assignedUserIds: assignedUserIds || null,
      notes: notes || null,
    }).returning();

    return NextResponse.json({
      success: true,
      so: header
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create FULL SO API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create FULL stock opname' }, { status: 500 });
  }
}
