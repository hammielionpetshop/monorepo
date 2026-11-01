import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { loadActor, type ServiceResult } from '@/modules/access';
import {
  addClosure, assignShift, cancelClosure, cancelShiftVersion, changeDayShift, regenerateQr, saveInitialGroups, saveShiftVersion, setShiftActive,
} from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const date = z.string().max(10);
const time = z.string().max(5);
const reason = z.string().max(500);

const bodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('shift_version'), branchId: id, shiftId: id.optional(), name: z.string().max(100).optional(),
    startTime: time, endTime: time, breakMinutes: z.number().int().nullable(), breakStartFrom: time.nullable(), breakStartUntil: time.nullable(),
    effectiveFrom: date, effectiveUntil: date.nullable(), reason,
  }),
  z.object({ kind: z.literal('shift_version_cancel'), id, reason }),
  z.object({ kind: z.literal('shift_active'), shiftId: id, active: z.boolean(), reason }),
  z.object({ kind: z.literal('initial_groups'), branchId: id, first: z.array(id).max(200), second: z.array(id).max(200) }),
  z.object({ kind: z.literal('assign'), employeeId: id, shiftId: id, week: date }),
  z.object({ kind: z.literal('day_change'), employeeId: id, date, shiftId: id, reason }),
  z.object({ kind: z.literal('qr'), branchId: id }),
  z.object({ kind: z.literal('closure'), branchId: id.nullable(), startDate: date, endDate: date, reason }),
  z.object({ kind: z.literal('closure_cancel'), id, reason }),
]);

function respond<T>(result: ServiceResult<T>) {
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}

// Mutasi Jam Kerja & Jadwal. Hak diperiksa per tindakan dan per orang di layanan.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await loadActor(session.accountId, session.localUserId);
  const body = parsed.data;
  switch (body.kind) {
    case 'shift_version': return respond(await saveShiftVersion(actor, body));
    case 'shift_version_cancel': return respond(await cancelShiftVersion(actor, body.id, body.reason));
    case 'shift_active': return respond(await setShiftActive(actor, body.shiftId, body.active, body.reason));
    case 'initial_groups': return respond(await saveInitialGroups(actor, body.branchId, [body.first, body.second]));
    case 'assign': return respond(await assignShift(actor, body.employeeId, body.shiftId, body.week));
    case 'day_change': return respond(await changeDayShift(actor, body.employeeId, body.date, body.shiftId, body.reason));
    case 'qr': return respond(await regenerateQr(actor, body.branchId));
    case 'closure': return respond(await addClosure(actor, body));
    case 'closure_cancel': return respond(await cancelClosure(actor, body.id, body.reason));
  }
}
