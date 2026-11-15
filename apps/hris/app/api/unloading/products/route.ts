import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { searchProducts } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Cari barang di daftar produk kasir untuk Laporan Bongkaran (DRV-32, spec L8 §3.2).
export async function GET(req: Request) {
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const result = await searchProducts(actor, (new URL(req.url).searchParams.get('q') ?? '').slice(0, 80));
  return result.ok ? NextResponse.json(result.data) : NextResponse.json({ error: result.error }, { status: result.status });
}
