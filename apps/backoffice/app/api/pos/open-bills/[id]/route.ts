import { NextResponse } from 'next/server';
import { db, openBills, eq } from '@/lib/db';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: billId } = await params;
    const id = parseInt(billId);
    await db.delete(openBills).where(eq(openBills.id, id));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[OpenBills] DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
