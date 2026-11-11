import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { readStoredFile } from '@/modules/files';
import { openRentalProof } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Foto bukti bayar sewa mobil (F2-5b): hanya pemegang hak lihat/bayar Sewa Mobil. Selain itu 404.
export async function GET(req: Request) {
  const paymentId = Number(new URL(req.url).searchParams.get('payment'));
  const notFound = () => new NextResponse('Tidak ditemukan', { status: 404 });
  if (!Number.isInteger(paymentId) || paymentId <= 0) return notFound();
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const fileId = await openRentalProof(actor, paymentId);
  if (!fileId) return notFound();
  const stored = await readStoredFile(fileId);
  if (!stored) return notFound();
  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: { 'Content-Type': stored.mime, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
