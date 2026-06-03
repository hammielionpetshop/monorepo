import { NextRequest, NextResponse } from 'next/server';
import { db, sql, eq, and, asc } from '@/lib/db';
import { stockOpnames, stockOpnameItems, productStocks, productStockBatches } from '@/lib/db';
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
        // A. Re-fetch systemQty from DB
        const stocks = await tx.select()
          .from(productStocks)
          .where(and(
            eq(productStocks.productId, item.productId),
            eq(productStocks.branchId, Number(branchId)),
            eq(productStocks.uomId, item.uomId)
          ))
          .limit(1);
        
        const systemQty = stocks.length > 0 ? Number(stocks[0].qty) : 0;
        const physicalQty = parseFloat(item.physicalQty);
        const varianceQty = physicalQty - systemQty;

        // B. Calculate estimasi nilai selisih (shrinkage cost) via FIFO
        let varianceCostValue: number = 0;
        if (varianceQty !== 0) {
          // Hanya hitung cost jika ada selisih
          // Ambil semua batches untuk produk ini (FIFO - tertua dulu)
          const batches = await tx.select()
            .from(productStockBatches)
            .where(and(
              eq(productStockBatches.productId, item.productId),
              eq(productStockBatches.branchId, Number(branchId)),
              eq(productStockBatches.uomId, item.uomId),
              sql`${productStockBatches.qtyRemaining} > 0`
            ))
            .orderBy(asc(productStockBatches.receivedAt));

          // Convert to format calculateFIFOCost expects
          const mappedBatches = batches.map(b => ({
            id: b.id,
            qty: Number(b.qtyRemaining),
            costPrice: Number(b.costPrice)
          }));

          const fifoResult = calculateFIFOCost(mappedBatches, Math.abs(varianceQty));
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
