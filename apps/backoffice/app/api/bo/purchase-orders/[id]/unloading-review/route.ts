import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/authz';
import { db, purchaseOrders, purchaseOrderUnloadings, eq, and, isNull, isNotNull } from '@/lib/db';

export const dynamic = 'force-dynamic';

const schema = z.object({ note: z.string().trim().min(3, 'Catatan pemeriksaan minimal 3 huruf').max(500) });

/** "Sudah diperiksa" untuk tanda "Bongkaran berubah, periksa" (laporan dikoreksi/dibatalkan sesudah PO lewat Draft). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('po.manage');
  if (gate instanceof NextResponse) return gate;
  const payload = gate;
  const poId = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(poId) || poId <= 0) return NextResponse.json({ error: 'ID Purchase Order tidak valid' }, { status: 400 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 });

  if (payload.branchScope !== 'ALL') {
    const [po] = await db.select({ branchId: purchaseOrders.branchId }).from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
    if (!po || po.branchId !== payload.branchId) return NextResponse.json({ error: 'Purchase Order tidak ditemukan' }, { status: 404 });
  }

  const rows = await db.update(purchaseOrderUnloadings)
    .set({ reviewedAt: new Date(), reviewedById: payload.userId, reviewNote: parsed.data.note })
    .where(and(eq(purchaseOrderUnloadings.poId, poId), isNotNull(purchaseOrderUnloadings.changedAfterApprovalAt), isNull(purchaseOrderUnloadings.reviewedAt)))
    .returning({ id: purchaseOrderUnloadings.id });
  if (!rows.length) return NextResponse.json({ error: 'Tidak ada perubahan bongkaran yang perlu diperiksa' }, { status: 409 });
  return NextResponse.json({ success: true });
}
