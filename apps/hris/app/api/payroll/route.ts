import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { announceToOwners } from '@/lib/owner-notify';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { hasAction, loadActor, type ServiceResult } from '@/modules/access';
import {
  cancelSalaryChange, cancelWaiver, changeSalary, savePayRules, saveComponentType, saveStandard, setComponentTypeActive, waiveDeduction, PAY_RULE_KEYS,
} from '@/modules/payroll';
import {
  approveApproval, cancelLoss, cancelManual, linkPosUser, manualCandidates, previewLoss, proposeNow, recordLossDirect, recordManualDirect, reviewApproval,
  saveOfficePercent, unlinkPosUser,
} from '@/modules/payroll';
import { cancelOther, recordOtherDirect, rescheduleOther, saveDeductionType } from '@/modules/payroll';
import { approveGrooming, decidePosChange, linkGroomer, rejectOrCancelBonus, saveBonusPercents, syncNow, unlinkGroomer, BONUS_PERCENT_KEYS } from '@/modules/payroll';
import { changeFund, recordFreeDirect, saveBonusType } from '@/modules/payroll';
import { cancelSetting, loadRows } from '@/modules/settings';
import { db } from '@/lib/db';
import { REQUEST_TYPES, submitRequest } from '@/modules/requests';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const lines = z.array(z.object({ componentTypeId: id, amount: z.number().int() })).max(30);
const reason = z.string().max(500);

const bodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('change'), employeeId: id, effectiveFrom: z.string().max(10), lines, reason }),
  z.object({ kind: z.literal('cancel_change'), id, reason }),
  z.object({ kind: z.literal('component_save'), id: id.optional(), name: z.string().max(100), sortOrder: z.number().int() }),
  z.object({ kind: z.literal('component_active'), id, active: z.boolean() }),
  z.object({ kind: z.literal('standard_save'), standardKind: z.enum(['TRAINING', 'EMPLOYEE']), effectiveFrom: z.string().max(10), lines, reason }),
  z.object({ kind: z.literal('waive'), employeeId: id, waiverKind: z.enum(['LATE', 'FINE']), fineKind: z.string().max(20).nullable(), workDate: z.string().max(10), reason }),
  z.object({ kind: z.literal('waive_cancel'), id, reason }),
  z.object({ kind: z.literal('pay_rules_save'), values: z.record(z.string(), z.unknown()), effectiveFrom: z.string().max(10), reason }),
  z.object({ kind: z.literal('pay_rule_cancel'), id, reason }),
  // L4c-1: kehilangan barang, minus kas, tautan akun kasir, persen kantor (spec L4c).
  z.object({ kind: z.literal('loss_record'), branchId: id, foundOn: z.string().max(10), amount: z.number().int(), description: z.string().max(500), attachmentId: z.string().max(64) }),
  z.object({ kind: z.literal('loss_preview'), branchId: id, foundOn: z.string().max(10), amount: z.number().int() }),
  z.object({ kind: z.literal('loss_cancel'), id, reason }),
  z.object({ kind: z.literal('office_percent_save'), branchId: id, value: z.number().int(), effectiveFrom: z.string().max(10), reason, expectedLatestId: id.nullable(), firstFill: z.boolean() }),
  z.object({ kind: z.literal('shortage_review'), id }),
  z.object({ kind: z.literal('shortage_approve'), id, waivers: z.array(z.object({ rowId: id, reason })).max(200) }),
  z.object({ kind: z.literal('shortage_propose_now'), employeeId: id }),
  z.object({ kind: z.literal('cashier_link'), posUserId: id, employeeId: id }),
  z.object({ kind: z.literal('cashier_unlink'), posUserId: id, reason }),
  z.object({ kind: z.literal('manual_record'), branchId: id, occurredOn: z.string().max(10), amount: z.number().int(), reason, namedEmployeeId: id.nullable(), attachmentId: z.string().max(64).nullable() }),
  z.object({ kind: z.literal('manual_candidates'), branchId: id, occurredOn: z.string().max(10) }),
  z.object({ kind: z.literal('manual_cancel'), id, reason }),
  // L4c-2: Potongan Lain, Jenis Potongan Lain, Keberatan Potongan (spec L4c §3.5, §3.6).
  z.object({ kind: z.literal('other_record'), employeeId: id, typeId: id, amount: z.number().int(), reason, installments: z.number().int(), attachmentId: z.string().max(64).nullable() }),
  z.object({ kind: z.literal('other_cancel'), id, reason }),
  z.object({ kind: z.literal('other_reschedule'), id, installments: z.number().int(), reason }),
  z.object({ kind: z.literal('other_type_save'), id: id.optional(), name: z.string().max(100), active: z.boolean().optional() }),
  // L4d-1: Buku Bonus grooming dan ongkir (spec L4d).
  z.object({ kind: z.literal('bonus_approve'), ids: z.array(id).min(1).max(500) }),
  z.object({ kind: z.literal('bonus_reject'), id, reason }),
  z.object({ kind: z.literal('bonus_change_decide'), id, accept: z.boolean(), reason }),
  z.object({ kind: z.literal('bonus_sync') }),
  z.object({ kind: z.literal('groomer_link'), posGroomerId: id, employeeId: id.nullable(), notEmployee: z.boolean(), note: z.string().max(500).nullable() }),
  z.object({ kind: z.literal('groomer_unlink'), posGroomerId: id, reason }),
  z.object({ kind: z.literal('bonus_percent_save'), values: z.record(z.string(), z.unknown()), effectiveFrom: z.string().max(10), reason }),
  z.object({ kind: z.literal('bonus_percent_cancel'), id, reason }),
  // L4d-2: Bonus Bebas, jenis ketik, Dana Disiplin & Dana Tidak Hadir (spec L4d).
  z.object({ kind: z.literal('free_record'), employeeId: id, typeId: id, amount: z.number().int(), occurredOn: z.string().max(10), fund: z.enum(['OFFICE', 'DISCIPLINE_FUND']), reason }),
  z.object({ kind: z.literal('bonus_type_save'), id: id.optional(), name: z.string().max(100), defaultFund: z.enum(['OFFICE', 'DISCIPLINE_FUND']), active: z.boolean().optional() }),
  z.object({ kind: z.literal('fund_change'), change: z.enum(['OPENING', 'ADJUSTMENT', 'TRANSFER']), fund: z.enum(['DISCIPLINE', 'ABSENCE']).nullable(), amount: z.number().int(), reason }),
  z.object({ kind: z.literal('objection_submit'), target: z.enum(['CASH_SHORTAGE', 'MANUAL_CASH_SHORTAGE', 'OTHER_DEDUCTION']), targetId: id, reason, attachmentId: z.string().max(64).nullable() }),
]);

async function submit(actor: Awaited<ReturnType<typeof loadActor>>, typeKey: 'inventory_loss' | 'manual_cash_shortage' | 'other_deduction' | 'deduction_objection' | 'free_bonus', fields: Record<string, unknown>, attachmentIds: string[]) {
  const result = await submitRequest(actor, typeKey, REQUEST_HANDLERS[typeKey], { fields, attachmentIds });
  return result.ok
    ? NextResponse.json({ ...result.data, ok: true, message: REQUEST_TYPES[typeKey].submittedMessage })
    : NextResponse.json({ error: result.error }, { status: result.status });
}

function respond<T>(result: ServiceResult<T>) {
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}

// Mutasi Gaji (spec L4a). Hak dan pagar "gaji hanya terlihat Pemilik dan GM" diperiksa di layanan.
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
    case 'change': {
      const input = { employeeId: body.employeeId, effectiveFrom: body.effectiveFrom, lines: body.lines, reason: body.reason };
      // Pemilik/GM mengubah langsung; HR mengusulkan lewat Mesin Pengajuan (GAJ-62).
      if (hasAction(actor, 'salary.change')) return respond(await changeSalary(actor, input, announceToOwners));
      const result = await submitRequest(actor, 'salary_change', REQUEST_HANDLERS.salary_change, { fields: input, attachmentIds: [] });
      return result.ok
        ? NextResponse.json({ ...result.data, ok: true, message: REQUEST_TYPES.salary_change.submittedMessage })
        : NextResponse.json({ error: result.error }, { status: result.status });
    }
    case 'cancel_change': return respond(await cancelSalaryChange(actor, body.id, body.reason, announceToOwners));
    case 'component_save': return respond(await saveComponentType(actor, body));
    case 'component_active': return respond(await setComponentTypeActive(actor, body.id, body.active));
    case 'standard_save': return respond(await saveStandard(actor, { kind: body.standardKind, effectiveFrom: body.effectiveFrom, lines: body.lines, reason: body.reason }));
    // L4b: Tiadakan Potongan dan Potongan & Lembur (spec L4b §3.1, §3.4).
    case 'waive': return respond(await waiveDeduction(actor, { employeeId: body.employeeId, kind: body.waiverKind, fineKind: body.fineKind, workDate: body.workDate, reason: body.reason }, announceToOwners));
    case 'waive_cancel': return respond(await cancelWaiver(actor, body.id, body.reason, announceToOwners));
    case 'pay_rules_save': return respond(await savePayRules(actor, body, announceToOwners));
    case 'pay_rule_cancel': {
      // Hanya angka milik layar Potongan & Lembur yang boleh dibatalkan lewat pintu ini.
      const rows = await loadRows(db, PAY_RULE_KEYS);
      if (!rows.some((row) => row.id === body.id)) return NextResponse.json({ error: 'Angka terjadwal tidak ditemukan.' }, { status: 404 });
      return respond(await cancelSetting(actor, body.id, body.reason, announceToOwners));
    }
    case 'loss_record': {
      const fields = { branchId: body.branchId, foundOn: body.foundOn, amount: body.amount, description: body.description, attachmentId: body.attachmentId };
      // Pemilik/GM mencatat langsung; HR mengusulkan lewat Mesin Pengajuan (GAJ-76).
      if (actor?.fullAccess) return respond(await recordLossDirect(actor, fields, announceToOwners));
      return submit(actor, 'inventory_loss', fields, [body.attachmentId]);
    }
    case 'loss_preview': return respond(await previewLoss(actor, body));
    case 'loss_cancel': return respond(await cancelLoss(actor, body.id, body.reason, announceToOwners));
    case 'office_percent_save': return respond(await saveOfficePercent(actor, body, announceToOwners));
    case 'shortage_review': return respond(await reviewApproval(actor, body.id, announceToOwners));
    case 'shortage_approve': return respond(await approveApproval(actor, body.id, body.waivers, announceToOwners));
    case 'shortage_propose_now': return respond(await proposeNow(actor, body.employeeId));
    case 'cashier_link': return respond(await linkPosUser(actor, body.posUserId, body.employeeId));
    case 'cashier_unlink': return respond(await unlinkPosUser(actor, body.posUserId, body.reason));
    case 'manual_record': {
      const fields = { branchId: body.branchId, occurredOn: body.occurredOn, amount: body.amount, reason: body.reason, namedEmployeeId: body.namedEmployeeId, attachmentId: body.attachmentId };
      if (actor?.fullAccess) return respond(await recordManualDirect(actor, fields, announceToOwners));
      return submit(actor, 'manual_cash_shortage', fields, body.attachmentId ? [body.attachmentId] : []);
    }
    case 'manual_candidates': return respond(await manualCandidates(actor, body.branchId, body.occurredOn));
    case 'manual_cancel': return respond(await cancelManual(actor, body.id, body.reason, announceToOwners));
    case 'other_record': {
      const fields = { employeeId: body.employeeId, typeId: body.typeId, amount: body.amount, reason: body.reason, installments: body.installments, attachmentId: body.attachmentId };
      if (actor?.fullAccess) return respond(await recordOtherDirect(actor, fields, announceToOwners));
      return submit(actor, 'other_deduction', fields, body.attachmentId ? [body.attachmentId] : []);
    }
    case 'other_cancel': return respond(await cancelOther(actor, body.id, body.reason, announceToOwners));
    case 'other_reschedule': return respond(await rescheduleOther(actor, body.id, body, announceToOwners));
    case 'other_type_save': return respond(await saveDeductionType(actor, body));
    case 'bonus_approve': return respond(await approveGrooming(actor, body.ids, announceToOwners));
    case 'bonus_reject': return respond(await rejectOrCancelBonus(actor, body.id, body.reason, announceToOwners));
    case 'bonus_change_decide': return respond(await decidePosChange(actor, body.id, body.accept, body.reason, announceToOwners));
    case 'bonus_sync': return respond(await syncNow(actor));
    case 'groomer_link': return respond(await linkGroomer(actor, body, announceToOwners));
    case 'groomer_unlink': return respond(await unlinkGroomer(actor, body.posGroomerId, body.reason, announceToOwners));
    case 'bonus_percent_save': return respond(await saveBonusPercents(actor, body, announceToOwners));
    case 'bonus_percent_cancel': {
      // Hanya persen milik layar Jenis Bonus yang boleh dibatalkan lewat pintu ini.
      const rows = await loadRows(db, [...BONUS_PERCENT_KEYS]);
      if (!rows.some((row) => row.id === body.id)) return NextResponse.json({ error: 'Angka terjadwal tidak ditemukan.' }, { status: 404 });
      return respond(await cancelSetting(actor, body.id, body.reason, announceToOwners));
    }
    case 'free_record': {
      const fields = { employeeId: body.employeeId, typeId: body.typeId, amount: body.amount, occurredOn: body.occurredOn, fund: body.fund, reason: body.reason };
      // Pemilik/GM mencatat langsung Disahkan; HR mengusulkan lewat Mesin Pengajuan (spec L4d §3.1).
      if (actor?.fullAccess) return respond(await recordFreeDirect(actor, fields, announceToOwners));
      return submit(actor, 'free_bonus', fields, []);
    }
    case 'bonus_type_save': return respond(await saveBonusType(actor, body, announceToOwners));
    case 'fund_change': return respond(await changeFund(actor, { kind: body.change, fund: body.fund, amount: body.amount, reason: body.reason }, announceToOwners));
    case 'objection_submit':
      return submit(actor, 'deduction_objection', { target: body.target, targetId: body.targetId, reason: body.reason }, body.attachmentId ? [body.attachmentId] : []);
  }
}
