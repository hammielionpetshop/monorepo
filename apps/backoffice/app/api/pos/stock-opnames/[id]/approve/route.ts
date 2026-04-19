import { NextRequest, NextResponse } from 'next/server';
import { db, stockOpnames, stockOpnameItems, eq } from '@/lib/db';
import { applySOStockAdjustment } from '@/lib/stock-adjustment';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const soId = Number(params.id);
    const body = await req.json();
    const { approvedById } = body;

    if (!approvedById) {
      return NextResponse.json({ error: 'approvedById is required' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Get SO Header
      const [so] = await tx.select().from(stockOpnames).where(eq(stockOpnames.id, soId)).limit(1);
      if (!so) throw new Error('Stock Opname not found');
      if (so.status !== 'PENDING') throw new Error('Stock Opname is already processed');

      // 2. Get SO Items
      const items = await tx.select().from(stockOpnameItems).where(eq(stockOpnameItems.soId, soId));

      // 3. Apply adjustments for each item
      for (const item of items) {
        // Hanya panggil adjustment jika ada selisih
        if (parseFloat(item.varianceQty) !== 0) {
          await applySOStockAdjustment(tx, {
            productId: item.productId,
            branchId: so.branchId,
            uomId: item.uomId,
            systemQty: item.systemQty,
            physicalQty: item.physicalQty,
            currentUserId: Number(approvedById)
          });
        }
      }

      // 4. Update Header status
      const [updatedSo] = await tx.update(stockOpnames)
        .set({
          status: 'APPROVED',
          approvedById: Number(approvedById),
          approvedAt: new Date(),
          completedAt: new Date(),
        })
        .where(eq(stockOpnames.id, soId))
        .returning();

      return updatedSo;
    });

    return NextResponse.json({
      success: true,
      so: result
    });

  } catch (error: any) {
    console.error('Approve Stock Opname API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to approve stock opname' }, { status: 500 });
  }
}
