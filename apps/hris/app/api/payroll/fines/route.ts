import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { announceToOwners } from '@/lib/owner-notify';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import type { ServiceResult } from '@/modules/access';
import { cancelFineKindVersion, endFine, recordFineDirect, saveFineKind } from '@/modules/payroll';
import { REQUEST_TYPES, submitRequest } from '@/modules/requests';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const bodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('fine_record'), employeeId: id, kindId: id, occurredOn: z.string().max(10), tripId: id.nullable(), description: z.string().max(1000),
    photoId: z.string().max(64).nullable(),
  }),
  z.object({ kind: z.literal('fine_end'), id, reason: z.string().max(500) }),
  z.object({
    kind: z.literal('fine_kind_save'), id: id.nullable(), name: z.string().max(100), example: z.string().max(300), amount: z.number().int(), active: z.boolean(),
    effectiveOn: z.string().max(10), reason: z.string().max(500),
  }),
  z.object({ kind: z.literal('fine_kind_cancel'), id }),
]);

function respond<T>(result: ServiceResult<T>) {
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}

// Denda driver & kenek (spec L7 §3.6, L7c). Hak diperiksa di layanan.
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
    case 'fine_record': {
      const fields = { employeeId: body.employeeId, kindId: body.kindId, occurredOn: body.occurredOn, tripId: body.tripId, description: body.description, photoId: body.photoId };
      if (actor?.fullAccess) return respond(await recordFineDirect(actor, fields, announceToOwners));
      const result = await submitRequest(actor, 'driver_fine', REQUEST_HANDLERS.driver_fine, { fields, attachmentIds: body.photoId ? [body.photoId] : [] });
      return result.ok
        ? NextResponse.json({ ...result.data, ok: true, message: REQUEST_TYPES.driver_fine.submittedMessage })
        : NextResponse.json({ error: result.error }, { status: result.status });
    }
    case 'fine_end': return respond(await endFine(actor, body.id, body.reason, announceToOwners));
    case 'fine_kind_save': return respond(await saveFineKind(actor, { ...body, id: body.id ?? undefined }, announceToOwners));
    case 'fine_kind_cancel': return respond(await cancelFineKindVersion(actor, body.id, announceToOwners));
  }
}
