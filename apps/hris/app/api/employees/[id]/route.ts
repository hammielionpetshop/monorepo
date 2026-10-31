import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMutationAction } from '@/lib/authz';
import type { ActionName, ServiceResult } from '@/modules/access';
import {
  CHANGE_KINDS, WORK_STATUSES, cancelPlacement, deactivateEmployee, decidePromotion, loadTarget, reactivateEmployee,
  recordPlacement, setFieldPermit, updatePerson,
} from '@/modules/employees';

export const dynamic = 'force-dynamic';

const reason = z.string().max(500);
const bodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('update'), fields: z.record(z.string(), z.unknown()), reason: reason.nullable().optional() }),
  z.object({
    kind: z.literal('placement'), change: z.enum(CHANGE_KINDS),
    value: z.union([z.number().int().positive(), z.enum(WORK_STATUSES)]), effectiveFrom: z.string().max(10), reason,
  }),
  z.object({ kind: z.literal('cancel_placement'), placementId: z.number().int().positive(), reason }),
  z.object({
    kind: z.literal('deactivate'), lastWorkingDay: z.string().max(10), reasonKind: z.enum(['RESIGNED', 'DISMISSED', 'OTHER']),
    resignationNotice: z.enum(['WITH_NOTICE', 'WITHOUT_NOTICE']).nullable(), note: reason,
  }),
  z.object({ kind: z.literal('reactivate'), startDate: z.string().max(10), note: reason }),
  z.object({ kind: z.literal('permit'), permit: z.enum(['DRIVE', 'ASSIST']), granted: z.boolean(), reason: reason.optional() }),
]);

// Promosi punya dua bentuk isian dengan `kind` yang sama, jadi diperiksa terpisah.
const promotionSchema = z.discriminatedUnion('decision', [
  z.object({ kind: z.literal('promotion'), decision: z.literal('APPROVE') }),
  z.object({ kind: z.literal('promotion'), decision: z.literal('DEFER'), reviewAgainOn: z.string().max(10), reason }),
]);

type Body = z.infer<typeof bodySchema> | z.infer<typeof promotionSchema>;

const ACTION_BY_KIND: Record<string, ActionName> = {
  update: 'employee.update',
  placement: 'placement.record',
  cancel_placement: 'placement.record',
  deactivate: 'employee.activation',
  reactivate: 'employee.activation',
  permit: 'field_permit.update',
  promotion: 'training_promotion.decide',
};

// Mutasi atas satu orang (KAR-L21–L24, L27). Route memeriksa hak atas orang itu; layanan memeriksa lagi
// di dalam transaksi bersama aturan penempatan/status.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  if (!/^\d+$/.test(rawId)) return NextResponse.json({ error: 'Karyawan tidak ditemukan.' }, { status: 404 });
  const id = Number(rawId);
  const raw = await req.json().catch(() => null);
  const parsed = raw?.kind === 'promotion' ? promotionSchema.safeParse(raw) : bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const body: Body = parsed.data;

  const target = await loadTarget(id);
  if (!target) return NextResponse.json({ error: 'Karyawan tidak ditemukan.' }, { status: 404 });
  const guard = await requireMutationAction(req, ACTION_BY_KIND[body.kind], target);
  if (!guard.ok) return guard.response;
  const actor = guard.actor;

  const run = async (): Promise<ServiceResult<object>> => {
    switch (body.kind) {
      case 'update': return updatePerson(actor, id, body.fields, body.reason ?? null);
      case 'placement': return recordPlacement(actor, id, { kind: body.change, value: body.value, effectiveFrom: body.effectiveFrom, reason: body.reason });
      case 'cancel_placement': return cancelPlacement(actor, id, body.placementId, body.reason);
      case 'deactivate': return deactivateEmployee(actor, id, body);
      case 'reactivate': return reactivateEmployee(actor, id, body);
      case 'permit': return setFieldPermit(actor, id, { kind: body.permit, granted: body.granted, reason: body.reason });
      case 'promotion': return decidePromotion(actor, id, body);
    }
  };
  const result = await run();
  return result.ok
    ? NextResponse.json({ ok: true, ...result.data })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
