import { NextResponse } from 'next/server';
import { addCartItemSchema } from '@petshop/shared';
import { requireCustomer } from '@/lib/require-customer';
import { getCart, upsertCartItem } from '@/lib/services/cart-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireCustomer();
  if (gate instanceof NextResponse) return gate;

  try {
    const cart = await getCart(gate.customerId, gate.tierType);
    return NextResponse.json(cart);
  } catch (error) {
    console.error('cart get error:', error);
    return NextResponse.json({ error: 'Gagal memuat keranjang' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireCustomer();
  if (gate instanceof NextResponse) return gate;

  const body = await req.json();
  const parsed = addCartItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 });
  }

  try {
    const result = await upsertCartItem(
      gate.customerId,
      gate.tierType,
      parsed.data.productId,
      parsed.data.uomId,
      parsed.data.qty,
    );
    if (!result.ok) {
      const status = result.reason === 'INVALID_QTY' ? 400 : 404;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result.cart, { status: 201 });
  } catch (error) {
    console.error('cart add error:', error);
    return NextResponse.json({ error: 'Gagal menambah item ke keranjang' }, { status: 500 });
  }
}
