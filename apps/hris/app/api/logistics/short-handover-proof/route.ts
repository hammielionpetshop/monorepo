import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { readStoredFile } from '@/modules/files';
import { openShortProof } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Foto bukti ganti tunai kurang serah (spec B3): pemeriksa Terima Uang / pengusul Potongan Lain. Selain itu 404.
export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  const notFound = () => new NextResponse('Tidak ditemukan', { status: 404 });
  if (!Number.isInteger(id) || id <= 0) return notFound();
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const fileId = await openShortProof(actor, id);
  if (!fileId) return notFound();
  const stored = await readStoredFile(fileId);
  if (!stored) return notFound();
  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: { 'Content-Type': stored.mime, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
