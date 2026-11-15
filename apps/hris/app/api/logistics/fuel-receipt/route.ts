import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { readStoredFile } from '@/modules/files';
import { openFuelReceipt } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Foto struk bensin (spec LT1 §17.1 butir 3): hanya pemegang hak bensin / Bensin & Mobil. Selain itu 404.
export async function GET(req: Request) {
  const fillId = Number(new URL(req.url).searchParams.get('fill'));
  const notFound = () => new NextResponse('Tidak ditemukan', { status: 404 });
  if (!Number.isInteger(fillId) || fillId <= 0) return notFound();
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const fileId = await openFuelReceipt(actor, fillId);
  if (!fileId) return notFound();
  const stored = await readStoredFile(fileId);
  if (!stored) return notFound();
  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: { 'Content-Type': stored.mime, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
