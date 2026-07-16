import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, scopeFilter } from '@/lib/authz';
import { db, customerOrders, eq, and } from '@/lib/db';

export const dynamic = 'force-dynamic';

const rejectSchema = z.object({
  reason: z.string().min(1, 'Alasan penolakan wajib diisi').max(500, 'Alasan maksimal 500 karakter'),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('transaction.bulk_sale');
    if (gate instanceof NextResponse) return gate;
    const payload = gate;

    const { id } = await params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const parsed = rejectSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 });
    }

    const [order] = await db
      .select({ id: customerOrders.id, status: customerOrders.status })
      .from(customerOrders)
      .where(and(eq(customerOrders.id, orderId), scopeFilter(payload, customerOrders.branchId)))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: 'Order tidak ditemukan' }, { status: 404 });
    }
    if (order.status !== 'PENDING') {
      return NextResponse.json({ error: 'Order ini sudah diproses, tidak bisa ditolak lagi' }, { status: 409 });
    }

    const [updated] = await db
      .update(customerOrders)
      .set({
        status: 'REJECTED',
        rejectReason: parsed.data.reason,
        processedById: payload.userId,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(customerOrders.id, orderId), eq(customerOrders.status, 'PENDING')))
      .returning({ id: customerOrders.id });

    if (!updated) {
      return NextResponse.json({ error: 'Order ini sudah diproses, tidak bisa ditolak lagi' }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST customer-order reject error:', error);
    return NextResponse.json({ error: 'Gagal menolak order' }, { status: 500 });
  }
}
