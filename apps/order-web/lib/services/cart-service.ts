import Big from 'big.js';
import {
  db,
  eq,
  and,
  inArray,
  customerCartItems,
  products,
  productPrices,
  productStocks,
  unitsOfMeasure,
} from '@/lib/db';
import { orderBranchId, stockStatus, type StockStatus } from '@/lib/services/catalog-service';

export function getMinOrderAmount(): number {
  const value = Number(process.env.ORDER_MIN_AMOUNT ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export interface CartItemView {
  id: number;
  productId: number;
  productName: string;
  imageUrl: string | null;
  uomId: number;
  uomCode: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  stockQty: number;
  stockStatus: StockStatus;
  isActive: boolean;
}

export interface CartView {
  items: CartItemView[];
  subtotal: number;
  minOrderAmount: number;
  meetsMinimum: boolean;
}

async function loadCart(customerId: number, tierType: string): Promise<CartView> {
  const branchId = orderBranchId();

  const rows = await db
    .select({
      id: customerCartItems.id,
      productId: customerCartItems.productId,
      uomId: customerCartItems.uomId,
      qty: customerCartItems.qty,
      productName: products.name,
      imageUrl: products.imageUrl,
      isActive: products.isActive,
      uomCode: unitsOfMeasure.code,
      stockQty: productStocks.qty,
    })
    .from(customerCartItems)
    .innerJoin(products, eq(customerCartItems.productId, products.id))
    .leftJoin(unitsOfMeasure, eq(customerCartItems.uomId, unitsOfMeasure.id))
    .leftJoin(
      productStocks,
      and(eq(productStocks.productId, customerCartItems.productId), eq(productStocks.branchId, branchId)),
    )
    .where(eq(customerCartItems.customerId, customerId))
    .orderBy(customerCartItems.createdAt);

  const productIds = rows.map((r) => r.productId);
  const priceRows = productIds.length
    ? await db
        .select({ productId: productPrices.productId, uomId: productPrices.uomId, price: productPrices.price })
        .from(productPrices)
        .where(
          and(
            eq(productPrices.branchId, branchId),
            eq(productPrices.tierType, tierType),
            inArray(productPrices.productId, productIds),
          ),
        )
    : [];

  const priceByKey = new Map(priceRows.map((p) => [`${p.productId}:${p.uomId}`, p.price]));

  let subtotal = new Big(0);
  const items: CartItemView[] = rows.map((row) => {
    const unitPrice = priceByKey.get(`${row.productId}:${row.uomId}`) ?? 0;
    const itemSubtotal = new Big(unitPrice).times(row.qty);
    subtotal = subtotal.plus(itemSubtotal);
    const stockQty = row.stockQty ?? 0;

    return {
      id: row.id,
      productId: row.productId,
      productName: row.productName,
      imageUrl: row.imageUrl,
      uomId: row.uomId,
      uomCode: row.uomCode ?? '',
      qty: row.qty,
      unitPrice,
      subtotal: itemSubtotal.toNumber(),
      stockQty,
      stockStatus: stockStatus(stockQty),
      isActive: row.isActive,
    };
  });

  const minOrderAmount = getMinOrderAmount();

  return {
    items,
    subtotal: subtotal.toNumber(),
    minOrderAmount,
    meetsMinimum: minOrderAmount === 0 || subtotal.gte(minOrderAmount),
  };
}

export type UpsertCartItemReason = 'INVALID_QTY' | 'PRODUCT_NOT_FOUND';
export type UpsertCartItemResult = { ok: true; cart: CartView } | { ok: false; error: string; reason: UpsertCartItemReason };

const MAX_QTY_PER_ITEM = 9999;

export async function upsertCartItem(
  customerId: number,
  tierType: string,
  productId: number,
  uomId: number,
  qty: number,
): Promise<UpsertCartItemResult> {
  if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_QTY_PER_ITEM) {
    return { ok: false, error: `Jumlah harus antara 1 dan ${MAX_QTY_PER_ITEM}`, reason: 'INVALID_QTY' };
  }

  const branchId = orderBranchId();
  const [priceRow] = await db
    .select({ price: productPrices.price })
    .from(productPrices)
    .innerJoin(products, eq(products.id, productPrices.productId))
    .where(
      and(
        eq(productPrices.productId, productId),
        eq(productPrices.uomId, uomId),
        eq(productPrices.branchId, branchId),
        eq(productPrices.tierType, tierType),
        eq(products.isActive, true),
      ),
    )
    .limit(1);

  if (!priceRow) {
    return { ok: false, error: 'Produk tidak tersedia untuk dibeli', reason: 'PRODUCT_NOT_FOUND' };
  }

  await db
    .insert(customerCartItems)
    .values({ customerId, productId, uomId, qty })
    .onConflictDoUpdate({
      target: [customerCartItems.customerId, customerCartItems.productId, customerCartItems.uomId],
      set: { qty, updatedAt: new Date() },
    });

  return { ok: true, cart: await loadCart(customerId, tierType) };
}

export async function updateCartItemQty(
  customerId: number,
  tierType: string,
  cartItemId: number,
  qty: number,
): Promise<UpsertCartItemResult> {
  if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY_PER_ITEM) {
    return { ok: false, error: `Jumlah harus antara 0 dan ${MAX_QTY_PER_ITEM}`, reason: 'INVALID_QTY' };
  }

  if (qty === 0) {
    await db
      .delete(customerCartItems)
      .where(and(eq(customerCartItems.id, cartItemId), eq(customerCartItems.customerId, customerId)));
  } else {
    await db
      .update(customerCartItems)
      .set({ qty, updatedAt: new Date() })
      .where(and(eq(customerCartItems.id, cartItemId), eq(customerCartItems.customerId, customerId)));
  }

  return { ok: true, cart: await loadCart(customerId, tierType) };
}

export async function removeCartItem(customerId: number, tierType: string, cartItemId: number): Promise<CartView> {
  await db
    .delete(customerCartItems)
    .where(and(eq(customerCartItems.id, cartItemId), eq(customerCartItems.customerId, customerId)));

  return loadCart(customerId, tierType);
}

export async function getCart(customerId: number, tierType: string): Promise<CartView> {
  return loadCart(customerId, tierType);
}
