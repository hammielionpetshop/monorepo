import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import type { ServiceResult } from '@/modules/access';
import { moveReportGuide, saveReportGuide, setReportGuideActive } from '@/modules/guides';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const bodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('save'), id: id.nullable(), requestType: z.string().max(64).nullable(), caseLabel: z.string().max(200).nullable(),
    reportTo: z.string().max(1000),
  }),
  z.object({ kind: z.literal('active'), id, active: z.boolean() }),
  z.object({ kind: z.literal('move'), id, direction: z.enum(['up', 'down']) }),
]);

function respond<T>(result: ServiceResult<T>) {
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}

// Ubah Pedoman Lapor (spec F3-5 §2.2). Hak diperiksa di layanan (report_guide.manage, Pemilik/GM).
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const body = parsed.data;
  switch (body.kind) {
    case 'save': return respond(await saveReportGuide(actor, body.id, { requestType: body.requestType, caseLabel: body.caseLabel, reportTo: body.reportTo }));
    case 'active': return respond(await setReportGuideActive(actor, body.id, body.active));
    case 'move': return respond(await moveReportGuide(actor, body.id, body.direction));
  }
}
