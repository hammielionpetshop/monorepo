import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/require-customer';
import { getOrderDetail } from '@/lib/services/order-service';

export const dynamic = 'force-dynamic';

function parseOrderId(id: string) {
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCustomer();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const orderId = parseOrderId(id);
  if (!orderId) {
    return NextResponse.json({ error: 'ID pesanan tidak valid' }, { status: 400 });
  }

  try {
    const order = await getOrderDetail(gate.customerId, orderId);
    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (error) {
    console.error('order detail error:', error);
    return NextResponse.json({ error: 'Gagal memuat detail pesanan' }, { status: 500 });
  }
}
