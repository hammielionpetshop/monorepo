import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { loadActor } from '@/modules/access';
import { addReportNote, markHandoverRead } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('read'), id: z.number().int().positive() }),
  z.object({ action: z.literal('note'), id: z.number().int().positive(), body: z.string().max(2000) }),
]);

// Sudah saya baca (KEH-92) dan Tambah keterangan serah terima (KEH-95).
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await loadActor(session.accountId, session.localUserId);
  const body = parsed.data;
  const result = body.action === 'read'
    ? await markHandoverRead(actor, body.id)
    : await addReportNote(actor, { kind: 'HANDOVER', reportId: body.id, body: body.body });
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}
