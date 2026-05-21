import { NextResponse } from 'next/server';
import { db, damagedGoods, damagedGoodsItems, eq, sql } from '@/lib/db';
import { StockService } from '@/lib/services/stock-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { branchId, shiftId, reportedById, reason, notes, items } = body;

    if (!branchId || !reportedById || !reason || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required payload' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      let totalLossValue = 0;
      const itemsToInsert = [];

      // 1. Process each item for FIFO deduction and value calculation
      for (const item of items) {
        // Deduct stock and get cost details
        const deductionResult = await StockService.deductStock(
          tx,
          branchId,
          item.productId,
          item.uomId,
          parseFloat(item.qty)
        );

        const itemLossValue = deductionResult.deductions.reduce(
          (acc: number, d: any) => acc + (d.qtyDeducted * d.costPrice), 
          0
        );

        totalLossValue += itemLossValue;

        itemsToInsert.push({
          productId: item.productId,
          uomId: item.uomId,
          qty: Number(item.qty),
          costPrice: Math.round(itemLossValue / parseFloat(item.qty)), // Weighted average cost per unit
          lossValue: Math.round(itemLossValue),
        });
      }

      // 2. Insert Damaged Goods header
      const [header] = await tx.insert(damagedGoods).values({
        branchId,
        shiftId,
        reportedById,
        reason,
        notes,
        totalLossValue: Math.round(totalLossValue),
        reportedAt: new Date(),
      }).returning();

      // 3. Insert Items
      const finalItems = itemsToInsert.map(item => ({
        ...item,
        damagedGoodsId: header.id,
      }));

      await tx.insert(damagedGoodsItems).values(finalItems);

      return { header, items: finalItems };
    });

    return NextResponse.json({
      success: true,
      message: 'Damaged goods recorded correctly',
      data: result,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Damaged goods error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record damaged goods' }, { status: 500 });
  }
}
