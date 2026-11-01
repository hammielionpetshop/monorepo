import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { loadActor, type ServiceResult } from '@/modules/access';
import {
  answerSwap, cancelSwap, cancelWorkRequest, changeDayOff, chooseReplacement, createWorkRequest, readyToWork, revokeDayOff, saveMyDaysOff,
  sendSwap, swapOptions,
} from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const date = z.string().max(10);
const reason = z.string().max(500);
const kind = z.enum(['DAY_OFF', 'SHIFT']);

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), periodStart: date, dates: z.array(date).max(20) }),
  z.object({ action: z.literal('replacement'), id, date }),
  z.object({ action: z.literal('change'), pickId: id, date, reason }),
  z.object({ action: z.literal('revoke'), pickId: id, reason }),
  z.object({ action: z.literal('swap_options'), kind, date }),
  z.object({ action: z.literal('swap_send'), kind, date, friendId: id, friendDate: date }),
  z.object({ action: z.literal('swap_answer'), id, accept: z.boolean() }),
  z.object({ action: z.literal('swap_cancel'), id }),
  z.object({ action: z.literal('work_request'), pickId: id, reason }),
  z.object({ action: z.literal('work_cancel'), id, reason }),
  z.object({ action: z.literal('work_ready'), id }),
]);

function respond<T>(result: ServiceResult<T>) {
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}

// Libur dan Tukar (spec L3e). Semua aturan dan hak diperiksa di layanan.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await loadActor(session.accountId, session.localUserId);
  const body = parsed.data;
  switch (body.action) {
    case 'save': return respond(await saveMyDaysOff(actor, body));
    case 'replacement': return respond(await chooseReplacement(actor, body));
    case 'change': return respond(await changeDayOff(actor, body));
    case 'revoke': return respond(await revokeDayOff(actor, body));
    case 'swap_options': return respond(await swapOptions(actor, body));
    case 'swap_send': return respond(await sendSwap(actor, body));
    case 'swap_answer': return respond(await answerSwap(actor, body));
    case 'swap_cancel': return respond(await cancelSwap(actor, body.id));
    case 'work_request': return respond(await createWorkRequest(actor, body));
    case 'work_cancel': return respond(await cancelWorkRequest(actor, body));
    case 'work_ready': return respond(await readyToWork(actor, body.id));
  }
}
