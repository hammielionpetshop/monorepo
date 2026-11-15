import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { purchaseOrdersForSupplier } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// PO supplier kasir untuk pilihan "Dari PO yang ada" di Laporan Bongkaran (spec 2026-11-06 §1).
export async function GET(req: Request) {
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const supplierId = Number(new URL(req.url).searchParams.get('supplierId'));
  if (!Number.isInteger(supplierId) || supplierId <= 0) return NextResponse.json({ error: 'Pilih supplier dulu.' }, { status: 400 });
  const result = await purchaseOrdersForSupplier(actor, supplierId);
  return result.ok ? NextResponse.json(result.data) : NextResponse.json({ error: result.error }, { status: result.status });
}
