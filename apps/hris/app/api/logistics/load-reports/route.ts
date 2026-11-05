import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import {
  addLoadNotes, addLoadPhoto, cancelLoadReport, candidateNotes, createLoadReport, finishLoadReport, releaseLoadNote, removeLoadPhoto,
} from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), branchId: id, transactionIds: z.array(id).min(1).max(10) }),
  z.object({ action: z.literal('add_notes'), reportId: id, transactionIds: z.array(id).min(1).max(10) }),
  z.object({ action: z.literal('release_note'), reportId: id, noteId: id }),
  z.object({ action: z.literal('remove_photo'), reportId: id, photoId: id }),
  z.object({ action: z.literal('finish'), reportId: id }),
  z.object({ action: z.literal('cancel'), reportId: id, reason: z.string().max(500) }),
]);

const positive = (value: string | null) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Laporan Muat (spec LT1 §15.1). GET = nota kasir yang boleh dipilih; POST JSON = aksi; POST form = tambah foto (kamera).
export async function GET(req: Request) {
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const branchId = positive(params.get('branch'));
  if (!branchId) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const rows = await candidateNotes(actor, branchId, { q: params.get('q')?.slice(0, 60) ?? null, customerId: positive(params.get('customer')) });
  if (!rows) return NextResponse.json({ error: 'Anda tidak berhak melihat nota cabang ini.' }, { status: 403 });
  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);

  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    const reportId = positive(typeof form?.get('reportId') === 'string' ? (form!.get('reportId') as string) : null);
    const kind = form?.get('kind');
    const photo = form?.get('photo');
    if (!reportId || (kind !== 'NOTE' && kind !== 'GOODS')) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
    const result = await addLoadPhoto(actor, reportId, kind, photo instanceof File ? photo : null);
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const body = parsed.data;
  const result = await (async () => {
    switch (body.action) {
      case 'create': return createLoadReport(actor, body);
      case 'add_notes': return addLoadNotes(actor, body.reportId, body.transactionIds);
      case 'release_note': return releaseLoadNote(actor, body.reportId, body.noteId);
      case 'remove_photo': return removeLoadPhoto(actor, body.reportId, body.photoId);
      case 'finish': return finishLoadReport(actor, body.reportId);
      case 'cancel': return cancelLoadReport(actor, body.reportId, body.reason);
    }
  })();
  return result.ok ? NextResponse.json({ ok: true, ...(result.data ?? {}) }) : NextResponse.json({ error: result.error }, { status: result.status });
}
