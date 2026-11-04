import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { readStoredFile } from '@/modules/files';
import { openStorePointPhoto } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Foto depan toko dari usulan titik (spec LT1 §13.4): hanya untuk yang berhak, setiap pembukaan dicatat. Selain itu 404.
export async function GET(req: Request) {
  const pointId = Number(new URL(req.url).searchParams.get('point'));
  const notFound = () => new NextResponse('Tidak ditemukan', { status: 404 });
  if (!Number.isInteger(pointId) || pointId <= 0) return notFound();
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const fileId = await openStorePointPhoto(actor, pointId);
  if (!fileId) return notFound();
  const stored = await readStoredFile(fileId);
  if (!stored) return notFound();
  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: { 'Content-Type': stored.mime, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
