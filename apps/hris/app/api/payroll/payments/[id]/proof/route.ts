import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { loadActor } from '@/modules/access';
import { readStoredFile } from '@/modules/files';
import { openPaymentProof } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Foto bukti pembayaran slip: hanya yang boleh melihat slipnya (spec L4f §3.1). Selain itu 404.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notFound = () => new NextResponse('Tidak ditemukan', { status: 404 });
  if (!/^\d+$/.test(id)) return notFound();
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await loadActor(session.accountId, session.localUserId);
  const fileId = await openPaymentProof(actor, Number(id));
  if (!fileId) return notFound();
  const stored = await readStoredFile(fileId);
  if (!stored) return notFound();
  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: { 'Content-Type': stored.mime, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
