import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { announceToOwners } from '@/lib/owner-notify';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { hasAction, loadActor, type ServiceResult } from '@/modules/access';
import {
  cancelSalaryChange, cancelWaiver, changeSalary, savePayRules, saveComponentType, saveStandard, setComponentTypeActive, waiveDeduction, PAY_RULE_KEYS,
} from '@/modules/payroll';
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
]);

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
  }
}
