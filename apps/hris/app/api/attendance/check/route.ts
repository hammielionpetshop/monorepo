import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { loadActor, type ServiceResult } from '@/modules/access';
import { checkLocation, reportWrongScan, scanQr, startBreak } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const code = z.string().min(1).max(200);
const kind = z.enum(['IN', 'RETURN', 'OUT']);
const point = { latitude: z.number().nullable(), longitude: z.number().nullable(), accuracy: z.number().nullable() };

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('scan'), code, kind }),
  z.object({ action: z.literal('wrong_scan'), code }),
  z.object({ action: z.literal('locate'), code, kind, assist: z.boolean(), shiftId: z.number().int().positive().nullable(), ...point }),
  z.object({ action: z.literal('break'), ...point }),
]);

function respond<T>(result: ServiceResult<T>) {
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}

// Langkah absen di server (spec L3b §3). Jam selalu jam server; tidak ada jam dari HP.
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
    case 'scan': return respond(await scanQr(actor, body));
    case 'wrong_scan': return respond(await reportWrongScan(actor, body.code));
    case 'locate': return respond(await checkLocation(actor, body));
    case 'break': return respond(await startBreak(actor, body));
  }
}
