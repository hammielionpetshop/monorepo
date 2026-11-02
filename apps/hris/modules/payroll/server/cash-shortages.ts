import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { employees } from '@petshop/hris-db/schema/employees';
import {
  cashShortageApprovals, cashShortages, manualCashShortageShares, manualCashShortages, posCashierLinks,
} from '@petshop/hris-db/schema/payroll';
import { allocateByCashShare, classifyVariance, parseCashierVarianceSettings } from '@petshop/shared/utils/cashier-variance';
import { db } from '@/lib/db';
import { getOrgLookup, hasAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { todayWib } from '@/modules/employees';
import { filesUploadedBy } from '@/modules/files';
import { notify } from '@/modules/notifications';
import type { RequestHandler } from '@/modules/requests';
import { checkReason } from '@/modules/settings';
import { netShortage, splitEvenly } from '../rules/losses';
import { longDate, periodStartOf, rupiah, type IsoDate } from '../rules/salary';
import { isPeriodLocked, periodChoices } from './attendance-pay';
import { accountNames } from './data';
import { isOwnerPerson, loadTimelines, periodEndOf, placedAt, presentFlagged } from './deduction-data';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

/**
 * Shift POS paling awal yang ditarik ke HRIS. Diset ke periode 26 September 2026 supaya alur pengesahan bisa
 * diuji di staging dengan data nyata; sebelum produksi diganti ke periode gaji HRIS pertama (spec L4c §11).
 */
export const CASH_SHORTAGE_FROM: IsoDate = '2026-09-26';

const CATEGORY_LABELS = { MINUS: 'Minus', PLUS: 'Lebih', ANOMALY: 'Tak wajar — periksa dulu', TOLERATED: 'Kini dalam toleransi' } as const;
export const APPROVAL_STATUS_LABELS = { OPEN: 'Menunggu tinjauan HR', REVIEWED: 'Ditinjau HR, menunggu Pemilik/GM', APPROVED: 'Disahkan' } as const;
type ApprovalStatus = keyof typeof APPROVAL_STATUS_LABELS;

// ---- Tautan akun kasir ----

async function activeLinks(executor: typeof db | Tx = db): Promise<Map<number, number>> {
  const rows = await executor.select({ posUserId: posCashierLinks.posUserId, employeeId: posCashierLinks.employeeId })
    .from(posCashierLinks).where(isNull(posCashierLinks.releasedAt));
  return new Map(rows.map((r) => [r.posUserId, r.employeeId]));
}

// ---- Mesin cash-shortage-sync (spec L4c §3.3, §6) ----

type ShiftRow = { shift_id: number; shift_number: number; kasir_branch_id: number; kasir_branch_name: string; closed_on: string; variance: number | null };

/** Salin bagian kasir dari view POS (idempoten), lalu buat usulan per orang untuk periode yang sudah lewat. */
export async function syncCashShortages(now: Date = new Date(), options: { includeCurrentFor?: number } = {}) {
  const today = todayWib(now);
  const [settingRow] = await db.execute<{ value: string }>(sql`select value from hris.pos_cashier_variance_settings`);
  const settings = parseCashierVarianceSettings(settingRow?.value ?? null);
  const shifts = await db.execute<ShiftRow>(sql`
    select shift_id, shift_number, kasir_branch_id, kasir_branch_name, closed_on::text as closed_on, variance
    from hris.pos_shift_variances where closed_on >= ${CASH_SHORTAGE_FROM}::date`);
  const ids = shifts.map((s) => Number(s.shift_id));
  const shareRows = ids.length
    ? await db.execute<{ shift_id: number; pos_user_id: number; cash: string }>(sql`
        select shift_id, pos_user_id, cash::text as cash from hris.pos_shift_cash_shares
        where shift_id in ${sql.raw(`(${ids.join(',')})`)}`)
    : [];
  const sharesByShift = new Map<number, { cashierId: number; cash: number }[]>();
  for (const r of shareRows) {
    const list = sharesByShift.get(Number(r.shift_id)) ?? [];
    list.push({ cashierId: Number(r.pos_user_id), cash: Number(r.cash) });
    sharesByShift.set(Number(r.shift_id), list);
  }
  const existing = await db.select().from(cashShortages);
  const byKey = new Map(existing.map((r) => [`${r.posShiftId}:${r.posUserId}`, r]));
  let inserted = 0;
  let updated = 0;
  let flagged = 0;
  for (const shift of shifts) {
    const variance = shift.variance == null ? null : Number(shift.variance);
    const category = classifyVariance(variance, settings);
    const shares = sharesByShift.get(Number(shift.shift_id)) ?? [];
    const wanted = category === 'MINUS' || category === 'PLUS'
      ? allocateByCashShare(variance as number, shares).filter((a) => a.amount !== 0)
      : category === 'ANOMALY' ? allocateByCashShare(0, shares).filter((a) => a.cash > 0) : [];
    const keep = new Set<string>();
    for (const a of wanted) {
      const key = `${shift.shift_id}:${a.cashierId}`;
      keep.add(key);
      const values = {
        posShiftNumber: Number(shift.shift_number), kasirBranchId: Number(shift.kasir_branch_id), kasirBranchName: String(shift.kasir_branch_name),
        closedOn: String(shift.closed_on), category, shiftVariance: variance, cash: a.cash, shareTenths: Math.round(a.sharePct * 10),
        amount: category === 'ANOMALY' ? 0 : a.amount,
      };
      const old = byKey.get(key);
      if (!old) {
        await db.insert(cashShortages).values({ posShiftId: Number(shift.shift_id), posUserId: a.cashierId, ...values });
        inserted += 1;
        continue;
      }
      const changed = old.amount !== values.amount || old.category !== values.category || old.closedOn !== values.closedOn;
      if (!changed) continue;
      const approval = old.approvalId ? (await db.select().from(cashShortageApprovals).where(eq(cashShortageApprovals.id, old.approvalId)))[0] : null;
      if (approval?.status === 'APPROVED') {
        // Angka yang sudah disahkan tidak ditimpa diam-diam: catat angka POS terbaru untuk ditinjau ulang.
        const note = `Angka POS berubah menjadi ${rupiah(values.amount)} (${CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}).`;
        if (old.posChangedNote !== note) { await db.update(cashShortages).set({ posChangedNote: note }).where(eq(cashShortages.id, old.id)); flagged += 1; }
        continue;
      }
      await db.update(cashShortages).set({ ...values, syncedAt: new Date() }).where(eq(cashShortages.id, old.id));
      updated += 1;
    }
    // Baris lama yang kini dalam toleransi/cocok: dikosongkan bila belum disahkan.
    for (const old of existing.filter((r) => r.posShiftId === Number(shift.shift_id) && !keep.has(`${r.posShiftId}:${r.posUserId}`) && r.amount !== 0)) {
      const approval = old.approvalId ? (await db.select().from(cashShortageApprovals).where(eq(cashShortageApprovals.id, old.approvalId)))[0] : null;
      if (approval?.status === 'APPROVED') {
        await db.update(cashShortages).set({ posChangedNote: 'Angka POS berubah: shift ini kini tidak dibebankan.' }).where(eq(cashShortages.id, old.id));
        flagged += 1;
      } else {
        await db.update(cashShortages).set({ amount: 0, category: 'TOLERATED', syncedAt: new Date() }).where(eq(cashShortages.id, old.id));
        updated += 1;
      }
    }
  }
  const proposals = await createApprovals(today, options.includeCurrentFor ?? null);
  return { shifts: shifts.length, inserted, updated, flagged, proposals };
}

/** Usulan per orang per periode untuk baris minus/plus yang belum masuk usulan (periode lewat, atau berjalan bila diminta). */
async function createApprovals(today: IsoDate, includeCurrentFor: number | null) {
  const links = await activeLinks();
  const loose = await db.select().from(cashShortages)
    .where(and(isNull(cashShortages.approvalId), inArray(cashShortages.category, ['MINUS', 'PLUS'])));
  const groups = new Map<string, number[]>();
  for (const row of loose) {
    const employeeId = links.get(row.posUserId);
    if (!employeeId) continue;
    const start = periodStartOf(row.closedOn);
    const ended = periodEndOf(start) < today;
    if (!ended && includeCurrentFor !== employeeId) continue;
    const key = `${employeeId}:${start}`;
    groups.set(key, [...(groups.get(key) ?? []), row.id]);
  }
  let created = 0;
  for (const [key, rowIds] of groups) {
    const [employeeIdText, periodStart] = key.split(':');
    const employeeId = Number(employeeIdText);
    await db.transaction(async (tx) => {
      const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${cashShortageApprovals.sequence}), 0) + 1` }).from(cashShortageApprovals)
        .where(and(eq(cashShortageApprovals.employeeId, employeeId), eq(cashShortageApprovals.periodStart, periodStart)));
      const [approval] = await tx.insert(cashShortageApprovals).values({ employeeId, periodStart, sequence: Number(next) }).returning({ id: cashShortageApprovals.id });
      await tx.update(cashShortages).set({ approvalId: approval.id }).where(and(inArray(cashShortages.id, rowIds), isNull(cashShortages.approvalId)));
    });
    created += 1;
  }
  return created;
}

export async function runCashShortageSync() {
  return syncCashShortages();
}

// ---- Tinjau dan sahkan usulan minus POS ----

async function loadApproval(id: number) {
  const [row] = await db.select().from(cashShortageApprovals).where(eq(cashShortageApprovals.id, id));
  return row ?? null;
}

export async function reviewApproval(actor: Actor | null, id: number, announce: ChangeAnnounce): Promise<ServiceResult<object>> {
  if (!hasAction(actor, 'cash_shortage.review')) return fail(403, 'Anda tidak berhak meninjau usulan minus kas.');
  const approval = await loadApproval(id);
  if (!approval || approval.status !== 'OPEN') return fail(409, 'Usulan ini sudah ditinjau atau disahkan.');
  if (approval.employeeId === actor!.personId) return fail(403, 'Minus kas Anda sendiri ditinjau orang lain.');
  return db.transaction(async (tx) => {
    await tx.update(cashShortageApprovals).set({ status: 'REVIEWED', reviewedByAccountId: actor!.accountId, reviewedAt: new Date() })
      .where(and(eq(cashShortageApprovals.id, id), eq(cashShortageApprovals.status, 'OPEN')));
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'cash_shortage_approval', entityId: id, action: 'cash_shortage.review', before: { status: 'OPEN' }, after: { status: 'REVIEWED' } });
    const [person] = await tx.select({ name: employees.name }).from(employees).where(eq(employees.id, approval.employeeId));
    await announce(tx, actor!.accountId, { what: `meninjau minus kas ${person?.name ?? ''} periode ${longDate(approval.periodStart)}; menunggu pengesahan`, link: `/potongan/minus-kas?periode=${approval.periodStart}`, entity: 'cash_shortage_approval', entityId: id });
    return { ok: true as const, data: {} };
  });
}

/** Pemilik/GM mengesahkan; boleh meniadakan shift tertentu dengan alasan (spec L4c §9 butir 5). */
export async function approveApproval(
  actor: Actor | null, id: number, waivers: { rowId: number; reason: string }[], announce: ChangeAnnounce, now: Date = new Date(),
): Promise<ServiceResult<{ net: number }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'deduction.approve')) return fail(403, 'Hanya Pemilik atau GM yang mengesahkan minus kas.');
  const approval = await loadApproval(id);
  if (!approval || approval.status === 'APPROVED') return fail(409, 'Usulan ini sudah disahkan.');
  if (approval.employeeId === actor.personId) return fail(403, 'Minus kas Anda sendiri disahkan Pemilik lain atau GM.');
  if (await isPeriodLocked(approval.periodStart)) return fail(409, 'Slip periode itu sudah ditutup.');
  const rows = await db.select().from(cashShortages).where(eq(cashShortages.approvalId, id));
  for (const w of waivers) {
    if (!rows.some((r) => r.id === w.rowId)) return fail(400, 'Shift yang ditiadakan tidak ada di usulan ini.');
    const checked = await checkReason(w.reason, 'Alasan meniadakan shift');
    if (!checked.ok) return fail(400, checked.error);
  }
  const waived = new Map(waivers.map((w) => [w.rowId, w.reason.trim()]));
  const result = netShortage(rows.map((r) => ({ amount: r.amount, waived: waived.has(r.id) })));
  const owner = await isOwnerPerson(approval.employeeId, todayWib(now));
  return db.transaction(async (tx) => {
    const done = await tx.update(cashShortageApprovals).set({ status: 'APPROVED', approvedByAccountId: actor.accountId, approvedByEmployeeId: actor.personId, approvedAt: now })
      .where(and(eq(cashShortageApprovals.id, id), inArray(cashShortageApprovals.status, ['OPEN', 'REVIEWED']))).returning({ id: cashShortageApprovals.id });
    if (!done.length) return fail(409, 'Usulan ini baru saja disahkan orang lain.');
    for (const [rowId, reason] of waived) {
      await tx.update(cashShortages).set({ waivedAt: now, waivedByAccountId: actor.accountId, waiveReason: reason }).where(eq(cashShortages.id, rowId));
    }
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'cash_shortage_approval', entityId: id, action: 'cash_shortage.approve', before: { status: approval.status }, after: { status: 'APPROVED', net: result.net, waived: [...waived.keys()] } });
    const [person] = await tx.select({ name: employees.name }).from(employees).where(eq(employees.id, approval.employeeId));
    const account = (await activeHrisAccounts([approval.employeeId])).get(approval.employeeId);
    if (account && !owner) {
      await notify(tx, [account], {
        kind: 'cash_shortage.approved',
        title: `Minus kas periode ${longDate(approval.periodStart)} disahkan: ${rupiah(result.net)}.`,
        body: `Dari ${rows.length - waived.size} shift POS (minus ${rupiah(result.minus)}, lebih ${rupiah(result.plus)}). Dipotong di slip periode itu. Bila tidak setuju, ajukan keberatan paling lambat 3 hari (pukul 23.59).`,
        link: `/keberatan-potongan/ajukan?jenis=CASH_SHORTAGE&id=${id}`, entity: 'cash_shortage_approval', entityId: id,
      }, actor.accountId);
    }
    await announce(tx, actor.accountId, { what: `mengesahkan minus kas ${person?.name ?? ''} periode ${longDate(approval.periodStart)} (${rupiah(result.net)})`, link: `/potongan/minus-kas?periode=${approval.periodStart}`, entity: 'cash_shortage_approval', entityId: id });
    return { ok: true as const, data: { net: owner ? 0 : result.net } };
  });
}

/** "Usulkan sekarang" untuk periode berjalan satu orang (mis. berhenti di tengah periode); spec L4c §11. */
export async function proposeNow(actor: Actor | null, employeeId: number, now: Date = new Date()): Promise<ServiceResult<{ proposals: number }>> {
  if (!hasAction(actor, 'cash_shortage.review')) return fail(403, 'Anda tidak berhak membuat usulan minus kas.');
  const result = await syncCashShortages(now, { includeCurrentFor: employeeId });
  return { ok: true, data: { proposals: result.proposals } };
}

// ---- Tautan Akun Kasir ----

export async function linkPosUser(actor: Actor | null, posUserId: number, employeeId: number): Promise<ServiceResult<object>> {
  if (!hasAction(actor, 'cash_shortage.review')) return fail(403, 'Anda tidak berhak menautkan akun kasir.');
  const [person] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, employeeId));
  if (!person) return fail(404, 'Karyawan tidak ditemukan.');
  const [pos] = await db.execute<{ id: number }>(sql`select id from hris.pos_users where id = ${posUserId}`);
  if (!pos) return fail(404, 'Akun kasir tidak ditemukan.');
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx.insert(posCashierLinks).values({ posUserId, employeeId, createdByAccountId: actor!.accountId }).returning({ id: posCashierLinks.id });
      await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'pos_cashier_link', entityId: row.id, action: 'pos_cashier_link.create', before: null, after: { posUserId, employeeId } });
    });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } })?.cause ?? (error as { code?: string });
    if ((cause as { code?: string })?.code === '23505') return fail(409, 'Akun kasir ini sudah ditautkan ke orang lain. Lepas dulu tautannya.');
    throw error;
  }
  return { ok: true, data: {} };
}

export async function unlinkPosUser(actor: Actor | null, posUserId: number, reasonInput: unknown): Promise<ServiceResult<object>> {
  if (!hasAction(actor, 'cash_shortage.review')) return fail(403, 'Anda tidak berhak melepas tautan akun kasir.');
  const reason = await checkReason(reasonInput, 'Alasan melepas');
  if (!reason.ok) return fail(400, reason.error);
  return db.transaction(async (tx) => {
    const done = await tx.update(posCashierLinks).set({ releasedAt: new Date(), releasedByAccountId: actor!.accountId, releaseReason: reason.reason })
      .where(and(eq(posCashierLinks.posUserId, posUserId), isNull(posCashierLinks.releasedAt))).returning({ id: posCashierLinks.id });
    if (!done.length) return fail(404, 'Tautan tidak ditemukan.');
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'pos_cashier_link', entityId: done[0].id, action: 'pos_cashier_link.release', before: { posUserId }, after: null, reason: reason.reason });
    return { ok: true as const, data: {} };
  });
}

const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export async function cashierLinksScreen(actor: Actor | null) {
  if (!hasAction(actor, 'cash_shortage.view') && !hasAction(actor, 'deduction.approve')) return null;
  const [users, links, people, used, loginLinks] = await Promise.all([
    db.execute<{ id: number; name: string; username: string | null; active: boolean }>(sql`select id, name, username, active from hris.pos_users order by name`),
    activeLinks(),
    db.select({ id: employees.id, name: employees.name }).from(employees).orderBy(asc(employees.name)),
    db.selectDistinct({ posUserId: cashShortages.posUserId }).from(cashShortages),
    db.execute<{ employee_id: number; pos_user_id: number }>(sql`
      select h.local_user_id as employee_id, b.local_user_id as pos_user_id
      from auth.account_links h join auth.account_links b on b.account_id = h.account_id and b.app_code = 'backoffice' and b.revoked_at is null
      where h.app_code = 'hris' and h.revoked_at is null`),
  ]);
  const usedIds = new Set(used.map((u) => u.posUserId));
  const byName = new Map(people.map((p) => [nameKey(p.name), p]));
  const rows = users.map((u) => {
    const linked = links.get(Number(u.id));
    const viaLogin = loginLinks.find((l) => Number(l.pos_user_id) === Number(u.id));
    const suggestion = viaLogin ? people.find((p) => p.id === Number(viaLogin.employee_id)) : byName.get(nameKey(String(u.name)));
    return {
      posUserId: Number(u.id), name: String(u.name), username: u.username, active: Boolean(u.active), hasShortages: usedIds.has(Number(u.id)),
      linkedTo: linked ? people.find((p) => p.id === linked) ?? null : null,
      suggestion: !linked && suggestion ? { ...suggestion, via: viaLogin ? 'tautan login' : 'nama sama' } : null,
    };
  }).filter((r) => r.hasShortages || r.linkedTo || r.active);
  return { rows, people, canManage: hasAction(actor, 'cash_shortage.review') };
}

// ---- Minus kas catat tangan (GAJ-79) ----

type ManualInput = { branchId: unknown; occurredOn: unknown; amount: unknown; reason: unknown; namedEmployeeId: unknown; attachmentId: unknown };
type CheckedManual = { branchId: number; branchName: string; occurredOn: IsoDate; amount: number; reason: string; namedEmployeeId: number | null; attachmentId: string | null };

async function checkManual(tx: Tx, actor: Actor, input: ManualInput, today: IsoDate): Promise<CheckedManual | Fail> {
  const org = await getOrgLookup();
  const branch = org.branches.find((b) => b.id === Number(input.branchId) && b.active);
  if (!branch) return fail(400, 'Pilih cabang.');
  const occurredOn = String(input.occurredOn ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn) || occurredOn > today) return fail(400, 'Tanggal kejadian tidak boleh kosong atau di masa depan.');
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000_000) return fail(400, 'Nilai harus rupiah bulat lebih dari 0.');
  const reason = String(input.reason ?? '').trim();
  if (reason.length < 15) return fail(400, 'Alasan paling sedikit 15 huruf dan menjelaskan kenapa tidak lewat shift POS.');
  if (await isPeriodLocked(periodStartOf(occurredOn))) return fail(409, 'Slip periode itu sudah ditutup.');
  const named = input.namedEmployeeId == null || input.namedEmployeeId === '' ? null : Number(input.namedEmployeeId);
  if (named != null) {
    if (named === actor.personId) return fail(403, 'Anda tidak bisa mencatat minus kas atas nama diri sendiri.');
    const placed = (await placedAt(branch.id, occurredOn)).some((p) => p.employeeId === named);
    const present = (await presentFlagged(branch.id, occurredOn)).some((p) => p.employeeId === named);
    if (!placed && !present) return fail(400, 'Orang itu tidak ditempatkan dan tidak hadir di cabang ini pada tanggal itu.');
    if (await isOwnerPerson(named, occurredOn)) return fail(400, 'Pemilik dan GM tidak menanggung potongan (GAJ-09).');
  } else if (!(await presentFlagged(branch.id, occurredOn)).length) {
    return fail(409, 'Tidak ada yang hadir. Pilih nama penanggung, atau batalkan.');
  }
  const attachmentId = input.attachmentId ? String(input.attachmentId) : null;
  if (attachmentId && !(await filesUploadedBy(tx, actor.accountId, [attachmentId])).length) return fail(400, 'Lampiran tidak ditemukan. Unggah ulang fotonya.');
  return { branchId: branch.id, branchName: branch.name, occurredOn, amount, reason, namedEmployeeId: named, attachmentId };
}

/** Bekukan penanggung saat Berlaku: bernama satu orang; tanpa nama dibagi rata ke yang hadir. */
async function activateManual(tx: Tx, row: { id: number; branchId: number; occurredOn: IsoDate; amount: number; namedEmployeeId: number | null; reason: string }, branchName: string, actorAccountId: number) {
  const shares = row.namedEmployeeId != null
    ? [{ employeeId: row.namedEmployeeId, amount: row.amount }]
    : splitEvenly(row.amount, (await presentFlagged(row.branchId, row.occurredOn, tx)).map((p) => p.employeeId)).shares;
  if (!shares.length) return fail(409, 'Tidak ada yang hadir di cabang itu pada tanggal itu. Tolak, lalu catat dengan nama penanggung.');
  await tx.insert(manualCashShortageShares).values(shares.map((s) => ({ manualCashShortageId: row.id, ...s })));
  const accounts = await activeHrisAccounts(shares.map((s) => s.employeeId));
  for (const share of shares) {
    const account = accounts.get(share.employeeId);
    if (!account) continue;
    await notify(tx, [account], {
      kind: 'manual_cash_shortage.active',
      title: `Minus kas ${branchName} ${longDate(row.occurredOn)}: bagian Anda ${rupiah(share.amount)}.`,
      body: row.namedEmployeeId != null ? `Alasan: ${row.reason}. Bila tidak setuju, ajukan keberatan paling lambat 3 hari (pukul 23.59).` : `Alasan: ${row.reason}`,
      link: row.namedEmployeeId != null ? `/keberatan-potongan/ajukan?jenis=MANUAL_CASH_SHORTAGE&id=${row.id}` : '/panduan/aturan-potongan', entity: 'manual_cash_shortage', entityId: row.id,
    }, actorAccountId);
  }
  return null;
}

export async function recordManualDirect(actor: Actor | null, input: ManualInput, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ id: number }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'deduction.approve')) return fail(403, 'Hanya Pemilik atau GM yang mencatat langsung; HR dan Finance mencatat sebagai usulan.');
  try {
    return await db.transaction(async (tx) => {
      const checked = await checkManual(tx, actor, input, todayWib(now));
      if ('ok' in checked) return checked;
      const [row] = await tx.insert(manualCashShortages).values({
        branchId: checked.branchId, occurredOn: checked.occurredOn, amount: checked.amount, reason: checked.reason, namedEmployeeId: checked.namedEmployeeId,
        attachmentFileId: checked.attachmentId, status: 'ACTIVE', recordedByAccountId: actor.accountId, recordedByEmployeeId: actor.personId,
        approvedByAccountId: actor.accountId, approvedAt: now,
      }).returning({ id: manualCashShortages.id });
      const problem = await activateManual(tx, { id: row.id, ...checked }, checked.branchName, actor.accountId);
      if (problem) throw new Rollback(problem);
      await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'manual_cash_shortage', entityId: row.id, action: 'manual_cash_shortage.create', before: null, after: { ...checked, status: 'ACTIVE' } });
      await announce(tx, actor.accountId, { what: `mencatat minus kas ${rupiah(checked.amount)} di ${checked.branchName} (${longDate(checked.occurredOn)})`, link: '/potongan/minus-kas?tab=manual', entity: 'manual_cash_shortage', entityId: row.id });
      return { ok: true as const, data: { id: row.id } };
    });
  } catch (error) {
    if (error instanceof Rollback) return error.result;
    throw error;
  }
}

class Rollback extends Error {
  constructor(readonly result: Fail) { super(result.error); }
}

async function loadManual(executor: typeof db | Tx, by: { id?: number; requestId?: number }) {
  const [row] = await executor.select().from(manualCashShortages)
    .where(by.id != null ? eq(manualCashShortages.id, by.id) : eq(manualCashShortages.requestId, by.requestId ?? -1));
  return row ?? null;
}

const branchNameOf = async (branchId: number) => (await getOrgLookup()).branches.find((b) => b.id === branchId)?.name ?? `Cabang #${branchId}`;
const personName = async (id: number | null) => (id == null ? null : (await db.select({ name: employees.name }).from(employees).where(eq(employees.id, id)))[0]?.name ?? `#${id}`);

export function manualCashShortageHandler(announce: ChangeAnnounce): RequestHandler {
  return {
    async prepare(tx, actor, input) {
      if (actor.fullAccess) return fail(400, 'Pemilik dan GM mencatat minus kas langsung.');
      const checked = await checkManual(tx, actor, input as ManualInput, todayWib());
      if ('ok' in checked) return checked;
      const who = checked.namedEmployeeId != null ? await personName(checked.namedEmployeeId) : 'tanpa nama';
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `Minus kas ${rupiah(checked.amount)} di ${checked.branchName} (${longDate(checked.occurredOn)}), ${who}`,
          dedupeKey: null,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            await saveTx.insert(manualCashShortages).values({
              branchId: checked.branchId, occurredOn: checked.occurredOn, amount: checked.amount, reason: checked.reason, namedEmployeeId: checked.namedEmployeeId,
              attachmentFileId: checked.attachmentId, status: 'PENDING', requestId, recordedByAccountId: actor.accountId, recordedByEmployeeId: actor.personId,
            });
          },
        },
      };
    },
    async apply(tx, actorAccountId, requestId) {
      const row = await loadManual(tx, { requestId });
      if (!row || row.status !== 'PENDING') return fail(404, 'Usulan minus kas tidak ditemukan.');
      if (await isPeriodLocked(periodStartOf(row.occurredOn))) return fail(409, 'Slip periode itu sudah ditutup.');
      await tx.update(manualCashShortages).set({ status: 'ACTIVE', approvedByAccountId: actorAccountId, approvedAt: new Date() }).where(eq(manualCashShortages.id, row.id));
      const branchName = await branchNameOf(row.branchId);
      const problem = await activateManual(tx, row, branchName, actorAccountId);
      if (problem) return problem;
      await announce(tx, actorAccountId, { what: `mengesahkan minus kas ${rupiah(row.amount)} di ${branchName}`, link: '/potongan/minus-kas?tab=manual', entity: 'manual_cash_shortage', entityId: row.id });
      return { ok: true as const, effect: 'Minus kas berlaku. Penanggung diberi tahu bagiannya.' };
    },
    async close(tx, _actorAccountId, requestId) {
      await tx.update(manualCashShortages).set({ status: 'REJECTED' }).where(and(eq(manualCashShortages.requestId, requestId), eq(manualCashShortages.status, 'PENDING')));
    },
    async effectPreview(requestId) {
      const row = await loadManual(db, { requestId });
      if (!row) return 'Usulan ini akan disahkan.';
      if (row.namedEmployeeId != null) return `${await personName(row.namedEmployeeId)} menanggung ${rupiah(row.amount)} dan diberi tahu.`;
      const present = await presentFlagged(row.branchId, row.occurredOn);
      const split = splitEvenly(row.amount, present.map((p) => p.employeeId));
      return present.length ? `Dibagi rata ke ${present.map((p) => p.name).join(', ')}: masing-masing ${rupiah(split.shares[0]?.amount ?? 0)}.` : 'Tidak ada yang hadir; usulan ini tidak bisa disahkan.';
    },
    async describe(requestId) {
      const row = await loadManual(db, { requestId });
      if (!row) return [];
      return [
        { label: 'Cabang', before: null, after: await branchNameOf(row.branchId) },
        { label: 'Tanggal kejadian', before: null, after: longDate(row.occurredOn) },
        { label: 'Nilai', before: null, after: rupiah(row.amount) },
        { label: 'Penanggung', before: null, after: row.namedEmployeeId != null ? await personName(row.namedEmployeeId) : 'Tanpa nama (dibagi rata ke yang hadir)' },
        { label: 'Alasan', before: null, after: row.reason },
      ];
    },
    async resubmitValues(requestId) {
      const row = await loadManual(db, { requestId });
      return row ? { branchId: row.branchId, occurredOn: row.occurredOn, amount: row.amount, reason: row.reason, namedEmployeeId: row.namedEmployeeId } : null;
    },
  };
}

export async function cancelManual(actor: Actor | null, id: number, reasonInput: unknown, announce: ChangeAnnounce): Promise<ServiceResult<object>> {
  if (!actor?.fullAccess || !hasAction(actor, 'deduction.approve')) return fail(403, 'Hanya Pemilik atau GM yang bisa membatalkan.');
  const reason = await checkReason(reasonInput, 'Alasan membatalkan');
  if (!reason.ok) return fail(400, reason.error);
  const row = await loadManual(db, { id });
  if (!row || row.status !== 'ACTIVE') return fail(404, 'Minus kas yang berlaku tidak ditemukan.');
  if (await isPeriodLocked(periodStartOf(row.occurredOn))) return fail(409, 'Sudah masuk slip yang ditutup. Koreksinya lewat slip berikutnya.');
  const shares = await db.select().from(manualCashShortageShares).where(eq(manualCashShortageShares.manualCashShortageId, id));
  return db.transaction(async (tx) => {
    const done = await tx.update(manualCashShortages).set({ status: 'CANCELLED', cancelledAt: new Date(), cancelledByAccountId: actor.accountId, cancelReason: reason.reason })
      .where(and(eq(manualCashShortages.id, id), eq(manualCashShortages.status, 'ACTIVE'))).returning({ id: manualCashShortages.id });
    if (!done.length) return fail(409, 'Minus kas ini baru saja diubah orang lain.');
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'manual_cash_shortage', entityId: id, action: 'manual_cash_shortage.cancel', before: { status: 'ACTIVE' }, after: { status: 'CANCELLED' }, reason: reason.reason });
    const accounts = await activeHrisAccounts(shares.map((s) => s.employeeId));
    await notify(tx, [...accounts.values()], { kind: 'manual_cash_shortage.cancelled', title: `Minus kas ${longDate(row.occurredOn)} dibatalkan; tidak dipotong.`, entity: 'manual_cash_shortage', entityId: id }, actor.accountId);
    await announce(tx, actor.accountId, { what: `membatalkan minus kas ${rupiah(row.amount)} (${longDate(row.occurredOn)})`, link: '/potongan/minus-kas?tab=manual', entity: 'manual_cash_shortage', entityId: id });
    return { ok: true as const, data: {} };
  });
}

/** Siapa yang akan menanggung minus tanpa nama / boleh dipilih bernama (langkah 3 Catat Minus Kas). */
export async function manualCandidates(actor: Actor | null, branchId: number, date: IsoDate) {
  if (!hasAction(actor, 'cash_shortage.record') && !hasAction(actor, 'deduction.approve')) return fail(403, 'Anda tidak berhak mencatat minus kas.');
  const timelines = await loadTimelines();
  const [present, placed] = await Promise.all([presentFlagged(branchId, date), placedAt(branchId, date, timelines)]);
  const named = new Map<number, string>();
  for (const p of [...placed, ...present]) named.set(p.employeeId, p.name);
  return { ok: true as const, data: { present, named: [...named].map(([employeeId, name]) => ({ employeeId, name })).sort((a, b) => a.name.localeCompare(b.name)) } };
}

// ---- Layar Minus Kas (GAJ-L15) ----

export async function cashShortageScreen(actor: Actor | null, input: { period: string | null }, now: Date = new Date()) {
  if (!hasAction(actor, 'cash_shortage.view') && !hasAction(actor, 'deduction.approve')) return null;
  const today = todayWib(now);
  const periods = periodChoices(today);
  const period = periods.find((p) => p.start === input.period) ?? periods[0];
  const [rows, links, people, names, manual, org] = await Promise.all([
    db.select().from(cashShortages).where(and(gte(cashShortages.closedOn, period.start), lte(cashShortages.closedOn, period.end))).orderBy(asc(cashShortages.closedOn), asc(cashShortages.posShiftNumber)),
    activeLinks(),
    db.select({ id: employees.id, name: employees.name }).from(employees),
    accountNames(),
    db.select().from(manualCashShortages).where(and(gte(manualCashShortages.occurredOn, period.start), lte(manualCashShortages.occurredOn, period.end))).orderBy(desc(manualCashShortages.occurredOn)),
    getOrgLookup(),
  ]);
  const posNames = new Map((await db.execute<{ id: number; name: string }>(sql`select id, name from hris.pos_users`)).map((u) => [Number(u.id), String(u.name)]));
  const approvalIds = [...new Set(rows.map((r) => r.approvalId).filter((x): x is number => x != null))];
  const approvals = approvalIds.length ? await db.select().from(cashShortageApprovals).where(inArray(cashShortageApprovals.id, approvalIds)) : [];
  const nameOf = (id: number) => people.find((p) => p.id === id)?.name ?? `#${id}`;
  const shiftRow = (r: typeof rows[number]) => ({
    id: r.id, posShiftId: r.posShiftId, shiftNumber: r.posShiftNumber, branchName: r.kasirBranchName, closedOn: r.closedOn, category: r.category as keyof typeof CATEGORY_LABELS,
    shiftVariance: r.shiftVariance, cash: r.cash, sharePct: r.shareTenths / 10, amount: r.amount, posUser: posNames.get(r.posUserId) ?? `#${r.posUserId}`,
    waiveReason: r.waiveReason, posChangedNote: r.posChangedNote,
  });
  // Kelompok per orang (lewat tautan): usulan + baris yang belum masuk usulan.
  const persons = new Map<number, { employeeId: number; name: string; rows: ReturnType<typeof shiftRow>[]; approvals: { id: number; sequence: number; status: ApprovalStatus; rowIds: number[]; reviewedBy: string | null; approvedBy: string | null }[] }>();
  const unlinked: ReturnType<typeof shiftRow>[] = [];
  const anomalies: ReturnType<typeof shiftRow>[] = [];
  for (const r of rows) {
    if (r.category === 'ANOMALY') { anomalies.push(shiftRow(r)); continue; }
    if (r.category === 'TOLERATED' && !r.approvalId) continue;
    const approval = approvals.find((a) => a.id === r.approvalId);
    const employeeId = approval?.employeeId ?? links.get(r.posUserId);
    if (!employeeId) { unlinked.push(shiftRow(r)); continue; }
    const group = persons.get(employeeId) ?? { employeeId, name: nameOf(employeeId), rows: [], approvals: [] };
    group.rows.push(shiftRow(r));
    if (approval && !group.approvals.some((a) => a.id === approval.id)) {
      group.approvals.push({
        id: approval.id, sequence: approval.sequence, status: approval.status as ApprovalStatus, rowIds: [],
        reviewedBy: approval.reviewedByAccountId ? names.get(approval.reviewedByAccountId) ?? '-' : null,
        approvedBy: approval.approvedByAccountId ? names.get(approval.approvedByAccountId) ?? '-' : null,
      });
    }
    if (approval) group.approvals.find((a) => a.id === approval.id)?.rowIds.push(r.id);
    persons.set(employeeId, group);
  }
  const groups = [...persons.values()].map((g) => {
    const approvedRows = rows.filter((r) => g.approvals.some((a) => a.status === 'APPROVED' && a.id === r.approvalId));
    const all = netShortage(g.rows.map((r) => ({ amount: r.amount, waived: r.waiveReason != null })));
    return {
      ...g, approvals: g.approvals.sort((a, b) => a.sequence - b.sequence),
      pendingRowCount: g.rows.filter((r) => !rows.find((x) => x.id === r.id)?.approvalId).length,
      net: all.net, minus: all.minus, plus: all.plus,
      approvedNet: netShortage(approvedRows.map((r) => ({ amount: r.amount, waived: r.waiveReason != null }))).net,
    };
  }).sort((a, b) => b.minus - a.minus || a.name.localeCompare(b.name));
  return {
    period, periods, today, periodEnded: period.end < today,
    groups, unlinked, anomalies,
    manual: await Promise.all(manual.map(async (m) => ({
      id: m.id, branchName: org.branches.find((b) => b.id === m.branchId)?.name ?? '-', occurredOn: m.occurredOn, amount: m.amount, reason: m.reason,
      named: m.namedEmployeeId != null ? nameOf(m.namedEmployeeId) : null, status: m.status, requestId: m.requestId,
      recordedBy: names.get(m.recordedByAccountId) ?? '-',
      shares: m.status === 'ACTIVE' ? (await db.select().from(manualCashShortageShares).where(eq(manualCashShortageShares.manualCashShortageId, m.id))).map((s) => ({ name: nameOf(s.employeeId), amount: s.amount })) : [],
    }))),
    can: {
      review: hasAction(actor, 'cash_shortage.review'),
      approve: !!actor?.fullAccess && hasAction(actor, 'deduction.approve'),
      record: hasAction(actor, 'cash_shortage.record') || hasAction(actor, 'deduction.approve'),
    },
    me: actor?.personId ?? null,
    labels: { category: CATEGORY_LABELS, approval: APPROVAL_STATUS_LABELS },
    branches: org.branches.filter((b) => b.active).map(({ id, name }) => ({ id, name })),
  };
}

/** Rupiah minus kas (POS + catat tangan) satu orang satu periode, untuk tab Potongan/slip (L4c-2, 4E-5a). */
export async function shortageAmountsOf(employeeId: number, periodStart: IsoDate) {
  const end = periodEndOf(periodStart);
  const approved = await db.select({ amount: cashShortages.amount, waivedAt: cashShortages.waivedAt })
    .from(cashShortages).innerJoin(cashShortageApprovals, eq(cashShortageApprovals.id, cashShortages.approvalId))
    .where(and(eq(cashShortageApprovals.employeeId, employeeId), eq(cashShortageApprovals.status, 'APPROVED'), gte(cashShortages.closedOn, periodStart), lte(cashShortages.closedOn, end)));
  const manual = await db.select({ amount: manualCashShortageShares.amount, occurredOn: manualCashShortages.occurredOn, id: manualCashShortages.id, reason: manualCashShortages.reason })
    .from(manualCashShortageShares).innerJoin(manualCashShortages, eq(manualCashShortages.id, manualCashShortageShares.manualCashShortageId))
    .where(and(eq(manualCashShortageShares.employeeId, employeeId), eq(manualCashShortages.status, 'ACTIVE'), gte(manualCashShortages.occurredOn, periodStart), lte(manualCashShortages.occurredOn, end)));
  return { pos: netShortage(approved.map((r) => ({ amount: r.amount, waived: r.waivedAt != null }))), manual };
}

