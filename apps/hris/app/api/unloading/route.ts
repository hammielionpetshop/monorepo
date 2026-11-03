import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { announceToOwners } from '@/lib/owner-notify';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import type { ServiceResult } from '@/modules/access';
import {
  changeWeight, createUnloading, linkOtherItem, previewUnloading, reviewUnloadingDay, reviewWeightChange, unloadingNeedsApproval,
} from '@/modules/payroll';
import { REQUEST_TYPES, submitRequest } from '@/modules/requests';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const decimal = z.union([z.string().max(20), z.number()]);
const item = z.union([
  z.object({ productId: id, uomId: id, quantity: decimal, weightKg: decimal.nullable().optional(), weightReason: z.string().max(500).nullable().optional() }),
  z.object({ productId: z.null(), name: z.string().max(200), kg: decimal, reason: z.string().max(500) }),
]);
const report = z.object({
  workDate: z.string().max(10), supplierId: id, lateReason: z.string().max(500).nullable().optional(), similarConfirmedId: id.nullable().optional(),
  items: z.array(item).min(1).max(80), participants: z.array(z.string().regex(/^[EC]\d+$/)).min(1).max(60),
  photoIds: z.array(z.string().max(64)).max(5), noDeliveryNoteReason: z.string().max(500).nullable().optional(),
});
const bodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('preview'), report }),
  z.object({ kind: z.literal('create'), report }),
  z.object({ kind: z.literal('weight_change'), productId: id, uomId: id, weightKg: decimal, reason: z.string().max(500) }),
  z.object({ kind: z.literal('weight_review'), id, note: z.string().max(500).nullable() }),
  z.object({ kind: z.literal('other_link'), itemId: id, productId: id.nullable() }),
  z.object({ kind: z.literal('look_review'), id, note: z.string().max(500).nullable() }),
]);

function respond<T>(result: ServiceResult<T>) {
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}

// Laporan Bongkaran (spec L8 §3.2–3.3, L8a). Hak diperiksa di layanan.
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
    case 'preview': return respond(await previewUnloading(actor, body.report));
    case 'create': {
      if (await unloadingNeedsApproval(actor, body.report.workDate)) {
        const result = await submitRequest(actor, 'unloading_late', REQUEST_HANDLERS.unloading_late, { fields: body.report, attachmentIds: [] });
        return result.ok
          ? NextResponse.json({ ...result.data, ok: true, late: true, message: REQUEST_TYPES.unloading_late.submittedMessage })
          : NextResponse.json({ error: result.error }, { status: result.status });
      }
      return respond(await createUnloading(actor, body.report, announceToOwners));
    }
    case 'weight_change': return respond(await changeWeight(actor, body, announceToOwners));
    case 'weight_review': return respond(await reviewWeightChange(actor, body.id, body.note));
    case 'other_link': return respond(await linkOtherItem(actor, body.itemId, body.productId));
    case 'look_review': return respond(await reviewUnloadingDay(actor, body.id, body.note));
  }
}
