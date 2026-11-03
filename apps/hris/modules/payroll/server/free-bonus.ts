import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import { bonusEntries, bonusTypes } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { hasAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { todayWib } from '@/modules/employees';
import { notify } from '@/modules/notifications';
import type { RequestHandler } from '@/modules/requests';
import { freeBonusProblem } from '../rules/bonus';
import { BONUS_FUND_LABELS, type BonusFund } from '../rules/funds';
import { longDate, periodStartOf, rupiah, type IsoDate } from '../rules/salary';
import { isPeriodLocked } from './attendance-pay';
import { loadPayrollPeople, type PayrollPerson } from './data';
import { disciplineFundProblem, readFundState } from './funds';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

// Bonus Bebas dan jenis ketik lain (spec L4d §3.1, GAJ-L22): HR mencatat sebagai usulan lewat Mesin Pengajuan
// (`free_bonus`), Pemilik/GM mencatat langsung Disahkan. Satu-satunya penulis baris TYPED di Buku Bonus.

export type FreeInput = { employeeId: unknown; typeId: unknown; amount: unknown; occurredOn: unknown; fund: unknown; reason: unknown };
type CheckedFree = { person: PayrollPerson; typeId: number; typeName: string; amount: number; occurredOn: IsoDate; fund: BonusFund; reason: string };

const roleOf = (p: PayrollPerson) => (p.isGmPosition ? 'GM' : p.isOwnerPosition ? 'OWNER' : 'STAFF') as 'GM' | 'OWNER' | 'STAFF';

async function checkFree(tx: Tx, actor: Actor, input: FreeInput, today: IsoDate): Promise<CheckedFree | Fail> {
  const person = (await loadPayrollPeople(today)).find((p) => p.id === Number(input.employeeId));
  // Orang bertanda "gaji hanya terlihat Pemilik dan GM" tidak ditampilkan ke HR (GAJ-46).
  if (!person || (person.ownerOnly && !actor.fullAccess)) return fail(404, 'Orang ini tidak ditemukan di daftar gaji bulanan.');
  const [type] = await tx.select().from(bonusTypes).where(eq(bonusTypes.id, Number(input.typeId)));
  if (!type?.active) return fail(400, 'Pilih jenis bonus yang aktif.');
  const fund = input.fund === 'DISCIPLINE_FUND' ? 'DISCIPLINE_FUND' : input.fund === 'OFFICE' ? 'OFFICE' : null;
  if (!fund) return fail(400, 'Pilih sumber dana.');
  const amount = Number(input.amount);
  const reason = String(input.reason ?? '').trim();
  const occurredOn = String(input.occurredOn ?? '');
  const problem = freeBonusProblem({ amount, reason, occurredOn, today, self: person.id === actor.personId, recipientRole: roleOf(person) });
  if (problem) return fail(problem.includes('diri sendiri') ? 403 : 400, problem);
  return { person, typeId: type.id, typeName: type.name, amount, occurredOn, fund, reason };
}

async function slipText(periodStart: IsoDate, employeeId: number) {
  return (await isPeriodLocked(periodStart, employeeId)) ? 'masuk slip periode berikutnya' : `masuk slip periode ${longDate(periodStart)}`;
}

async function tell(tx: Tx, employeeId: number, actorAccountId: number, entityId: number, row: { typeName: string; amount: number; reason: string; periodStart: IsoDate }) {
  const account = (await activeHrisAccounts([employeeId])).get(employeeId);
  if (!account) return;
  await notify(tx, [account], {
    kind: 'bonus.approved', entity: 'bonus_entry', entityId, link: '/pemberitahuan',
    title: `${row.typeName} disahkan: ${rupiah(row.amount)}.`, body: `Alasan: ${row.reason}. ${await slipText(row.periodStart, employeeId)}.`,
  }, actorAccountId);
}

const valuesOf = (c: CheckedFree) => ({
  kind: 'TYPED', typeId: c.typeId, employeeId: c.person.id, occurredOn: c.occurredOn, periodStart: periodStartOf(c.occurredOn), kasirBranchId: null,
  branchName: c.person.branchName, baseAmount: c.amount, percent: null, amount: c.amount, fund: c.fund, note: c.reason,
});

/** Pemilik/GM mencatat langsung: lahir Disahkan. Sumber Dana Disiplin diperiksa terhadap Tersedia di transaksi berkunci. */
export async function recordFreeDirect(actor: Actor | null, input: FreeInput, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ id: number }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'bonus.approve_free')) return fail(403, 'Hanya Pemilik atau GM yang mencatat Bonus Bebas langsung; HR mengajukan usulan.');
  const result = await db.transaction(async (tx) => {
    const checked = await checkFree(tx, actor, input, todayWib(now));
    if ('ok' in checked) return checked;
    if (checked.fund === 'DISCIPLINE_FUND') {
      const short = await disciplineFundProblem(tx, checked.amount);
      if (short) return fail(409, short);
    }
    const [row] = await tx.insert(bonusEntries).values({
      ...valuesOf(checked), status: 'APPROVED', originKey: `TYPED:${randomUUID()}`,
      recordedByAccountId: actor.accountId, recordedByEmployeeId: actor.personId,
      decidedByAccountId: actor.accountId, decidedByEmployeeId: actor.personId, decidedAt: now,
    }).returning({ id: bonusEntries.id });
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'bonus_entry', entityId: row.id, action: 'bonus.record_free', before: null, after: { employeeId: checked.person.id, amount: checked.amount, fund: checked.fund, typeId: checked.typeId } });
    await tell(tx, checked.person.id, actor.accountId, row.id, { typeName: checked.typeName, amount: checked.amount, reason: checked.reason, periodStart: periodStartOf(checked.occurredOn) });
    await announce(tx, actor.accountId, { what: `mencatat ${checked.typeName} ${checked.person.name} ${rupiah(checked.amount)} (${BONUS_FUND_LABELS[checked.fund]})`, link: '/bonus/persetujuan?tab=free', entity: 'bonus_entry', entityId: row.id });
    return { ok: true as const, data: { id: row.id, employeeId: checked.person.id } };
  });
  // Orang yang slip terakhirnya sudah Dibayar: bonus ini menjadi tagihan bayar di luar slip (spec L4f §3.7).
  if (!result.ok) return result;
  await (await import('./off-slip')).syncOffSlipClaimsQuietly([result.data.employeeId]);
  return { ok: true, data: { id: result.data.id } };
}

async function loadByRequest(executor: typeof db | Tx, requestId: number) {
  const [row] = await executor.select({ entry: bonusEntries, typeName: bonusTypes.name }).from(bonusEntries)
    .leftJoin(bonusTypes, eq(bonusTypes.id, bonusEntries.typeId)).where(eq(bonusEntries.requestId, requestId));
  return row ? { ...row.entry, typeName: row.typeName ?? 'Bonus Bebas' } : null;
}

const personNameOf = async (id: number) => (await loadPayrollPeople()).find((p) => p.id === id)?.name ?? `#${id}`;

/** Usulan HR Bonus Bebas lewat Mesin Pengajuan; hanya Pemilik/GM yang mengesahkan (B1). */
export function freeBonusHandler(announce: ChangeAnnounce): RequestHandler {
  return {
    async prepare(tx, actor, input) {
      if (actor.fullAccess) return fail(400, 'Pemilik dan GM mencatat Bonus Bebas langsung.');
      const checked = await checkFree(tx, actor, input as FreeInput, todayWib());
      if ('ok' in checked) return checked;
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `${checked.typeName} ${checked.person.name} ${rupiah(checked.amount)} (${BONUS_FUND_LABELS[checked.fund]})`,
          dedupeKey: null,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            await saveTx.insert(bonusEntries).values({
              ...valuesOf(checked), status: 'PENDING', originKey: `TYPED:R${requestId}`, requestId,
              recordedByAccountId: actor.accountId, recordedByEmployeeId: actor.personId,
            });
          },
        },
      };
    },
    async apply(tx, actorAccountId, requestId) {
      const row = await loadByRequest(tx, requestId);
      if (!row || row.status !== 'PENDING') return fail(404, 'Usulan Bonus Bebas tidak ditemukan.');
      if ((await activeHrisAccounts([row.employeeId])).get(row.employeeId) === actorAccountId) return fail(403, 'Bonus Anda sendiri disahkan pemilik lain.');
      if (row.fund === 'DISCIPLINE_FUND') {
        const short = await disciplineFundProblem(tx, row.amount);
        if (short) return fail(409, `${short} Usulan tetap menunggu.`);
      }
      const done = await tx.update(bonusEntries).set({ status: 'APPROVED', decidedByAccountId: actorAccountId, decidedAt: new Date() })
        .where(and(eq(bonusEntries.id, row.id), eq(bonusEntries.status, 'PENDING'))).returning({ id: bonusEntries.id });
      if (!done.length) return fail(409, 'Bonus ini baru saja diputuskan orang lain.');
      await tell(tx, row.employeeId, actorAccountId, row.id, { typeName: row.typeName, amount: row.amount, reason: row.note ?? '-', periodStart: row.periodStart });
      const name = await personNameOf(row.employeeId);
      await announce(tx, actorAccountId, { what: `mengesahkan ${row.typeName} ${name} ${rupiah(row.amount)}`, link: '/bonus/persetujuan?tab=free', entity: 'bonus_entry', entityId: row.id });
      return { ok: true as const, effect: `${row.typeName} ${name} ${rupiah(row.amount)} disahkan, ${await slipText(row.periodStart, row.employeeId)}. ${name} diberi tahu.` };
    },
    async close(tx, _actorAccountId, requestId, reason) {
      await tx.update(bonusEntries).set({ status: 'REJECTED', reason: reason || 'Usulan ditolak atau dibatalkan.', decidedAt: new Date() })
        .where(and(eq(bonusEntries.requestId, requestId), eq(bonusEntries.status, 'PENDING')));
    },
    async effectPreview(requestId) {
      const row = await loadByRequest(db, requestId);
      if (!row) return 'Usulan ini akan disahkan.';
      const base = `${row.typeName} ${rupiah(row.amount)} untuk ${await personNameOf(row.employeeId)}, ${await slipText(row.periodStart, row.employeeId)}.`;
      if (row.fund !== 'DISCIPLINE_FUND') return `${base} Dibayar dari uang kantor.`;
      const state = await readFundState();
      return `${base} Dari Dana Disiplin: tersedia ${rupiah(state.discipline.available)}${row.amount > state.discipline.available ? ' — tidak cukup, pengesahan akan ditolak' : `, sesudah disahkan ${rupiah(state.discipline.available - row.amount)}`}.`;
    },
    async describe(requestId) {
      const row = await loadByRequest(db, requestId);
      if (!row) return [];
      return [
        { label: 'Karyawan', before: null, after: await personNameOf(row.employeeId) },
        { label: 'Jenis', before: null, after: row.typeName },
        { label: 'Tanggal', before: null, after: longDate(row.occurredOn) },
        { label: 'Nominal', before: null, after: rupiah(row.amount) },
        { label: 'Sumber dana', before: null, after: BONUS_FUND_LABELS[row.fund as BonusFund] ?? row.fund },
        { label: 'Alasan', before: null, after: row.note },
      ];
    },
    async resubmitValues(requestId) {
      const row = await loadByRequest(db, requestId);
      return row ? { employeeId: row.employeeId, typeId: row.typeId, amount: row.amount, occurredOn: row.occurredOn, fund: row.fund, reason: row.note } : null;
    },
  };
}

// ---- Layar Catat Bonus Bebas (GAJ-L22) ----

export async function freeBonusFormScreen(actor: Actor | null, now: Date = new Date()) {
  if (!hasAction(actor, 'bonus.record_free') && !hasAction(actor, 'bonus.approve_free')) return null;
  const today = todayWib(now);
  const people = (await loadPayrollPeople(today))
    .filter((p) => roleOf(p) === 'STAFF' && p.id !== actor!.personId && (actor!.fullAccess || !p.ownerOnly))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ id: p.id, name: p.name, branchName: p.branchName }));
  const types = await db.select({ id: bonusTypes.id, name: bonusTypes.name, defaultFund: bonusTypes.defaultFund }).from(bonusTypes)
    .where(eq(bonusTypes.active, true)).orderBy(asc(bonusTypes.sortOrder), asc(bonusTypes.id));
  const state = await readFundState();
  return { people, types, today, direct: Boolean(actor!.fullAccess), disciplineAvailable: state.discipline.available };
}

// ---- Jenis ketik (GAJ-L23) ----

export async function typedBonusTypes() {
  const [types, used] = await Promise.all([
    db.select().from(bonusTypes).orderBy(asc(bonusTypes.sortOrder), asc(bonusTypes.id)),
    db.select({ typeId: bonusEntries.typeId, count: sql<number>`count(*)::int` }).from(bonusEntries).where(eq(bonusEntries.kind, 'TYPED')).groupBy(bonusEntries.typeId),
  ]);
  return types.map((t) => ({ id: t.id, name: t.name, defaultFund: t.defaultFund as BonusFund, active: t.active, used: Number(used.find((u) => u.typeId === t.id)?.count ?? 0) }));
}

export async function saveBonusType(
  actor: Actor | null, input: { id?: number; name: unknown; defaultFund: unknown; active?: boolean }, announce: ChangeAnnounce,
): Promise<ServiceResult<{ id: number }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'settings.manage')) return fail(403, 'Hanya Pemilik atau GM yang mengubah Jenis Bonus.');
  const name = String(input.name ?? '').trim();
  if (name.length < 3 || name.length > 60) return fail(400, 'Nama jenis 3 sampai 60 huruf.');
  const defaultFund = input.defaultFund === 'DISCIPLINE_FUND' ? 'DISCIPLINE_FUND' : input.defaultFund === 'OFFICE' ? 'OFFICE' : null;
  if (!defaultFund) return fail(400, 'Pilih sumber dana bawaan.');
  try {
    return await db.transaction(async (tx) => {
      if (input.id) {
        const [old] = await tx.select().from(bonusTypes).where(eq(bonusTypes.id, input.id));
        if (!old) return fail(404, 'Jenis tidak ditemukan.');
        const active = input.active ?? old.active;
        await tx.update(bonusTypes).set({ name, defaultFund, active }).where(eq(bonusTypes.id, old.id));
        await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'bonus_type', entityId: old.id, action: 'bonus_type.update', before: { name: old.name, defaultFund: old.defaultFund, active: old.active }, after: { name, defaultFund, active } });
        await announce(tx, actor.accountId, { what: `mengubah jenis bonus "${name}"${active ? '' : ' (nonaktif)'}`, link: '/pengaturan/jenis-bonus', entity: 'bonus_type', entityId: old.id });
        return { ok: true as const, data: { id: old.id } };
      }
      const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${bonusTypes.sortOrder}), 0) + 1` }).from(bonusTypes);
      const [row] = await tx.insert(bonusTypes).values({ name, defaultFund, sortOrder: Number(next) }).returning({ id: bonusTypes.id });
      await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'bonus_type', entityId: row.id, action: 'bonus_type.create', before: null, after: { name, defaultFund } });
      await announce(tx, actor.accountId, { what: `menambah jenis bonus "${name}"`, link: '/pengaturan/jenis-bonus', entity: 'bonus_type', entityId: row.id });
      return { ok: true as const, data: { id: row.id } };
    });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } })?.cause ?? (error as { code?: string });
    if ((cause as { code?: string })?.code === '23505') return fail(409, 'Nama jenis itu sudah ada.');
    throw error;
  }
}
