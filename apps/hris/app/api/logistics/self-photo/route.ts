import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { readStoredFile } from '@/modules/files';
import { openSelfPhoto } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Foto antar sendiri (spec LT1 §15.2): PJ, penerima tunai, atau pelihat cabang itu. Selain itu 404.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const tripId = Number(params.get('trip'));
  const stopId = params.get('stop') ? Number(params.get('stop')) : null;
  const kind = params.get('kind') ?? '';
  const notFound = () => new NextResponse('Tidak ditemukan', { status: 404 });
  if (!Number.isInteger(tripId) || tripId <= 0 || !['pickup', 'return', 'stop', 'proof'].includes(kind)) return notFound();
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const fileId = await openSelfPhoto(actor, { tripId, kind, stopId: stopId && Number.isInteger(stopId) ? stopId : null });
  if (!fileId) return notFound();
  const stored = await readStoredFile(fileId);
  if (!stored) return notFound();
  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: { 'Content-Type': stored.mime, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
