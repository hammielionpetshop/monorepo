import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { loadActor } from '@/modules/access';
import { answerRelocationNotYet } from '@/modules/attendance';
import { submitRequest } from '@/modules/requests';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ answer: z.enum(['YES', 'NOT_YET']), workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

// Sudah Pindah Cabang? (KEH-L10). Ya = pengajuan "Usulan pindah cabang" lewat Mesin Pengajuan.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await loadActor(session.accountId, session.localUserId);
  const result = parsed.data.answer === 'YES'
    ? await submitRequest(actor, 'relocation', REQUEST_HANDLERS.relocation, { fields: { workDate: parsed.data.workDate }, attachmentIds: [] })
    : await answerRelocationNotYet(actor, parsed.data.workDate);
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}
