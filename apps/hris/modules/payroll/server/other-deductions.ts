import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import {
  cashShortageApprovals, cashShortages, deductionObjections, inventoryLosses, manualCashShortages, otherDeductionInstallments, otherDeductionTypes, otherDeductions,
} from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { hasAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { todayWib } from '@/modules/employees';
import { filesUploadedBy } from '@/modules/files';
import { notify } from '@/modules/notifications';
import type { RequestHandler } from '@/modules/requests';
import { checkReason, settingOn } from '@/modules/settings';
import { entryKindLabel } from '../rules/bonus';
import { GROUP_LABELS, objectionDeadline, scheduleInstallments, takeDeductions, type DeductionItem } from '../rules/deductions';
import { addPeriods, longDate, periodStartOf, rupiah, type IsoDate } from '../rules/salary';
import { computeAttendancePay, isPeriodLocked, periodChoices } from './attendance-pay';
import { bonusesOf } from './bonus';
import { shortageAmountsOf } from './cash-shortages';
import { accountNames, canSeeSalary, loadPayrollPeople, type PayrollPerson } from './data';
import { periodEndOf } from './deduction-data';
import { lossSplitOf } from './losses';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

export const OTHER_STATUS_LABELS = { PENDING: 'Menunggu pengesahan', ACTIVE: 'Berjalan', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan', WAIVED: 'Ditiadakan (keberatan)' } as const;
export type OtherStatus = keyof typeof OTHER_STATUS_LABELS;

const isOwnerOrGm = (person: PayrollPerson) => person.isOwnerPosition || person.isGmPosition;

/** Slip pertama: periode berjalan saat disahkan, atau periode berikutnya bila slip itu sudah ditutup (GAJ-80). */
async function firstPeriod(today: IsoDate): Promise<IsoDate> {
  const current = periodStartOf(today);
  return (await isPeriodLocked(current)) ? addPeriods(current, 1) : current;
}

// ---- Jenis Potongan Lain ----

export async function deductionTypesScreen(actor: Actor | null) {
  if (!hasAction(actor, 'other_deduction.view') && !hasAction(actor, 'other_deduction_types.manage')) return null;
  const types = await db.select().from(otherDeductionTypes).orderBy(asc(otherDeductionTypes.sortOrder), asc(otherDeductionTypes.id));
  const used = await db.selectDistinct({ typeId: otherDeductions.typeId }).from(otherDeductions).where(inArray(otherDeductions.status, ['PENDING', 'ACTIVE']));
  return {
    types: types.map((t) => ({ id: t.id, name: t.name, active: t.active, inUse: used.some((u) => u.typeId === t.id) })),
    canEdit: hasAction(actor, 'other_deduction_types.manage'),
  };
}

export async function saveDeductionType(actor: Actor | null, input: { id?: number; name: unknown; active?: boolean }): Promise<ServiceResult<{ id: number }>> {
  if (!hasAction(actor, 'other_deduction_types.manage')) return fail(403, 'Hanya Pemilik atau GM yang mengubah Jenis Potongan Lain.');
  const name = String(input.name ?? '').trim();
  if (name.length < 3 || name.length > 60) return fail(400, 'Nama jenis 3 sampai 60 huruf.');
  try {
    return await db.transaction(async (tx) => {
      if (input.id) {
        const [old] = await tx.select().from(otherDeductionTypes).where(eq(otherDeductionTypes.id, input.id));
        if (!old) return fail(404, 'Jenis tidak ditemukan.');
        if (input.active === false && old.active) {
          const [inUse] = await tx.select({ id: otherDeductions.id }).from(otherDeductions)
            .where(and(eq(otherDeductions.typeId, old.id), inArray(otherDeductions.status, ['PENDING', 'ACTIVE']))).limit(1);
          if (inUse) return fail(409, 'Jenis ini masih dipakai Potongan Lain yang berjalan atau menunggu; tidak bisa dinonaktifkan.');
        }
        await tx.update(otherDeductionTypes).set({ name, active: input.active ?? old.active }).where(eq(otherDeductionTypes.id, old.id));
        await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'other_deduction_type', entityId: old.id, action: 'other_deduction_type.update', before: { name: old.name, active: old.active }, after: { name, active: input.active ?? old.active } });
        return { ok: true as const, data: { id: old.id } };
      }
      const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${otherDeductionTypes.sortOrder}), 0) + 1` }).from(otherDeductionTypes);
      const [row] = await tx.insert(otherDeductionTypes).values({ name, sortOrder: Number(next) }).returning({ id: otherDeductionTypes.id });
      await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'other_deduction_type', entityId: row.id, action: 'other_deduction_type.create', before: null, after: { name } });
      return { ok: true as const, data: { id: row.id } };
    });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } })?.cause ?? (error as { code?: string });
    if ((cause as { code?: string })?.code === '23505') return fail(409, 'Nama jenis itu sudah ada.');
    throw error;
  }
}

// ---- Potongan Lain (GAJ-80) ----

type OtherInput = { employeeId: unknown; typeId: unknown; amount: unknown; reason: unknown; installments: unknown; attachmentId: unknown };
type CheckedOther = { person: PayrollPerson; typeId: number; typeName: string; amount: number; reason: string; installments: number; attachmentId: string | null };

async function checkOther(tx: Tx, actor: Actor, input: OtherInput, today: IsoDate): Promise<CheckedOther | Fail> {
  const person = (await loadPayrollPeople(today)).find((p) => p.id === Number(input.employeeId));
  if (!person || !canSeeSalary(actor, person)) return fail(404, 'Orang ini tidak ditemukan di daftar gaji bulanan.');
  if (person.id === actor.personId) return fail(403, 'Potongan Lain untuk diri sendiri tidak bisa diajukan.');
  if (isOwnerOrGm(person)) return fail(400, 'Pemilik dan GM tidak dikenai potongan (GAJ-09).');
  const [type] = await tx.select().from(otherDeductionTypes).where(eq(otherDeductionTypes.id, Number(input.typeId)));
  if (!type?.active) return fail(400, 'Pilih jenis Potongan Lain yang aktif.');
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000_000) return fail(400, 'Nominal harus rupiah bulat lebih dari 0.');
  const reason = String(input.reason ?? '').trim();
  if (reason.length < 15) return fail(400, 'Alasan paling sedikit 15 huruf.');
  const max = Number(await settingOn<number>('payroll.other_deduction_max_installments', today));
  const installments = Number(input.installments);
  if (!Number.isInteger(installments) || installments < 1 || installments > max) return fail(400, `Kali potong 1 sampai ${max}.`);
  if (installments > amount) return fail(400, 'Nominal terlalu kecil untuk dicicil sebanyak itu.');
  const attachmentId = input.attachmentId ? String(input.attachmentId) : null;
  if (attachmentId && !(await filesUploadedBy(tx, actor.accountId, [attachmentId])).length) return fail(400, 'Lampiran tidak ditemukan. Unggah ulang fotonya.');
  return { person, typeId: type.id, typeName: type.name, amount, reason, installments, attachmentId };
}

async function startDeduction(tx: Tx, row: { id: number; employeeId: number; amount: number; installments: number; reason: string }, typeName: string, actorAccountId: number, now: Date) {
  const plan = scheduleInstallments(row.amount, row.installments, await firstPeriod(todayWib(now)));
  await tx.insert(otherDeductionInstallments).values(plan.map((p) => ({ deductionId: row.id, ...p })));
  const account = (await activeHrisAccounts([row.employeeId])).get(row.employeeId);
  if (account) {
    await notify(tx, [account], {
      kind: 'other_deduction.active',
      title: `Potongan Lain: ${typeName} ${rupiah(row.amount)}.`,
      body: `${plan.map((p) => `${rupiah(p.amount)} di slip periode ${longDate(p.periodStart)}`).join('; ')}. Alasan: ${row.reason}. Bila tidak setuju, ajukan keberatan paling lambat ${longDate(isoWib(objectionDeadline(now)))} pukul 23.59.`,
      link: `/keberatan-potongan/ajukan?jenis=OTHER_DEDUCTION&id=${row.id}`, entity: 'other_deduction', entityId: row.id,
    }, actorAccountId);
  }
  return plan;
}

const isoWib = (date: Date) => new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

export async function recordOtherDirect(actor: Actor | null, input: OtherInput, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ id: number }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'deduction.approve')) return fail(403, 'Hanya Pemilik atau GM yang menjalankan Potongan Lain langsung; HR mengajukan usulan.');
  return db.transaction(async (tx) => {
    const checked = await checkOther(tx, actor, input, todayWib(now));
    if ('ok' in checked) return checked;
    const [row] = await tx.insert(otherDeductions).values({
      employeeId: checked.person.id, typeId: checked.typeId, amount: checked.amount, reason: checked.reason, installments: checked.installments,
      attachmentFileId: checked.attachmentId, status: 'ACTIVE', recordedByAccountId: actor.accountId, recordedByEmployeeId: actor.personId,
      approvedByAccountId: actor.accountId, approvedAt: now,
    }).returning({ id: otherDeductions.id });
    await startDeduction(tx, { id: row.id, employeeId: checked.person.id, amount: checked.amount, installments: checked.installments, reason: checked.reason }, checked.typeName, actor.accountId, now);
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'other_deduction', entityId: row.id, action: 'other_deduction.create', before: null, after: { employeeId: checked.person.id, amount: checked.amount, installments: checked.installments } });
    await announce(tx, actor.accountId, { what: `menjalankan Potongan Lain ${checked.typeName} ${checked.person.name} (${rupiah(checked.amount)})`, link: '/potongan/lain', entity: 'other_deduction', entityId: row.id });
    return { ok: true as const, data: { id: row.id } };
  });
}

async function loadOther(executor: typeof db | Tx, by: { id?: number; requestId?: number }) {
  const [row] = await executor.select().from(otherDeductions)
    .where(by.id != null ? eq(otherDeductions.id, by.id) : eq(otherDeductions.requestId, by.requestId ?? -1));
  return row ?? null;
}

const typeNameOf = async (typeId: number) => (await db.select({ name: otherDeductionTypes.name }).from(otherDeductionTypes).where(eq(otherDeductionTypes.id, typeId)))[0]?.name ?? 'Potongan Lain';
const personNameOf = async (id: number) => (await loadPayrollPeople()).find((p) => p.id === id)?.name ?? `#${id}`;

export function otherDeductionHandler(announce: ChangeAnnounce): RequestHandler {
  return {
    async prepare(tx, actor, input) {
      if (actor.fullAccess) return fail(400, 'Pemilik dan GM menjalankan Potongan Lain langsung.');
      const checked = await checkOther(tx, actor, input as OtherInput, todayWib());
      if ('ok' in checked) return checked;
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `Potongan Lain ${checked.typeName} ${checked.person.name} ${rupiah(checked.amount)} (${checked.installments} kali)`,
          dedupeKey: null,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            await saveTx.insert(otherDeductions).values({
              employeeId: checked.person.id, typeId: checked.typeId, amount: checked.amount, reason: checked.reason, installments: checked.installments,
              attachmentFileId: checked.attachmentId, status: 'PENDING', requestId, recordedByAccountId: actor.accountId, recordedByEmployeeId: actor.personId,
            });
          },
        },
      };
    },
    async apply(tx, actorAccountId, requestId) {
      const row = await loadOther(tx, { requestId });
      if (!row || row.status !== 'PENDING') return fail(404, 'Usulan Potongan Lain tidak ditemukan.');
      if ((await activeHrisAccounts([row.employeeId])).get(row.employeeId) === actorAccountId) return fail(403, 'Potongan atas diri Anda sendiri disahkan pemilik lain.');
      const now = new Date();
      await tx.update(otherDeductions).set({ status: 'ACTIVE', approvedByAccountId: actorAccountId, approvedAt: now }).where(eq(otherDeductions.id, row.id));
      const typeName = await typeNameOf(row.typeId);
      const plan = await startDeduction(tx, row, typeName, actorAccountId, now);
      const name = await personNameOf(row.employeeId);
      await announce(tx, actorAccountId, { what: `mengesahkan Potongan Lain ${typeName} ${name} (${rupiah(row.amount)})`, link: '/potongan/lain', entity: 'other_deduction', entityId: row.id });
      return { ok: true as const, effect: `Potongan Lain berjalan mulai slip periode ${longDate(plan[0].periodStart)}. ${name} diberi tahu dan boleh mengajukan keberatan 3 hari.` };
    },
    async close(tx, _actorAccountId, requestId) {
      await tx.update(otherDeductions).set({ status: 'REJECTED' }).where(and(eq(otherDeductions.requestId, requestId), eq(otherDeductions.status, 'PENDING')));
    },
    async effectPreview(requestId) {
      const row = await loadOther(db, { requestId });
      if (!row) return 'Usulan ini akan disahkan.';
      const plan = scheduleInstallments(row.amount, row.installments, await firstPeriod(todayWib()));
      return `Dipotong ${plan.map((p) => `${rupiah(p.amount)} (slip ${longDate(p.periodStart)})`).join(', ')}. Orangnya diberi tahu dan boleh mengajukan keberatan.`;
    },
    async describe(requestId) {
      const row = await loadOther(db, { requestId });
      if (!row) return [];
      return [
        { label: 'Karyawan', before: null, after: await personNameOf(row.employeeId) },
        { label: 'Jenis', before: null, after: await typeNameOf(row.typeId) },
        { label: 'Nominal', before: null, after: rupiah(row.amount) },
        { label: 'Kali potong', before: null, after: String(row.installments) },
        { label: 'Alasan', before: null, after: row.reason },
      ];
    },
    async resubmitValues(requestId) {
      const row = await loadOther(db, { requestId });
      return row ? { employeeId: row.employeeId, typeId: row.typeId, amount: row.amount, reason: row.reason, installments: row.installments } : null;
    },
  };
}

async function liveInstallments(executor: typeof db | Tx, deductionId: number) {
  return executor.select().from(otherDeductionInstallments)
    .where(and(eq(otherDeductionInstallments.deductionId, deductionId), isNull(otherDeductionInstallments.cancelledAt)))
    .orderBy(asc(otherDeductionInstallments.sequence));
}

/** Batalkan hanya sebelum cicilan pertama terpotong (slip ditutup). Sebelum 4E-5a belum ada yang terpotong. */
export async function cancelOther(actor: Actor | null, id: number, reasonInput: unknown, announce: ChangeAnnounce): Promise<ServiceResult<object>> {
  if (!actor?.fullAccess || !hasAction(actor, 'deduction.approve')) return fail(403, 'Hanya Pemilik atau GM yang bisa membatalkan.');
  const reason = await checkReason(reasonInput, 'Alasan membatalkan');
  if (!reason.ok) return fail(400, reason.error);
  const row = await loadOther(db, { id });
  if (!row || row.status !== 'ACTIVE') return fail(404, 'Potongan Lain yang berjalan tidak ditemukan.');
  if (row.employeeId === actor.personId) return fail(403, 'Potongan atas diri Anda sendiri diubah pemilik lain.');
  for (const i of await liveInstallments(db, id)) if (await isPeriodLocked(i.periodStart)) return fail(409, 'Cicilan pertama sudah terpotong; yang bisa hanya Hapuskan sisa (menyusul bersama Tutup Slip).');
  return db.transaction(async (tx) => {
    const done = await tx.update(otherDeductions).set({ status: 'CANCELLED', cancelledAt: new Date(), cancelledByAccountId: actor.accountId, cancelReason: reason.reason })
      .where(and(eq(otherDeductions.id, id), eq(otherDeductions.status, 'ACTIVE'))).returning({ id: otherDeductions.id });
    if (!done.length) return fail(409, 'Potongan ini baru saja diubah orang lain.');
    await tx.update(otherDeductionInstallments).set({ cancelledAt: new Date() }).where(and(eq(otherDeductionInstallments.deductionId, id), isNull(otherDeductionInstallments.cancelledAt)));
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'other_deduction', entityId: id, action: 'other_deduction.cancel', before: { status: 'ACTIVE' }, after: { status: 'CANCELLED' }, reason: reason.reason });
    const account = (await activeHrisAccounts([row.employeeId])).get(row.employeeId);
    if (account) await notify(tx, [account], { kind: 'other_deduction.cancelled', title: `Potongan Lain ${rupiah(row.amount)} dibatalkan; tidak dipotong.`, entity: 'other_deduction', entityId: id }, actor.accountId);
    await announce(tx, actor.accountId, { what: `membatalkan Potongan Lain ${await personNameOf(row.employeeId)} (${rupiah(row.amount)})`, link: '/potongan/lain', entity: 'other_deduction', entityId: id });
    return { ok: true as const, data: {} };
  });
}

/** Ubah jadwal (Pemilik/GM, alasan): cicilan yang belum terpotong diganti jadwal baru 1–3 kali mulai slip berikutnya yang terbuka. */
export async function rescheduleOther(actor: Actor | null, id: number, input: { installments: unknown; reason: unknown }, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<object>> {
  if (!actor?.fullAccess || !hasAction(actor, 'deduction.approve')) return fail(403, 'Hanya Pemilik atau GM yang mengubah jadwal.');
  const reason = await checkReason(input.reason, 'Alasan mengubah jadwal');
  if (!reason.ok) return fail(400, reason.error);
  const row = await loadOther(db, { id });
  if (!row || row.status !== 'ACTIVE') return fail(404, 'Potongan Lain yang berjalan tidak ditemukan.');
  if (row.employeeId === actor.personId) return fail(403, 'Potongan atas diri Anda sendiri diubah pemilik lain.');
  const today = todayWib(now);
  const max = Number(await settingOn<number>('payroll.other_deduction_max_installments', today));
  const count = Number(input.installments);
  if (!Number.isInteger(count) || count < 1 || count > max) return fail(400, `Kali potong 1 sampai ${max}.`);
  const live = await liveInstallments(db, id);
  const open: typeof live = [];
  for (const i of live) if (!(await isPeriodLocked(i.periodStart))) open.push(i);
  const remaining = open.reduce((s, i) => s + i.amount, 0);
  if (!remaining) return fail(409, 'Tidak ada cicilan yang belum terpotong.');
  const plan = scheduleInstallments(remaining, Math.min(count, remaining), await firstPeriod(today));
  const lastSequence = live.reduce((m, i) => Math.max(m, i.sequence), 0);
  return db.transaction(async (tx) => {
    await tx.update(otherDeductionInstallments).set({ cancelledAt: now }).where(inArray(otherDeductionInstallments.id, open.map((i) => i.id)));
    await tx.insert(otherDeductionInstallments).values(plan.map((p, index) => ({ deductionId: id, sequence: lastSequence + index + 1, periodStart: p.periodStart, amount: p.amount })));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'other_deduction', entityId: id, action: 'other_deduction.reschedule',
      before: open.map((i) => ({ periodStart: i.periodStart, amount: i.amount })), after: plan, reason: reason.reason,
    });
    const account = (await activeHrisAccounts([row.employeeId])).get(row.employeeId);
    if (account) await notify(tx, [account], { kind: 'other_deduction.rescheduled', title: `Jadwal Potongan Lain diubah: ${plan.map((p) => `${rupiah(p.amount)} slip ${longDate(p.periodStart)}`).join('; ')}.`, entity: 'other_deduction', entityId: id }, actor.accountId);
    await announce(tx, actor.accountId, { what: `mengubah jadwal Potongan Lain ${await personNameOf(row.employeeId)}`, link: '/potongan/lain', entity: 'other_deduction', entityId: id });
    return { ok: true as const, data: {} };
  });
}

export async function otherDeductionsScreen(actor: Actor | null, input: { status: OtherStatus | null; branchId: number | null }, now: Date = new Date()) {
  if (!hasAction(actor, 'other_deduction.view') && !hasAction(actor, 'deduction.approve')) return null;
  const today = todayWib(now);
  const people = (await loadPayrollPeople(today)).filter((p) => canSeeSalary(actor, p) || actor?.fullAccess);
  const [rows, types, names] = await Promise.all([
    db.select().from(otherDeductions).orderBy(desc(otherDeductions.createdAt)),
    db.select().from(otherDeductionTypes).orderBy(asc(otherDeductionTypes.sortOrder)),
    accountNames(),
  ]);
  const installments = rows.length
    ? await db.select().from(otherDeductionInstallments).where(inArray(otherDeductionInstallments.deductionId, rows.map((r) => r.id))).orderBy(asc(otherDeductionInstallments.sequence))
    : [];
  const visible = rows.filter((r) => people.some((p) => p.id === r.employeeId));
  const result = [];
  for (const r of visible) {
    const person = people.find((p) => p.id === r.employeeId)!;
    if (input.branchId != null && person.branchId !== input.branchId) continue;
    if (input.status != null && r.status !== input.status) continue;
    const own = installments.filter((i) => i.deductionId === r.id);
    const live = own.filter((i) => !i.cancelledAt);
    let cut = 0;
    for (const i of live) if (await isPeriodLocked(i.periodStart)) cut += i.amount;
    result.push({
      id: r.id, employeeId: r.employeeId, name: person.name, branchName: person.branchName, typeName: types.find((t) => t.id === r.typeId)?.name ?? '-',
      amount: r.amount, reason: r.reason, installments: r.installments, status: r.status as OtherStatus, requestId: r.requestId,
      left: r.status === 'ACTIVE' ? live.reduce((s, i) => s + i.amount, 0) - cut : 0,
      recordedBy: names.get(r.recordedByAccountId) ?? '-', cancelReason: r.cancelReason,
      schedule: own.map((i) => ({ sequence: i.sequence, periodStart: i.periodStart, amount: i.amount, cancelled: i.cancelledAt != null })),
      canChange: r.status === 'ACTIVE' && !!actor?.fullAccess && hasAction(actor, 'deduction.approve') && r.employeeId !== actor.personId,
    });
  }
  return {
    rows: result, filter: input, today,
    branches: [...new Map(people.map((p) => [p.branchId, { id: p.branchId, name: p.branchName }])).values()],
    canPropose: hasAction(actor, 'other_deduction.propose') || hasAction(actor, 'deduction.approve'),
    maxInstallments: Number(await settingOn<number>('payroll.other_deduction_max_installments', today)),
  };
}

export async function otherDeductionFormScreen(actor: Actor | null, now: Date = new Date()) {
  if (!hasAction(actor, 'other_deduction.propose') && !hasAction(actor, 'deduction.approve')) return null;
  const today = todayWib(now);
  const people = (await loadPayrollPeople(today)).filter((p) => (canSeeSalary(actor, p) || actor?.fullAccess) && p.id !== actor?.personId && !isOwnerOrGm(p));
  const types = (await db.select().from(otherDeductionTypes).where(eq(otherDeductionTypes.active, true)).orderBy(asc(otherDeductionTypes.sortOrder)));
  return {
    people: people.map((p) => ({ id: p.id, name: p.name, branchName: p.branchName })), types: types.map((t) => ({ id: t.id, name: t.name })),
    maxInstallments: Number(await settingOn<number>('payroll.other_deduction_max_installments', today)),
    firstPeriod: await firstPeriod(today), direct: !!actor?.fullAccess,
  };
}

// ---- Keberatan Potongan (GAJ-81) ----

export type ObjectionTarget = 'CASH_SHORTAGE' | 'MANUAL_CASH_SHORTAGE' | 'OTHER_DEDUCTION';
const TARGET_LABELS: Record<ObjectionTarget, string> = { CASH_SHORTAGE: 'Minus kas POS', MANUAL_CASH_SHORTAGE: 'Minus kas catat tangan', OTHER_DEDUCTION: 'Potongan Lain' };

/** Potongan yang dikeberati: milik orang itu, sudah berlaku, dengan waktu diberi tahu (untuk batas 3 hari). */
async function objectionSubject(target: ObjectionTarget, targetId: number) {
  if (target === 'CASH_SHORTAGE') {
    const [a] = await db.select().from(cashShortageApprovals).where(eq(cashShortageApprovals.id, targetId));
    if (!a || a.status !== 'APPROVED' || !a.approvedAt) return null;
    const rows = await db.select().from(cashShortages).where(eq(cashShortages.approvalId, a.id));
    const net = Math.max(0, rows.filter((r) => !r.waivedAt).reduce((s, r) => s - r.amount, 0));
    return { employeeId: a.employeeId, notifiedAt: a.approvedAt, text: `Minus kas POS periode ${longDate(a.periodStart)}: ${rupiah(net)}`, live: rows.some((r) => !r.waivedAt) };
  }
  if (target === 'MANUAL_CASH_SHORTAGE') {
    const [m] = await db.select().from(manualCashShortages).where(eq(manualCashShortages.id, targetId));
    if (!m || m.namedEmployeeId == null || !m.approvedAt) return null;
    return { employeeId: m.namedEmployeeId, notifiedAt: m.approvedAt, text: `Minus kas ${longDate(m.occurredOn)}: ${rupiah(m.amount)} — ${m.reason}`, live: m.status === 'ACTIVE' };
  }
  const [o] = await db.select().from(otherDeductions).where(eq(otherDeductions.id, targetId));
  if (!o || !o.approvedAt) return null;
  return { employeeId: o.employeeId, notifiedAt: o.approvedAt, text: `Potongan Lain ${await typeNameOf(o.typeId)} ${rupiah(o.amount)} — ${o.reason}`, live: o.status === 'ACTIVE' };
}

const isTarget = (value: unknown): value is ObjectionTarget => value === 'CASH_SHORTAGE' || value === 'MANUAL_CASH_SHORTAGE' || value === 'OTHER_DEDUCTION';

export async function objectionFormScreen(actor: Actor | null, target: unknown, targetId: number, now: Date = new Date()) {
  if (!actor || !isTarget(target)) return null;
  const subject = await objectionSubject(target, targetId);
  if (!subject || subject.employeeId !== actor.personId) return null;
  const deadline = objectionDeadline(subject.notifiedAt);
  const [open] = await db.select({ requestId: deductionObjections.requestId }).from(deductionObjections)
    .where(and(eq(deductionObjections.target, target), eq(deductionObjections.targetId, targetId), eq(deductionObjections.state, 'OPEN')));
  return {
    target, targetId, label: TARGET_LABELS[target], text: subject.text, deadline: deadline.toISOString(),
    expired: now > deadline, live: subject.live, openRequestId: open?.requestId ?? null,
  };
}

export function deductionObjectionHandler(announce: ChangeAnnounce): RequestHandler {
  return {
    async prepare(_tx, actor, input) {
      const target = input.target;
      const targetId = Number(input.targetId);
      if (!isTarget(target)) return fail(400, 'Potongan tidak dikenal.');
      const subject = await objectionSubject(target, targetId);
      if (!subject || subject.employeeId !== actor.personId) return fail(404, 'Potongan ini bukan atas nama Anda.');
      if (!subject.live) return fail(409, 'Potongan ini sudah tidak berjalan.');
      if (new Date() > objectionDeadline(subject.notifiedAt)) return fail(409, 'Batas keberatan (pukul 23.59 hari ke-3 sejak diberi tahu) sudah lewat. Keberatan berikutnya lewat keberatan slip.');
      const reason = String(input.reason ?? '').trim();
      if (reason.length < 20) return fail(400, 'Alasan paling sedikit 20 huruf.');
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `Keberatan: ${subject.text}`,
          dedupeKey: `objection:${target}:${targetId}`,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            await saveTx.insert(deductionObjections).values({ requestId, employeeId: actor.personId, target, targetId, reason });
          },
        },
      };
    },
    async apply(tx, actorAccountId, requestId) {
      const [objection] = await tx.select().from(deductionObjections).where(eq(deductionObjections.requestId, requestId));
      if (!objection || objection.state !== 'OPEN') return fail(404, 'Keberatan tidak ditemukan.');
      const note = `Keberatan disetujui (pengajuan #${requestId})`;
      const now = new Date();
      if (objection.target === 'CASH_SHORTAGE') {
        await tx.update(cashShortages).set({ waivedAt: now, waivedByAccountId: actorAccountId, waiveReason: note })
          .where(and(eq(cashShortages.approvalId, objection.targetId), isNull(cashShortages.waivedAt)));
      } else if (objection.target === 'MANUAL_CASH_SHORTAGE') {
        await tx.update(manualCashShortages).set({ status: 'WAIVED' }).where(and(eq(manualCashShortages.id, objection.targetId), eq(manualCashShortages.status, 'ACTIVE')));
      } else {
        await tx.update(otherDeductions).set({ status: 'WAIVED', cancelledAt: now, cancelledByAccountId: actorAccountId, cancelReason: note })
          .where(and(eq(otherDeductions.id, objection.targetId), eq(otherDeductions.status, 'ACTIVE')));
        await tx.update(otherDeductionInstallments).set({ cancelledAt: now })
          .where(and(eq(otherDeductionInstallments.deductionId, objection.targetId), isNull(otherDeductionInstallments.cancelledAt)));
      }
      await tx.update(deductionObjections).set({ state: 'WAIVED' }).where(eq(deductionObjections.id, objection.id));
      await recordAudit(tx, { actorAccountId, entity: 'deduction_objection', entityId: objection.id, action: 'deduction_objection.waive', before: { state: 'OPEN' }, after: { state: 'WAIVED', target: objection.target, targetId: objection.targetId } });
      await announce(tx, actorAccountId, { what: `meniadakan potongan lewat keberatan ${await personNameOf(objection.employeeId)}`, link: `/persetujuan/${requestId}`, entity: 'deduction_objection', entityId: objection.id });
      return { ok: true as const, effect: 'Potongan ditiadakan. Bila sudah terpotong di slip yang ditutup, uangnya kembali di slip berikutnya.' };
    },
    async close(tx, actorAccountId, requestId) {
      const [objection] = await tx.select().from(deductionObjections).where(eq(deductionObjections.requestId, requestId));
      if (!objection || objection.state !== 'OPEN') return;
      // Ditolak penyetuju = potongan Tetap; dibatalkan pengajunya sendiri = ditutup.
      const own = (await activeHrisAccounts([objection.employeeId])).get(objection.employeeId) === actorAccountId;
      await tx.update(deductionObjections).set({ state: own ? 'CLOSED' : 'KEPT' }).where(eq(deductionObjections.id, objection.id));
    },
    async effectPreview(requestId) {
      const [objection] = await db.select().from(deductionObjections).where(eq(deductionObjections.requestId, requestId));
      return objection ? `Disetujui = ${TARGET_LABELS[objection.target]} ini ditiadakan (tidak dipotong). Tolak dengan alasan = potongan tetap.` : 'Keberatan ini akan disetujui.';
    },
    async describe(requestId) {
      const [objection] = await db.select().from(deductionObjections).where(eq(deductionObjections.requestId, requestId));
      if (!objection) return [];
      const subject = await objectionSubject(objection.target, objection.targetId);
      return [
        { label: 'Potongan', before: null, after: subject?.text ?? `${TARGET_LABELS[objection.target]} #${objection.targetId}` },
        { label: 'Alasan keberatan', before: null, after: objection.reason },
        { label: 'Diputuskan', before: null, after: 'Setujui = Ditiadakan · Tolak (alasan wajib) = Tetap' },
      ];
    },
    async resubmitValues(requestId) {
      const [objection] = await db.select().from(deductionObjections).where(eq(deductionObjections.requestId, requestId));
      return objection ? { target: objection.target, targetId: objection.targetId, reason: objection.reason } : null;
    },
  };
}

// ---- Potongan dan Sisa (GAJ-L19) ----

/** Urutan pengambilan satu orang satu periode (perkiraan; sisa disimpan saat slip ditutup, 4E-5a). */
export async function deductionsOf(person: PayrollPerson, periodStart: IsoDate, now: Date = new Date()) {
  const pay = await computeAttendancePay(person, periodStart, now);
  if (!pay) return null;
  const income = pay.lines.filter((l) => l.sign === 1).reduce((s, l) => s + l.amount, 0);
  const items: DeductionItem[] = [];
  for (const line of pay.lines.filter((l) => l.sign === -1 && l.amount > 0)) {
    items.push({ group: 'a', key: `a:${line.key}`, label: LINE_TEXT[line.key] ?? line.key, date: periodStart, amount: line.amount });
  }
  if (!isOwnerOrGm(person)) {
    const end = periodEndOf(periodStart);
    const losses = await db.select().from(inventoryLosses).where(and(eq(inventoryLosses.status, 'ACTIVE'), gte(inventoryLosses.foundOn, periodStart), lte(inventoryLosses.foundOn, end)));
    for (const loss of losses) {
      const share = (await lossSplitOf(loss.branchId, loss.foundOn, loss.amount))?.shares.find((s) => s.employeeId === person.id);
      if (share?.amount) items.push({ group: 'b', key: `loss:${loss.id}`, label: `Kehilangan barang ${longDate(loss.foundOn)}`, date: loss.foundOn, amount: share.amount });
    }
    const shortage = await shortageAmountsOf(person.id, periodStart);
    if (shortage.pos.net) items.push({ group: 'b', key: 'pos', label: `Minus kas POS (minus ${rupiah(shortage.pos.minus)} − lebih ${rupiah(shortage.pos.plus)})`, date: end, amount: shortage.pos.net });
    for (const m of shortage.manual) items.push({ group: 'b', key: `manual:${m.id}`, label: `Minus kas ${longDate(m.occurredOn)}`, date: m.occurredOn, amount: m.amount });
    const due = await db.select({ id: otherDeductionInstallments.id, amount: otherDeductionInstallments.amount, sequence: otherDeductionInstallments.sequence, typeId: otherDeductions.typeId, total: otherDeductions.installments, createdAt: otherDeductions.createdAt })
      .from(otherDeductionInstallments).innerJoin(otherDeductions, eq(otherDeductions.id, otherDeductionInstallments.deductionId))
      .where(and(eq(otherDeductions.employeeId, person.id), eq(otherDeductions.status, 'ACTIVE'), eq(otherDeductionInstallments.periodStart, periodStart), isNull(otherDeductionInstallments.cancelledAt)));
    for (const d of due) items.push({ group: 'c', key: `other:${d.id}`, label: `${await typeNameOf(d.typeId)} (cicilan)`, date: d.createdAt.toISOString().slice(0, 10), amount: d.amount });
  }
  // Koreksi bonus minus (uang bonus yang harus kembali) diambil bersama Potongan Lain (GAJ-90, spec L4d §3.3); Pemilik bisa menerima bonus grooming.
  for (const c of (await bonusesOf(person.id, periodStart)).minusCorrections) {
    items.push({ group: 'c', key: `bonus:${c.id}`, label: `Koreksi bonus ${entryKindLabel(c.kind, null).toLowerCase()}`, date: c.occurredOn, amount: c.amount });
  }
  const taken = takeDeductions(income, items);
  return { income, ...taken, groups: GROUP_LABELS };
}

const LINE_TEXT: Record<string, string> = {
  LATE: 'Potongan telat', PERMIT_SICK: 'Izin dan sakit tanpa surat', SUDDEN: 'Izin mendadak', ALPHA: 'Alpha', SICK_LETTER: 'Sakit dengan surat dokter', FINE: 'Denda kehadiran',
};

export async function deductionsTabScreen(actor: Actor | null, employeeId: number, periodInput: string | null, now: Date = new Date()) {
  const today = todayWib(now);
  const person = (await loadPayrollPeople(today)).find((p) => p.id === employeeId);
  if (!person || !canSeeSalary(actor, person)) return null;
  const periods = periodChoices(today);
  const period = periods.find((p) => p.start === periodInput) ?? periods[0];
  return {
    person: { id: person.id, name: person.name, positionName: person.positionName, branchName: person.branchName },
    period, periods, computedAt: now.toISOString(), result: await deductionsOf(person, period.start, now),
    note: isOwnerOrGm(person) ? 'Jabatan Pemilik dan GM tidak dikenai potongan di luar kehadiran (GAJ-09).' : null,
  };
}
