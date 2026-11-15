import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/require-customer';
import { reorderItems } from '@/lib/services/order-service';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCustomer();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: 'ID pesanan tidak valid' }, { status: 400 });
  }

  try {
    const result = await reorderItems(gate.customerId, gate.tierType, orderId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('reorder error:', error);
    return NextResponse.json({ error: 'Gagal memuat ulang pesanan' }, { status: 500 });
  }
}
