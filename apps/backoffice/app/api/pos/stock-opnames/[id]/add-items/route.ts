import { NextRequest, NextResponse } from 'next/server';
import { db, sql, eq, and, asc } from '@/lib/db';
import { stockOpnames, stockOpnameItems, productStocks, productStockBatches, productUomConversions } from '@/lib/db';
import { calculateFIFOCost } from '@petshop/shared/utils/fifo-shrinkage';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const soId = Number(id);
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
        // A. Re-fetch systemQty — agregasi semua UOM, konversi ke item.uomId
        const allStocks = await tx.select({
            uomId: productStocks.uomId,
            qty: productStocks.qty,
            ratio: productUomConversions.ratio,
          })
          .from(productStocks)
          .leftJoin(productUomConversions, and(
            eq(productUomConversions.productId, productStocks.productId),
            eq(productUomConversions.uomId, productStocks.uomId)
          ))
          .where(and(
            eq(productStocks.productId, item.productId),
            eq(productStocks.branchId, Number(branchId))
          ));

        const [itemConv] = await tx.select({ ratio: productUomConversions.ratio })
          .from(productUomConversions)
          .where(and(
            eq(productUomConversions.productId, item.productId),
            eq(productUomConversions.uomId, item.uomId)
          ))
          .limit(1);

        const itemUomRatio = itemConv?.ratio ?? 1;
        const totalBaseQty = allStocks.reduce((sum: number, s: any) => sum + Number(s.qty) * (s.ratio ?? 1), 0);
        const systemQty = Math.floor(totalBaseQty / itemUomRatio);
        const physicalQty = parseFloat(item.physicalQty);
        const varianceQty = physicalQty - systemQty;

        // B. Calculate FIFO Variance Cost dalam base UOM
        let varianceCostValue: number = 0;
        if (varianceQty !== 0) {
          const allBatches = await tx.select({
              id: productStockBatches.id,
              qtyRemaining: productStockBatches.qtyRemaining,
              costPrice: productStockBatches.costPrice,
              receivedAt: productStockBatches.receivedAt,
              ratio: productUomConversions.ratio,
            })
            .from(productStockBatches)
            .leftJoin(productUomConversions, and(
              eq(productUomConversions.productId, productStockBatches.productId),
              eq(productUomConversions.uomId, productStockBatches.uomId)
            ))
            .where(and(
              eq(productStockBatches.productId, item.productId),
              eq(productStockBatches.branchId, Number(branchId)),
              sql`${productStockBatches.qtyRemaining} > 0`
            ))
            .orderBy(asc(productStockBatches.receivedAt));

          const mappedBatches = allBatches.map((b: any) => {
            const r = b.ratio ?? 1;
            return {
              id: b.id,
              qty: Number(b.qtyRemaining) * r,
              costPrice: r > 1 ? Number(b.costPrice) / r : Number(b.costPrice),
            };
          });

          const varianceBase = Math.abs(varianceQty) * itemUomRatio;
          const fifoResult = calculateFIFOCost(mappedBatches, varianceBase);
          varianceCostValue = Math.round(fifoResult.totalCost);
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
              systemQty: Math.round(systemQty),
              physicalQty: Math.round(physicalQty),
              varianceQty: Math.round(varianceQty),
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
            systemQty: Math.round(systemQty),
            physicalQty: Math.round(physicalQty),
            varianceQty: Math.round(varianceQty),
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
