import { formatRupiah } from '@petshop/shared';
import { db, eq, and, desc, count, customerOrders, customerOrderItems, customerCartItems, transactions } from '@/lib/db';
import { orderBranchId } from '@/lib/services/catalog-service';
import { getCart, upsertCartItem } from '@/lib/services/cart-service';

function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${date}-${random}`;
}

export interface CreateOrderView {
  id: number;
  orderNumber: string;
  estimatedTotal: number;
}

export type CreateOrderReason = 'EMPTY_CART' | 'BELOW_MINIMUM' | 'INVALID_ITEMS';
export type CreateOrderResult =
  | { ok: true; order: CreateOrderView }
  | { ok: false; error: string; reason: CreateOrderReason };

export async function createOrder(
  customerId: number,
  tierType: string,
  note: string | undefined,
): Promise<CreateOrderResult> {
  const branchId = orderBranchId();
  const cart = await getCart(customerId, tierType);

  if (cart.items.length === 0) {
    return { ok: false, error: 'Keranjang kosong', reason: 'EMPTY_CART' };
  }

  const hasInvalidItem = cart.items.some((item) => !item.isActive || item.unitPrice <= 0);
  if (hasInvalidItem) {
    return {
      ok: false,
      error: 'Beberapa produk di keranjang sudah tidak tersedia, silakan periksa kembali keranjang Anda',
      reason: 'INVALID_ITEMS',
    };
  }

  if (!cart.meetsMinimum) {
    return {
      ok: false,
      error: `Belanja belum mencapai minimum order ${formatRupiah(cart.minOrderAmount)}`,
      reason: 'BELOW_MINIMUM',
    };
  }

  const orderNumber = generateOrderNumber();

  const created = await db.transaction(async (trx) => {
    const [order] = await trx
      .insert(customerOrders)
      .values({
        orderNumber,
        customerId,
        branchId,
        note: note?.trim() || null,
        estimatedTotal: cart.subtotal,
      })
      .returning();

    await trx.insert(customerOrderItems).values(
      cart.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        productName: item.productName,
        uomId: item.uomId,
        uomCode: item.uomCode,
        qty: item.qty,
        priceTier: tierType,
        unitPriceSnapshot: item.unitPrice,
        subtotalSnapshot: item.subtotal,
      })),
    );

    await trx.delete(customerCartItems).where(eq(customerCartItems.customerId, customerId));

    return order;
  });

  return {
    ok: true,
    order: { id: created.id, orderNumber: created.orderNumber, estimatedTotal: created.estimatedTotal },
  };
}

export interface OrderSummaryView {
  id: number;
  orderNumber: string;
  status: string;
  estimatedTotal: number;
  itemCount: number;
  createdAt: string;
  rejectReason: string | null;
}

export async function listOrders(customerId: number): Promise<OrderSummaryView[]> {
  const rows = await db
    .select({
      id: customerOrders.id,
      orderNumber: customerOrders.orderNumber,
      status: customerOrders.status,
      estimatedTotal: customerOrders.estimatedTotal,
      rejectReason: customerOrders.rejectReason,
      createdAt: customerOrders.createdAt,
      itemCount: count(customerOrderItems.id),
    })
    .from(customerOrders)
    .leftJoin(customerOrderItems, eq(customerOrderItems.orderId, customerOrders.id))
    .where(eq(customerOrders.customerId, customerId))
    .groupBy(customerOrders.id)
    .orderBy(desc(customerOrders.createdAt));

  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    estimatedTotal: row.estimatedTotal,
    itemCount: Number(row.itemCount),
    createdAt: row.createdAt.toISOString(),
    rejectReason: row.rejectReason,
  }));
}

export interface OrderItemDetailView {
  productId: number;
  productName: string;
  uomCode: string;
  qty: number;
  unitPriceSnapshot: number;
  subtotalSnapshot: number;
}

export interface OrderDetailView {
  id: number;
  orderNumber: string;
  status: string;
  note: string | null;
  estimatedTotal: number;
  rejectReason: string | null;
  createdAt: string;
  items: OrderItemDetailView[];
  finalTotal: number | null;
}

export async function getOrderDetail(customerId: number, orderId: number): Promise<OrderDetailView | null> {
  const [order] = await db
    .select()
    .from(customerOrders)
    .where(and(eq(customerOrders.id, orderId), eq(customerOrders.customerId, customerId)))
    .limit(1);

  if (!order) return null;

  const items = await db
    .select({
      productId: customerOrderItems.productId,
      productName: customerOrderItems.productName,
      uomCode: customerOrderItems.uomCode,
      qty: customerOrderItems.qty,
      unitPriceSnapshot: customerOrderItems.unitPriceSnapshot,
      subtotalSnapshot: customerOrderItems.subtotalSnapshot,
    })
    .from(customerOrderItems)
    .where(eq(customerOrderItems.orderId, order.id))
    .orderBy(customerOrderItems.id);

  let finalTotal: number | null = null;
  if (order.convertedTransactionId) {
    const [trx] = await db
      .select({ totalAmount: transactions.totalAmount })
      .from(transactions)
      .where(eq(transactions.id, order.convertedTransactionId))
      .limit(1);
    finalTotal = trx?.totalAmount ?? null;
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    note: order.note,
    estimatedTotal: order.estimatedTotal,
    rejectReason: order.rejectReason,
    createdAt: order.createdAt.toISOString(),
    items,
    finalTotal,
  };
}

export type ReorderResult =
  | { ok: true; addedCount: number; skippedCount: number }
  | { ok: false; error: string };

export async function reorderItems(customerId: number, tierType: string, orderId: number): Promise<ReorderResult> {
  const [order] = await db
    .select({ id: customerOrders.id })
    .from(customerOrders)
    .where(and(eq(customerOrders.id, orderId), eq(customerOrders.customerId, customerId)))
    .limit(1);

  if (!order) {
    return { ok: false, error: 'Pesanan tidak ditemukan' };
  }

  const items = await db
    .select({ productId: customerOrderItems.productId, uomId: customerOrderItems.uomId, qty: customerOrderItems.qty })
    .from(customerOrderItems)
    .where(eq(customerOrderItems.orderId, orderId));

  let addedCount = 0;
  let skippedCount = 0;
  for (const item of items) {
    const result = await upsertCartItem(customerId, tierType, item.productId, item.uomId, item.qty);
    if (result.ok) addedCount += 1;
    else skippedCount += 1;
  }

  return { ok: true, addedCount, skippedCount };
}
