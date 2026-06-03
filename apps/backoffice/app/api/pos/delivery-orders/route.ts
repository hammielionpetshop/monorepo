import { NextResponse } from 'next/server';
import { db, deliveryOrders, transactions, transactionItems, products, eq, sql, and } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transactionId, branchId, printedById, customerName, customerAddress, notes } = body;

    if (!transactionId || !branchId || !printedById || !customerName) {
      return NextResponse.json({ error: 'Missing required payload' }, { status: 400 });
    }

    // 1. Generate DO Number: DO-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const existingDos = await db.query.deliveryOrders.findMany({
      where: and(
        eq(deliveryOrders.branchId, branchId),
        sql`DATE(${deliveryOrders.printedAt}) = CURRENT_DATE`
      ),
    });
    
    const increment = (existingDos.length + 1).toString().padStart(4, '0');
    const doNumber = `DO-${dateStr}-${increment}`;

    // 2. Fetch transaction details to calculate total weight
    const [txDetails] = await db
      .select({
        productId: transactionItems.productId,
        qty: transactionItems.qty,
        weightGram: products.weightGram,
      })
      .from(transactionItems)
      .innerJoin(products, eq(transactionItems.productId, products.id))
      .where(eq(transactionItems.transactionId, transactionId));

    let totalWeightGram = 0;
    // Note: This logic assumes weightGram is available on the product
    // If not, it defaults to 0. 
    // We Map through it because we might have multiple items.
    const items = await db
      .select({
        productId: transactionItems.productId,
        qty: transactionItems.qty,
        weightGram: products.weightGram,
      })
      .from(transactionItems)
      .innerJoin(products, eq(transactionItems.productId, products.id))
      .where(eq(transactionItems.transactionId, transactionId));

    items.forEach(item => {
      totalWeightGram += (parseFloat(item.qty.toString()) * parseFloat((item.weightGram || 0).toString()));
    });

    // 3. Insert Delivery Order
    const [newDO] = await db.insert(deliveryOrders).values({
      doNumber,
      transactionId,
      branchId,
      customerName,
      customerAddress,
      totalWeightGram: Math.round(totalWeightGram),
      printedById,
      notes,
      printedAt: new Date(),
    }).returning();

    return NextResponse.json({
      success: true,
      data: newDO,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create DO error:', error);
    return NextResponse.json({ error: 'Failed to create delivery order' }, { status: 500 });
  }
}


