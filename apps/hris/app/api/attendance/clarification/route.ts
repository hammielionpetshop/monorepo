import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { loadActor } from '@/modules/access';
import { markStreakSeen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  action: z.literal('streak_seen'), flagId: z.number().int().positive(), seen: z.boolean(), note: z.string().max(500),
});

// Perlu Dijelaskan (spec L3g): tandai tidak masuk berturut-turut sudah dilihat. Penjelasan dikirim lewat /api/requests.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const actor = await loadActor(session.accountId, session.localUserId);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const result = await markStreakSeen(actor, parsed.data);
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}
