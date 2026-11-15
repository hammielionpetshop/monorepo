import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import {
  addCrew, addManualWage, closePending, decideVisitReport, markDecisionRecorded, addShopping, cancelTrip, cancelWage, closeCondition, createTrip, decideNote, dropShopping, keepKasirChange, markReady, releaseVisit,
  removeCrew, reopenNote, retryVisit, reviewOutside, saveRoute, saveVehicle, setFleetActive, setGarageBranch, turnFenceOff, turnFenceOn, unmarkReady, updateDraft,
  assignReturnPickup, cancelReturnPickup, createReturnPickup, releaseReturnPickup,
  checkDeposit, recordDepositUse, refundDeposit, applyDeposit, voidDeposit,
} from '@/modules/logistics';
import { valueTripWagesAfter } from '@/lib/trip-wage-sync';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const reason = z.string().max(500);
const tripBody = {
  vehicleId: id, routeId: id.nullable(), shoppingRouteIds: z.array(id).max(20), driverId: id, assistantIds: z.array(id).max(10),
  noteKeys: z.array(z.string().max(12)).max(200).optional(),
  pickupIds: z.array(id).max(50).optional(),
};

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), ...tripBody }),
  z.object({ action: z.literal('update'), tripId: id, ...tripBody }),
  z.object({ action: z.literal('cancel'), tripId: id, reason }),
  z.object({ action: z.literal('add_crew'), tripId: id, employeeId: id, role: z.enum(['DRIVER', 'ASSISTANT']) }),
  z.object({ action: z.literal('remove_crew'), tripId: id, crewId: id, reason }),
  z.object({ action: z.literal('add_shopping'), tripId: id, routeId: id }),
  z.object({ action: z.literal('drop_shopping'), tripId: id, shoppingId: id, reason }),
  z.object({ action: z.literal('release_visit'), tripId: id, visitId: id, reason }),
  // LT1b-2a (spec LT1 §13.3): Siap Kirim, Coba lagi, Perlu keputusan, tindak lanjut Laporan Pulang. Sampai Garasi pindah ke /upload (foto amper).
  z.object({ action: z.literal('ready'), tripId: id }),
  z.object({ action: z.literal('unready'), tripId: id }),
  // LT2c (spec LT1 §14.3): Tetap antar nota yang berubah di kasir sesudah masuk trip.
  z.object({ action: z.literal('keep_kasir_change'), tripId: id, noteId: id }),
  z.object({ action: z.literal('retry_visit'), tripId: id, visitId: id }),
  z.object({ action: z.literal('decide_note'), noteId: id, decision: z.enum(['RESEND', 'DROP']), reason }),
  z.object({ action: z.literal('reopen_note'), noteId: id }),
  // LT5a (spec LT1 §17.1 butir 9): tinjau kiriman di luar titik toko.
  z.object({ action: z.literal('review_outside'), kind: z.enum(['TRUCK', 'SELF']), targetId: id, verdict: z.enum(['OK', 'NOT_OK']), reason: reason.nullable().optional() }),
  z.object({ action: z.literal('close_condition'), reportId: id, note: z.string().max(300).nullable().optional() }),
  // LT2b (spec LT1 §14.2): keputusan potong nota atas laporan toko, lalu Sudah dicatat di kasir.
  z.object({
    action: z.literal('decide_visit_report'), reportId: id, decision: z.enum(['CUT', 'RETURN_BO', 'NO_CUT']), noteId: id.nullable().optional(),
    amount: z.number().int().nullable().optional(), reason: z.string().max(20).nullable().optional(), note: z.string().max(500).nullable().optional(),
    changeReason: z.string().max(500).nullable().optional(),
  }),
  z.object({ action: z.literal('record_decision'), decisionId: id, ref: z.string().max(200) }),
  // LT2a (spec LT1 §14.1 butir 3): tutup tertunda dengan keterangan.
  z.object({ action: z.literal('close_pending'), noteId: id, reason }),
  z.object({ action: z.literal('cancel_wage'), wageId: id, reason }),
  z.object({
    action: z.literal('manual_wage'), employeeId: id, tripDate: z.string().max(10), vehicleId: id, routeId: id, role: z.enum(['DRIVER', 'ASSISTANT']),
    withAssistant: z.boolean(), reason, confirmTwice: z.boolean(),
  }),
  z.object({ action: z.literal('save_vehicle'), id: id.nullable().optional(), name: z.string().max(100), plate: z.string().max(40) }),
  z.object({ action: z.literal('save_route'), id: id.nullable().optional(), name: z.string().max(100), kind: z.enum(['DELIVERY', 'SHOPPING']) }),
  z.object({ action: z.literal('set_active'), target: z.enum(['vehicle', 'route']), id, active: z.boolean() }),
  z.object({ action: z.literal('set_garage'), branchId: id }),
  z.object({ action: z.literal('fence_off'), hours: z.number().int(), reason }),
  z.object({ action: z.literal('fence_on') }),
  // A2: tugas jemput retur.
  z.object({
    action: z.literal('create_return_pickup'), customerId: id, ownerBranchId: id.nullable().optional(), reason: z.string().max(500),
    estimate: z.string().max(500).nullable().optional(),
  }),
  z.object({ action: z.literal('cancel_return_pickup'), id, reason }),
  z.object({ action: z.literal('assign_return_pickup'), id, tripId: id }),
  z.object({ action: z.literal('release_return_pickup'), id, reason }),
  // A1: titipan toko.
  z.object({ action: z.literal('check_deposit'), id, actual: z.number().int().min(0).max(1_000_000_000), note: z.string().max(500).nullable().optional() }),
  z.object({ action: z.literal('use_deposit'), customerId: id, transactionId: id, amount: z.number().int() }),
  z.object({ action: z.literal('refund_deposit'), customerId: id, amount: z.number().int(), reason }),
  z.object({ action: z.literal('void_deposit'), id, reason }),
  z.object({ action: z.literal('record_deposit_use'), id, ref: z.string().max(200) }),
]);

// Logistik Minimal (spec L6 §3). Hak diperiksa di layanan per tindakan; aksi berfoto lewat /api/logistics/upload.
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
    switch (body.action) {
      case 'create': return createTrip(actor, body);
      case 'update': return updateDraft(actor, body.tripId, body);
      case 'cancel': return cancelTrip(actor, body.tripId, body.reason);
      case 'add_crew': return addCrew(actor, body.tripId, body.employeeId, body.role);
      case 'remove_crew': return removeCrew(actor, body.tripId, body.crewId, body.reason);
      case 'add_shopping': return addShopping(actor, body.tripId, body.routeId);
      case 'drop_shopping': return dropShopping(actor, body.tripId, body.shoppingId, body.reason);
      case 'release_visit': return releaseVisit(actor, body.tripId, body.visitId, body.reason);
      case 'ready': return markReady(actor, body.tripId);
      case 'unready': return unmarkReady(actor, body.tripId);
      case 'keep_kasir_change': return keepKasirChange(actor, body.tripId, body.noteId);
      case 'retry_visit': return retryVisit(actor, body.tripId, body.visitId);
      case 'decide_note': return decideNote(actor, body.noteId, body.decision, body.reason);
      case 'reopen_note': return reopenNote(actor, body.noteId);
      case 'review_outside': return reviewOutside(actor, body.kind, body.targetId, body.verdict, body.reason ?? null);
      case 'close_condition': return closeCondition(actor, body.reportId, body.note ?? null);
      case 'decide_visit_report': return decideVisitReport(actor, body.reportId, body);
      case 'record_decision': return markDecisionRecorded(actor, body.decisionId, body.ref);
      case 'close_pending': return closePending(actor, body.noteId, body.reason);
      case 'cancel_wage': return cancelWage(actor, body.wageId, body.reason);
      case 'manual_wage': return addManualWage(actor, body);
      case 'save_vehicle': return saveVehicle(actor, body);
      case 'save_route': return saveRoute(actor, body);
      case 'set_active': return setFleetActive(actor, body.target, body.id, body.active);
      case 'set_garage': return setGarageBranch(actor, body.branchId);
      case 'fence_off': return turnFenceOff(actor, body.hours, body.reason);
      case 'fence_on': return turnFenceOn(actor);
      case 'create_return_pickup': return createReturnPickup(actor, body);
      case 'cancel_return_pickup': return cancelReturnPickup(actor, body.id, body.reason);
      case 'assign_return_pickup': return assignReturnPickup(actor, body.id, body.tripId);
      case 'release_return_pickup': return releaseReturnPickup(actor, body.id, body.reason);
      case 'check_deposit': return checkDeposit(actor, body.id, body);
      case 'use_deposit': return applyDeposit(actor, body);
      case 'refund_deposit': return refundDeposit(actor, body);
      case 'void_deposit': return voidDeposit(actor, body.id, body.reason);
      case 'record_deposit_use': return recordDepositUse(actor, body.id, body.ref);
    }
  })();
  if (result.ok && actor) {
    // Upah ritase dinilai sesudah ritase tangan atau batal ritase (spec L7 §3.2, §3.3); trip Selesai lewat /upload.
    if (body.action === 'cancel_wage') await valueTripWagesAfter({ ids: [body.wageId] }, actor.accountId);
    if (body.action === 'manual_wage' && result.data && 'id' in result.data) await valueTripWagesAfter({ ids: [result.data.id] }, actor.accountId);
  }
  return result.ok ? NextResponse.json({ ok: true, ...(result.data ?? {}) }) : NextResponse.json({ error: result.error }, { status: result.status });
}
