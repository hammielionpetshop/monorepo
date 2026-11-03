import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { isFileId, readStoredFile } from '@/modules/files';
import { openTripPhoto } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Foto trip (awak, nota supplier, tutup kantor): hanya untuk yang berhak, setiap pembukaan dicatat. Selain itu 404.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tripId = Number(url.searchParams.get('trip'));
  const fileId = url.searchParams.get('file') ?? '';
  const notFound = () => new NextResponse('Tidak ditemukan', { status: 404 });
  if (!Number.isInteger(tripId) || tripId <= 0 || !isFileId(fileId)) return notFound();
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const allowed = await openTripPhoto(actor, tripId, fileId);
  if (!allowed) return notFound();
  const stored = await readStoredFile(allowed);
  if (!stored) return notFound();
  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: { 'Content-Type': stored.mime, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
