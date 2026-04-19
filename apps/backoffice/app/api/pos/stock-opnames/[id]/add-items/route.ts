import { NextRequest, NextResponse } from 'next/server';
import { db, sql, eq, and, asc } from '@/lib/db';
import { stockOpnames, stockOpnameItems, productStocks, productStockBatches } from '@/lib/db';
import { calculateFIFOCost } from '@petshop/shared/utils/fifo-shrinkage';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const soId = Number(params.id);
    const body = await req.json();
    const { items, branchId } = body;

    if (!items || items.length === 0 || !branchId) {
      return NextResponse.json({ error: 'Missing items or branchId' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Verify SO exists and is PENDING
      const [so] = await tx.select().from(stockOpnames).where(eq(stockOpnames.id, soId)).limit(1);
      if (!so) throw new Error('Stock Opname not found');
      if (so.status !== 'PENDING') throw new Error('Stock Opname is not in PENDING status');

      const processedItems = [];

      for (const item of items) {
        // A. Re-fetch current systemQty
        const stocks = await tx.select()
          .from(productStocks)
          .where(and(
            eq(productStocks.productId, item.productId),
            eq(productStocks.branchId, Number(branchId)),
            eq(productStocks.uomId, item.uomId)
          ))
          .limit(1);
        
        const systemQty = stocks.length > 0 ? parseFloat(stocks[0].qty) : 0;
        const physicalQty = parseFloat(item.physicalQty);
        const varianceQty = physicalQty - systemQty;

        // B. Calculate FIFO Variance Cost
        let varianceCostValue = '0';
        if (varianceQty !== 0) {
          const batches = await tx.select()
            .from(productStockBatches)
            .where(and(
              eq(productStockBatches.productId, item.productId),
              eq(productStockBatches.branchId, Number(branchId)),
              eq(productStockBatches.uomId, item.uomId),
              sql`${productStockBatches.qtyRemaining} > 0`
            ))
            .orderBy(asc(productStockBatches.receivedAt));

          const mappedBatches = batches.map(b => ({
            id: b.id,
            qty: parseFloat(b.qtyRemaining),
            costPrice: parseFloat(b.costPrice)
          }));

          const fifoResult = calculateFIFOCost(mappedBatches, Math.abs(varianceQty));
          varianceCostValue = fifoResult.totalCost.toString();
        }

        // C. Check if item already exists in this SO (Multi-session support)
        const existingItems = await tx.select()
          .from(stockOpnameItems)
          .where(and(
            eq(stockOpnameItems.soId, soId),
            eq(stockOpnameItems.productId, item.productId),
            eq(stockOpnameItems.uomId, item.uomId)
          ))
          .limit(1);

        if (existingItems.length > 0) {
          // Update existing
          const [updated] = await tx.update(stockOpnameItems)
            .set({
              systemQty: systemQty.toString(),
              physicalQty: physicalQty.toString(),
              varianceQty: varianceQty.toString(),
              varianceCostValue: varianceCostValue,
              varianceReason: item.varianceReason || existingItems[0].varianceReason,
            })
            .where(eq(stockOpnameItems.id, existingItems[0].id))
            .returning();
          processedItems.push(updated);
        } else {
          // Insert new
          const [inserted] = await tx.insert(stockOpnameItems).values({
            soId: soId,
            productId: item.productId,
            uomId: item.uomId,
            systemQty: systemQty.toString(),
            physicalQty: physicalQty.toString(),
            varianceQty: varianceQty.toString(),
            varianceCostValue: varianceCostValue,
            varianceReason: item.varianceReason || null,
          }).returning();
          processedItems.push(inserted);
        }
      }

      return processedItems;
    });

    return NextResponse.json({
      success: true,
      itemsCount: result.length
    });

  } catch (error: any) {
    console.error('Add Items to SO API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to add items to stock opname' }, { status: 500 });
  }
}
