import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { loadActor, type ServiceResult } from '@/modules/access';
import { decideReview, markPatternSeen, reverseCorrection, saveCorrections } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const text = z.string().max(500);
const local = z.string().max(16);

const bodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('decide'), recordId: id, outcome: z.enum(['FINE', 'NEEDS_CORRECTION']), reason: text, baseReviewId: id.nullable() }),
  z.object({ kind: z.literal('pattern_seen'), flagId: id, note: text }),
  z.object({
    kind: z.literal('correct'), workDate: z.string().max(10), batchBranchId: id.nullable(),
    reasonCode: z.enum(['DEVICE', 'MOVED', 'WRONG_RECORD', 'OTHER']), note: text,
    items: z.array(z.object({
      employeeId: id, branchId: id, shiftId: id.nullable(), inAt: local, outAt: local.nullable(), baseCorrectionId: id.nullable(),
    })).min(1).max(200),
  }),
  z.object({ kind: z.literal('reverse'), correctionId: id, reason: text }),
]);

function respond<T>(result: ServiceResult<T>) {
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}

// Mutasi Tinjau dan Koreksi Absen (spec L3c). Hak diperiksa per orang di layanan; absen sendiri ditolak server (KEH-117).
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
    case 'decide': return respond(await decideReview(actor, body));
    case 'pattern_seen': return respond(await markPatternSeen(actor, body));
    case 'correct': return respond(await saveCorrections(actor, body));
    case 'reverse': return respond(await reverseCorrection(actor, body));
  }
}
