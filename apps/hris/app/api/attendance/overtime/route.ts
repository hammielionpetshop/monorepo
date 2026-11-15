import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { answerOvertime } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ id: z.number().int().positive(), choice: z.enum(['LATER', 'NOT_OVERTIME']) });

// Jawaban "Ini lembur?" (spec L3h, KEH-160). Klaim dikirim lewat /api/requests.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const result = await answerOvertime(actor, parsed.data);
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}
