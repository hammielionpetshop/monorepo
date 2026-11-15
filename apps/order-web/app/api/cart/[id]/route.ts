import { NextResponse } from 'next/server';
import { updateCartItemSchema } from '@petshop/shared';
import { requireCustomer } from '@/lib/require-customer';
import { removeCartItem, updateCartItemQty } from '@/lib/services/cart-service';

export const dynamic = 'force-dynamic';

function parseCartItemId(id: string) {
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCustomer();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const cartItemId = parseCartItemId(id);
  if (!cartItemId) {
    return NextResponse.json({ error: 'ID item keranjang tidak valid' }, { status: 400 });
  }

  const body = await req.json();
  const parsed = updateCartItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 });
  }

  try {
    const result = await updateCartItemQty(gate.customerId, gate.tierType, cartItemId, parsed.data.qty);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.cart);
  } catch (error) {
    console.error('cart update error:', error);
    return NextResponse.json({ error: 'Gagal mengubah jumlah item' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCustomer();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const cartItemId = parseCartItemId(id);
  if (!cartItemId) {
    return NextResponse.json({ error: 'ID item keranjang tidak valid' }, { status: 400 });
  }

  try {
    const cart = await removeCartItem(gate.customerId, gate.tierType, cartItemId);
    return NextResponse.json(cart);
  } catch (error) {
    console.error('cart delete error:', error);
    return NextResponse.json({ error: 'Gagal menghapus item' }, { status: 500 });
  }
}
