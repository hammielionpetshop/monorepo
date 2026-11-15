import { NextResponse } from 'next/server';
import { createOrderSchema } from '@petshop/shared';
import { requireCustomer } from '@/lib/require-customer';
import { createOrder, listOrders } from '@/lib/services/order-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireCustomer();
  if (gate instanceof NextResponse) return gate;

  try {
    const orders = await listOrders(gate.customerId);
    return NextResponse.json(orders);
  } catch (error) {
    console.error('orders list error:', error);
    return NextResponse.json({ error: 'Gagal memuat riwayat pesanan' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireCustomer();
  if (gate instanceof NextResponse) return gate;

  const body = await req.json().catch(() => ({}));
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 });
  }

  try {
    const result = await createOrder(gate.customerId, gate.tierType, parsed.data.note);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.order, { status: 201 });
  } catch (error) {
    console.error('order create error:', error);
    return NextResponse.json({ error: 'Gagal membuat pesanan' }, { status: 500 });
  }
}
