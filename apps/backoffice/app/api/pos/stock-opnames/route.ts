import { NextRequest, NextResponse } from 'next/server';
import { db, sql, eq, and, asc } from '@/lib/db';
import { stockOpnames, stockOpnameItems, productStocks, productStockBatches, productUomConversions } from '@/lib/db';
import { calculateFIFOCost } from '@petshop/shared/utils/fifo-shrinkage';

export const dynamic = 'force-dynamic';

function generateSONumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SO-${dateStr}-${random}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { branchId, shiftId, type, method, items, notes, createdById } = body;

    if (!branchId || !type || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required payload' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Create SO Header
      const soNum = generateSONumber();
      const [header] = await tx.insert(stockOpnames).values({
        soNumber: soNum,
        branchId: Number(branchId),
        shiftId: shiftId ? Number(shiftId) : null,
        type: type, // DAILY, FULL
        method: method, // BEST_SELLER, SOLD_TODAY, MANUAL
        status: 'PENDING',
        createdById: Number(createdById),
        notes: notes || null,
      }).returning();

      // 2. Process Items
      for (const item of items) {
        // A. Re-fetch systemQty dari DB — agregasi semua UOM, konversi ke item.uomId
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

        // B. Calculate estimasi nilai selisih (shrinkage cost) via FIFO dalam base UOM
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

          // Konversi ke base UOM: qtyRemaining × ratio, costPrice ÷ ratio
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

        // C. Insert SO Item
        await tx.insert(stockOpnameItems).values({
          soId: header.id,
          productId: item.productId,
          uomId: item.uomId,
          systemQty: Math.round(systemQty),
          physicalQty: Math.round(physicalQty),
          varianceQty: Math.round(varianceQty),
          varianceCostValue: varianceCostValue,
          varianceReason: item.varianceReason || null,
        });
      }

      return header;
    });

    return NextResponse.json({
      success: true,
      so: result
    }, { status: 201 });

  } catch (error: any) {
    console.error('Submit Stock Opname API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to submit stock opname' }, { status: 500 });
  }
}
