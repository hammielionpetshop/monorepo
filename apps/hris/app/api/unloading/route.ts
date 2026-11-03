import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { announceToOwners } from '@/lib/owner-notify';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import type { ServiceResult } from '@/modules/access';
import {
  answerUnloading, askUnloading, cancelUnloading, cancelUnloadingPayment, changeWeight, correctUnloading, correctionPreview, createUnloading, decideOverpayment,
  linkOtherItem, payUnloading, previewUnloading, receiveOverpaymentRefund, reviewUnloadingDay, reviewWeightChange, unloadingNeedsApproval,
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
  // L8b Bayar Bongkaran (spec L8 §3.4–3.5).
  z.object({
    kind: z.literal('pay'), targets: z.array(z.object({ reportId: id, topUpId: id.nullable() })).min(1).max(50), sourceId: id.nullable(),
    moneyDate: z.string().max(10), dateReason: z.string().max(500).nullable().optional(), proofFileId: z.string().max(64).nullable().optional(),
    handedTo: z.record(z.string().max(30), z.string().regex(/^[EC]\d+$/).nullable()),
  }),
  z.object({ kind: z.literal('ask'), id, question: z.string().max(1000) }),
  z.object({ kind: z.literal('answer'), id, answer: z.string().max(1000) }),
  z.object({ kind: z.literal('correct_preview'), id, report, reason: z.string().max(500).optional(), applyWeights: z.boolean().optional() }),
  z.object({ kind: z.literal('correct'), id, report, reason: z.string().max(500), applyWeights: z.boolean().optional() }),
  z.object({ kind: z.literal('cancel'), id, reason: z.string().max(500) }),
  z.object({ kind: z.literal('cancel_payment'), id, reason: z.string().max(500) }),
  z.object({ kind: z.literal('overpay_decide'), id, decision: z.enum(['COLLECT', 'WRITE_OFF']), reason: z.string().max(500) }),
  z.object({ kind: z.literal('overpay_refund'), id, amount: z.number().int(), sourceId: id, moneyDate: z.string().max(10), dateReason: z.string().max(500).nullable().optional() }),
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
    case 'pay': return respond(await payUnloading(actor, body, announceToOwners));
    case 'ask': return respond(await askUnloading(actor, body.id, body.question));
    case 'answer': return respond(await answerUnloading(actor, body.id, body.answer));
    case 'correct_preview': return respond(await correctionPreview(actor, body.id, { ...body.report, reason: body.reason ?? '', applyWeights: body.applyWeights }));
    case 'correct': return respond(await correctUnloading(actor, body.id, { ...body.report, reason: body.reason, applyWeights: body.applyWeights }, announceToOwners));
    case 'cancel': return respond(await cancelUnloading(actor, body.id, body.reason, announceToOwners));
    case 'cancel_payment': return respond(await cancelUnloadingPayment(actor, body.id, body.reason, announceToOwners));
    case 'overpay_decide': return respond(await decideOverpayment(actor, body.id, body.decision, body.reason));
    case 'overpay_refund': return respond(await receiveOverpaymentRefund(actor, body.id, body));
  }
}
