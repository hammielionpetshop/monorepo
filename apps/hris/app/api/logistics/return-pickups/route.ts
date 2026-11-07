import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { searchPickupStores } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Cari toko untuk tugas jemput retur baru (A2). Hak diperiksa di layanan.
export async function GET(req: Request) {
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const q = (new URL(req.url).searchParams.get('q') ?? '').slice(0, 60);
  const stores = await searchPickupStores(actor, q);
  if (!stores) return NextResponse.json({ error: 'Anda tidak berhak melakukan tindakan ini.' }, { status: 403 });
  return NextResponse.json({ stores });
}
