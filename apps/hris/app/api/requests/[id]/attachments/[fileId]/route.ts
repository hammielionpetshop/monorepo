import { NextResponse } from 'next/server';
import { currentHrisSession } from '@/lib/auth';
import { loadActor } from '@/modules/access';
import { isFileId, readStoredFile } from '@/modules/files';
import { attachmentAllowed } from '@/modules/requests';

export const dynamic = 'force-dynamic';

// Lampiran pengajuan: hanya keluar untuk yang berhak melihatnya (PRI-23). Selain itu 404, tanpa membedakan sebab.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  const notFound = () => new NextResponse('Tidak ditemukan', { status: 404 });
  if (!/^\d+$/.test(id) || !isFileId(fileId)) return notFound();
  const session = await currentHrisSession();
  if (!session.ok) return new NextResponse('Perlu masuk', { status: 401 });
  const actor = await loadActor(session.accountId, session.localUserId);
  if (!(await attachmentAllowed(actor, Number(id), fileId))) return notFound();
  const stored = await readStoredFile(fileId);
  if (!stored) return notFound();
  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: {
      'Content-Type': stored.mime,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
