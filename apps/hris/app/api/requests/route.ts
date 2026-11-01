import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { loadActor } from '@/modules/access';
import { cancelRequest, decideRequest, isRequestTypeKey, submitRequest } from '@/modules/requests';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('submit'),
    typeKey: z.string().min(1).max(50),
    fields: z.record(z.string(), z.unknown()),
    attachmentIds: z.array(z.string().max(40)).max(5),
    resubmittedFromId: z.number().int().positive().nullable().optional(),
  }),
  z.object({ kind: z.literal('cancel'), id: z.number().int().positive(), version: z.number().int().positive(), reason: z.string().max(500) }),
  z.object({
    kind: z.literal('decide'),
    id: z.number().int().positive(),
    version: z.number().int().positive(),
    decision: z.enum(['APPROVE', 'REJECT']),
    reason: z.string().max(500).optional(),
  }),
]);

// Mesin Pengajuan (spec L2f-1 §3.2): ajukan, batalkan, putuskan. Hak diperiksa per pengajuan di layanan.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await loadActor(session.accountId, session.localUserId);
  const body = parsed.data;

  if (body.kind === 'submit') {
    if (!isRequestTypeKey(body.typeKey)) return NextResponse.json({ error: 'Jenis pengajuan tidak dikenal.' }, { status: 400 });
    const result = await submitRequest(actor, body.typeKey, REQUEST_HANDLERS[body.typeKey], {
      fields: body.fields, attachmentIds: body.attachmentIds, resubmittedFromId: body.resubmittedFromId ?? null,
    });
    return result.ok ? NextResponse.json(result.data) : NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (body.kind === 'cancel') {
    const result = await cancelRequest(actor, body.id, body.version, body.reason, REQUEST_HANDLERS);
    return result.ok
      ? NextResponse.json({ id: body.id, message: 'Pengajuan dibatalkan.' })
      : NextResponse.json({ error: result.error }, { status: result.status });
  }
  const result = await decideRequest(actor, body.id, REQUEST_HANDLERS, {
    decision: body.decision, expectedVersion: body.version, reason: body.reason,
  });
  return result.ok ? NextResponse.json(result.data) : NextResponse.json({ error: result.error }, { status: result.status });
}
