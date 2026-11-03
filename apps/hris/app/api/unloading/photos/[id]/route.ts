import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { readStoredFile } from '@/modules/files';
import { openUnloadingPhoto } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Foto surat jalan / barang Laporan Bongkaran: hanya yang boleh melihat Laporan Bongkaran. Selain itu 404.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notFound = () => new NextResponse('Tidak ditemukan', { status: 404 });
  if (!/^\d+$/.test(id)) return notFound();
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const fileId = await openUnloadingPhoto(actor, Number(id));
  if (!fileId) return notFound();
  const stored = await readStoredFile(fileId);
  if (!stored) return notFound();
  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: { 'Content-Type': stored.mime, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
