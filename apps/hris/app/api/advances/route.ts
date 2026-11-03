import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { announceToOwners } from '@/lib/owner-notify';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { cancelAdvance, cancelHandover, handOver } from '@/modules/advances';
import { decideRequest, reviewRequest, submitRequest } from '@/modules/requests';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const reason = z.string().max(500);
const money = z.number().int().min(0).max(1_000_000_000);

const bodySchema = z.discriminatedUnion('kind', [
  // DRV-L24 / L25: ajukan untuk diri sendiri, atau isikan atas nama (employeeId).
  z.object({ kind: z.literal('submit'), employeeId: id.nullable().optional(), amount: money, installments: z.number().int(), reason, resubmittedFromId: id.nullable().optional() }),
  // DRV-L27: Finance memeriksa; Pemilik/GM memutuskan dengan angka akhir.
  z.object({ kind: z.literal('review'), requestId: id, version: id, amount: money, installments: z.number().int(), note: reason.optional() }),
  z.object({ kind: z.literal('approve'), requestId: id, version: id, amount: money, installments: z.number().int(), note: reason.optional() }),
  z.object({ kind: z.literal('reject'), requestId: id, version: id, reason }),
  // DRV-L29 / L30 / L31.
  z.object({
    kind: z.literal('hand_over'), id, sourceId: id, moneyDate: z.string().max(10), dateReason: reason.nullable().optional(),
    viaEmployeeId: id.nullable().optional(), proofFileId: z.string().max(64).nullable().optional(),
  }),
  z.object({ kind: z.literal('cancel'), id, reason }),
  z.object({ kind: z.literal('cancel_hand_over'), id, reason }),
  // Kasbon Saya: Minta dibatalkan (DRV-129), Uang belum saya terima (K5).
  z.object({ kind: z.literal('request_cancel'), id, reason }),
  z.object({ kind: z.literal('not_received'), id, reason }),
]);

// Kasbon (spec L5 §3). Hak diperiksa di layanan per kasbon / per pengajuan.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const body = parsed.data;

  const result = await (async () => {
    switch (body.kind) {
      case 'submit':
        return submitRequest(actor, 'advance', REQUEST_HANDLERS.advance, {
          fields: { employeeId: body.employeeId ?? null, amount: body.amount, installments: body.installments, reason: body.reason },
          attachmentIds: [], resubmittedFromId: body.resubmittedFromId ?? null,
        });
      case 'review':
        return reviewRequest(actor, body.requestId, REQUEST_HANDLERS, {
          expectedVersion: body.version, fields: { amount: body.amount, installments: body.installments, note: body.note },
        });
      case 'approve':
        return decideRequest(actor, body.requestId, REQUEST_HANDLERS, {
          decision: 'APPROVE', expectedVersion: body.version, fields: { amount: body.amount, installments: body.installments, note: body.note },
        });
      case 'reject':
        return decideRequest(actor, body.requestId, REQUEST_HANDLERS, { decision: 'REJECT', expectedVersion: body.version, reason: body.reason });
      case 'hand_over':
        return handOver(actor, body.id, body, announceToOwners);
      case 'cancel':
        return cancelAdvance(actor, body.id, body.reason, announceToOwners);
      case 'cancel_hand_over':
        return cancelHandover(actor, body.id, body.reason, announceToOwners);
      case 'request_cancel':
        return submitRequest(actor, 'advance_cancel', REQUEST_HANDLERS.advance_cancel, { fields: { advanceId: body.id, reason: body.reason }, attachmentIds: [] });
      case 'not_received':
        return submitRequest(actor, 'advance_not_received', REQUEST_HANDLERS.advance_not_received, { fields: { advanceId: body.id, reason: body.reason }, attachmentIds: [] });
    }
  })();
  return result.ok ? NextResponse.json(result.data) : NextResponse.json({ error: result.error }, { status: result.status });
}
