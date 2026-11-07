import { and, eq, isNull, sql } from 'drizzle-orm';
import { shortHandoverSettlements } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { can, hasAction, recordAudit, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { filesUploadedBy } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import { voidProblem } from '../rules/money-checks';
import { rupiah } from '../rules/rates';
import {
  SETTLEMENT_LABELS, SHORT_RED_DAYS, SHORT_STATE_LABELS, summarizeShort,
  type LinkedDeductionStatus, type SettlementKind, type ShortState, type ShortSummary,
} from '../rules/short-handovers';
import { reasonProblem, wibClock, wibDate, type IsoDate } from '../rules/trip';
import { FORBIDDEN, accountsOf, fail, isUniqueViolation, peopleNames, type Executor } from './data';
import { paymentsFor, type CheckSource } from './money-checks';

// Tindak lanjut kurang serah Terima Uang (spec 2026-11-08 B3): Potongan Lain (lewat Gaji), Sudah diganti tunai (Finance),
// Tidak dipotong (Pemilik/GM). Kurang serahnya sendiri tetap dibaca dari `logistics.money_checks` (tanpa data ganda).

export type ShortKey = { source: CheckSource; paymentId: number };
const DO = 'logistics.money_check.do';
const daysBetween = (from: IsoDate, to: IsoDate) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));
const keyOf = (k: ShortKey) => `${k.source}-${k.paymentId}`;

/** Yang boleh menjadikan kurang serah Potongan Lain: pengusul Potongan Lain (HR) atau Pemilik/GM. */
export const canProposeShort = (actor: Actor | null) => !!actor && (hasAction(actor, 'other_deduction.propose') || hasAction(actor, 'deduction.approve'));

type ShortRow = {
  source: CheckSource; paymentId: number; total: number; checkedAt: Date; responsibleId: number;
  lines: { number: string; reported: number; actual: number; note: string | null }[];
};

async function shortRows(executor: Executor, only: ShortKey | null): Promise<ShortRow[]> {
  const from = String(await settingOn<string>('logistics.money_check_from', wibDate(new Date())));
  const filter = only
    ? sql`and source = ${only.source} and coalesce(visit_payment_id, self_payment_id) = ${only.paymentId}`
    : sql`and (checked_at at time zone 'Asia/Jakarta')::date >= ${from}::date`;
  const rows = await executor.execute<{
    source: CheckSource; payment_id: number; total: number; checked_at: string; responsible: number;
    lines: { number: string; reported: number; actual: number; note: string | null }[];
  }>(sql`
    select source, coalesce(visit_payment_id, self_payment_id) as payment_id, sum(reported_amount - actual_amount)::int as total,
      min(checked_at) as checked_at, max(responsible_employee_id) as responsible,
      json_agg(json_build_object('number', note_number, 'reported', reported_amount, 'actual', actual_amount, 'note', note) order by id) as lines
    from logistics.money_checks
    where voided_at is null and responsible_employee_id is not null and actual_amount < reported_amount ${filter}
    group by 1, 2 order by min(checked_at)`);
  return rows.map((r) => ({
    source: r.source, paymentId: Number(r.payment_id), total: Number(r.total), checkedAt: new Date(r.checked_at), responsibleId: Number(r.responsible),
    lines: r.lines.map((l) => ({ number: l.number, reported: Number(l.reported), actual: Number(l.actual), note: l.note })),
  }));
}

type LinkedDeduction = { id: number; source: CheckSource; paymentId: number; employeeId: number; amount: number; status: LinkedDeductionStatus };
type SettlementRow = typeof shortHandoverSettlements.$inferSelect;

async function linksFor(executor: Executor, keys: ShortKey[]) {
  if (!keys.length) return { deductions: [] as LinkedDeduction[], settlements: [] as SettlementRow[] };
  const truck = keys.filter((k) => k.source === 'TRUCK').map((k) => k.paymentId);
  const self = keys.filter((k) => k.source === 'SELF').map((k) => k.paymentId);
  const list = (values: number[]) => sql.join((values.length ? values : [-1]).map((v) => sql`${v}`), sql`, `);
  const [deductions, settlements] = await Promise.all([
    executor.execute<{ id: number; source: CheckSource; payment_id: number; employee_id: number; amount: number; status: LinkedDeductionStatus }>(sql`
      select id, money_check_source as source, money_check_payment_id as payment_id, employee_id, amount, status::text as status
      from hris.other_deductions
      where (money_check_source = 'TRUCK' and money_check_payment_id in (${list(truck)}))
         or (money_check_source = 'SELF' and money_check_payment_id in (${list(self)}))
      order by id`),
    executor.select().from(shortHandoverSettlements).where(and(isNull(shortHandoverSettlements.voidedAt), sql`(
      (${shortHandoverSettlements.source} = 'TRUCK' and ${shortHandoverSettlements.paymentId} in (${list(truck)}))
      or (${shortHandoverSettlements.source} = 'SELF' and ${shortHandoverSettlements.paymentId} in (${list(self)})))`)).orderBy(shortHandoverSettlements.id),
  ]);
  return {
    deductions: deductions.map((d) => ({
      id: Number(d.id), source: d.source, paymentId: Number(d.payment_id), employeeId: Number(d.employee_id), amount: Number(d.amount), status: d.status,
    })),
    settlements,
  };
}

const summaryOf = (row: ShortRow, deductions: LinkedDeduction[], settlements: SettlementRow[]): ShortSummary => summarizeShort(
  row.total,
  deductions.filter((d) => d.source === row.source && d.paymentId === row.paymentId),
  settlements.filter((s) => s.source === row.source && s.paymentId === row.paymentId).map((s) => ({ kind: s.kind as SettlementKind, amount: s.amount })),
);

/**
 * Keadaan satu kurang serah untuk diubah (dipakai Potongan Lain dan catatan tindak lanjut): dengan `tx`, dikunci per cara bayar
 * supaya dua pengajuan bersamaan tidak melebihi sisa. `null` bila kurang serahnya tidak ada / pemeriksaannya dibatalkan.
 */
export async function lockShortHandover(tx: Tx, key: ShortKey) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`short_handover:${keyOf(key)}`}))`);
  const [row] = await shortRows(tx, key);
  if (!row) return null;
  const [payment] = await paymentsFor(key);
  const links = await linksFor(tx, [key]);
  return {
    row, summary: summaryOf(row, links.deductions, links.settlements), store: payment?.store ?? '-', tripNumber: payment?.tripNumber ?? '-',
    crewIds: payment?.crewIds ?? [row.responsibleId], carrierId: payment?.carrierId ?? row.responsibleId,
  };
}

export type ShortHandoverView = {
  key: string; source: CheckSource; paymentId: number; store: string; tripNumber: string; tripHref: string; on: IsoDate; days: number;
  person: string; lines: ShortRow['lines']; summary: ShortSummary; state: ShortState; stateLabel: string; red: boolean;
  deductions: { id: number; name: string; amount: number; status: LinkedDeductionStatus }[];
  settlements: { id: number; kind: SettlementKind; label: string; amount: number | null; note: string; by: string; on: IsoDate; at: string; proofUrl: string | null; canVoid: boolean }[];
  canPropose: boolean; canReplace: boolean; canWaive: boolean; selfProblem: string | null;
};

/**
 * Kurang serah di tab Selisih (spec B3 butir 4): yang ⚠️ tetap tampil berapa pun umurnya; yang sudah ditindaklanjuti tampil 60 hari.
 * Paling lama di atas.
 */
export async function shortHandoverViews(actor: Actor): Promise<ShortHandoverView[]> {
  const today = wibDate(new Date());
  const rows = await shortRows(db, null);
  const keys = rows.map((r) => ({ source: r.source, paymentId: r.paymentId }));
  const [links, payments, names, accounts] = await Promise.all([
    linksFor(db, keys),
    paymentsFor(...keys),
    peopleNames(),
    accountNamesOf(),
  ]);
  const views: ShortHandoverView[] = [];
  for (const r of rows) {
    const summary = summaryOf(r, links.deductions, links.settlements);
    const on = wibDate(r.checkedAt);
    const days = daysBetween(on, today);
    if (summary.state !== 'OPEN' && days > 60) continue;
    const p = payments.find((x) => x.source === r.source && x.paymentId === r.paymentId);
    const crew = p?.crewIds ?? [r.responsibleId];
    const involved = crew.includes(actor.personId) || p?.recordedBy === actor.personId;
    views.push({
      key: `${r.source}-${r.paymentId}`, source: r.source, paymentId: r.paymentId, store: p?.store ?? '-', tripNumber: p?.tripNumber ?? '-',
      tripHref: p?.tripHref ?? '#', on, days, person: names.get(r.responsibleId) ?? '-', lines: r.lines, summary,
      state: summary.state, stateLabel: SHORT_STATE_LABELS[summary.state], red: summary.state === 'OPEN' && days > SHORT_RED_DAYS,
      deductions: links.deductions.filter((d) => d.source === r.source && d.paymentId === r.paymentId)
        .map((d) => ({ id: d.id, name: names.get(d.employeeId) ?? '-', amount: d.amount, status: d.status })),
      settlements: links.settlements.filter((s) => s.source === r.source && s.paymentId === r.paymentId).map((s) => ({
        id: s.id, kind: s.kind as SettlementKind, label: SETTLEMENT_LABELS[s.kind as SettlementKind], amount: s.amount, note: s.note,
        by: accounts.get(s.recordedByAccountId) ?? '-', on: wibDate(s.recordedAt), at: wibClock(s.recordedAt),
        proofUrl: s.proofFileId ? `/api/logistics/short-handover-proof?id=${s.id}` : null,
        canVoid: !voidProblem({ fullAccess: actor.fullAccess, own: s.recordedByAccountId === actor.accountId, daysSince: daysBetween(wibDate(s.recordedAt), today) })
          && (s.kind === 'WAIVED' ? actor.fullAccess : can(actor, DO)),
      })),
      canPropose: canProposeShort(actor) && summary.left > 0 && !involved,
      canReplace: can(actor, DO) && summary.left > 0 && !involved,
      canWaive: actor.fullAccess && summary.left > 0 && summary.pending === 0 && !involved,
      selfProblem: involved ? 'Kurang serah yang Anda bawa / catat sendiri ditindaklanjuti orang lain.' : null,
    });
  }
  return views;
}

async function accountNamesOf(): Promise<Map<number, string>> {
  const rows = await db.execute<{ account_id: number; name: string }>(sql`
    select l.account_id, e.name from auth.account_links l join hris.employees e on e.id = l.local_user_id where l.app_code = 'hris'`);
  return new Map(rows.map((r) => [Number(r.account_id), r.name]));
}

/** Isi form Jadikan Potongan Lain (spec B3 butir 2): awak (pembawa uang dulu), sisa, alasan terisi. */
export async function shortHandoverContext(actor: Actor | null, key: ShortKey) {
  if (!canProposeShort(actor)) return null;
  const [row] = await shortRows(db, key);
  if (!row) return null;
  const [payment] = await paymentsFor(key);
  const links = await linksFor(db, [key]);
  const summary = summaryOf(row, links.deductions, links.settlements);
  const names = await peopleNames();
  const carrierId = payment?.carrierId ?? row.responsibleId;
  const crewIds = [carrierId, ...(payment?.crewIds ?? []).filter((id) => id !== carrierId)];
  const on = wibDate(row.checkedAt);
  const notes = row.lines.map((l) => `nota ${l.number} lapor ${rupiah(l.reported)} diterima ${rupiah(l.actual)}`).join('; ');
  return {
    source: key.source, paymentId: key.paymentId, store: payment?.store ?? '-', tripNumber: payment?.tripNumber ?? '-', left: summary.left, total: summary.total,
    crew: crewIds.map((id) => ({ id, name: names.get(id) ?? '-', role: id === carrierId ? (key.source === 'TRUCK' ? 'Driver' : 'Pengantar') : 'Kenek' })),
    reason: `Kurang serah uang toko ${payment?.store ?? '-'}, trip ${payment?.tripNumber ?? '-'}, diperiksa ${on}: ${notes}.`,
  };
}

/**
 * Catat Sudah diganti tunai (Finance) atau Tidak dipotong (Pemilik/GM) — spec B3 butir 4. Ganti tunai paling banyak sisa;
 * Tidak dipotong menutup sisa dan ditolak selama ada Potongan Lain menunggu pengesahan.
 */
export async function recordShortSettlement(
  actor: Actor | null, input: ShortKey & { kind: SettlementKind; amount: number | null; note: string; proofFileId: string | null },
): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  if (input.kind === 'CASH_REPLACED' && !can(actor, DO)) return fail(403, 'Hanya Finance (pemeriksa Terima Uang) yang mencatat ganti tunai.');
  if (input.kind === 'WAIVED' && !actor.fullAccess) return fail(403, 'Hanya Pemilik atau GM yang menyatakan tidak dipotong.');
  const note = (input.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  const noteError = reasonProblem(note);
  if (noteError) return fail(400, noteError);
  try {
    return await db.transaction(async (tx) => {
      const state = await lockShortHandover(tx, input);
      if (!state) return fail(404, 'Kurang serah ini tidak ditemukan atau pemeriksaannya sudah dibatalkan.');
      if (state.crewIds.includes(actor.personId)) return fail(403, 'Kurang serah yang Anda bawa sendiri ditindaklanjuti orang lain.');
      const { summary } = state;
      if (summary.left <= 0) return fail(409, 'Kurang serah ini sudah tidak bersisa.');
      let amount: number | null = null;
      if (input.kind === 'CASH_REPLACED') {
        amount = Number(input.amount);
        if (!Number.isInteger(amount) || amount <= 0) return fail(400, 'Nominal ganti tunai harus rupiah bulat lebih dari 0.');
        if (amount > summary.left) return fail(400, `Nominal ganti tunai paling banyak sisa kurang serah ${rupiah(summary.left)}.`);
      } else if (summary.pending > 0) {
        return fail(409, 'Masih ada Potongan Lain menunggu pengesahan untuk kurang serah ini. Putuskan usulannya dulu.');
      }
      if (input.proofFileId && !(await filesUploadedBy(tx, actor.accountId, [input.proofFileId])).length) return fail(400, 'Foto bukti tidak ditemukan. Unggah ulang.');
      const [row] = await tx.insert(shortHandoverSettlements).values({
        source: input.source, paymentId: input.paymentId, kind: input.kind, amount, proofFileId: input.kind === 'CASH_REPLACED' ? input.proofFileId : null,
        note, recordedByAccountId: actor.accountId,
      }).returning({ id: shortHandoverSettlements.id });
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'short_handover_settlement', entityId: row.id, action: `short_handover.${input.kind.toLowerCase()}`,
        before: null, after: { source: input.source, paymentId: input.paymentId, amount, note },
      });
      const what = input.kind === 'CASH_REPLACED' ? `sudah diganti tunai ${rupiah(amount!)}` : 'dinyatakan tidak dipotong';
      await notify(tx, await accountsOf([state.row.responsibleId]), {
        kind: 'logistics.short_settled', title: `Kurang serah ${state.store} (${state.tripNumber}) ${what}`,
        body: `Catatan: ${note}`, link: '/logistik/terima-uang?tab=DIFF', entity: 'short_handover', entityId: input.paymentId,
      }, actor.accountId);
      return { ok: true as const, data: undefined };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'short_handover_settlements_waived_current')) return fail(409, 'Kurang serah ini baru saja dinyatakan tidak dipotong. Muat ulang halaman.');
    throw error;
  }
}

/** Batalkan catatan ganti tunai / tidak dipotong (alasan wajib): pencatatnya ≤ 7 hari, Pemilik/GM kapan saja. */
export async function voidShortSettlement(actor: Actor | null, input: { id: number; reason: string }): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  const reason = (input.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(shortHandoverSettlements).where(eq(shortHandoverSettlements.id, input.id));
    if (!row || row.voidedAt) return fail(404, 'Catatan ini tidak ditemukan atau sudah dibatalkan.');
    if (row.kind === 'WAIVED' ? !actor.fullAccess : !can(actor, DO)) return fail(403, FORBIDDEN);
    const problem = voidProblem({
      fullAccess: actor.fullAccess, own: row.recordedByAccountId === actor.accountId, daysSince: daysBetween(wibDate(row.recordedAt), wibDate(new Date())),
    });
    if (problem) return fail(403, problem);
    await tx.update(shortHandoverSettlements).set({ voidedAt: new Date(), voidedByAccountId: actor.accountId, voidReason: reason })
      .where(and(eq(shortHandoverSettlements.id, row.id), isNull(shortHandoverSettlements.voidedAt)));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'short_handover_settlement', entityId: row.id, action: 'short_handover.void',
      before: { kind: row.kind, amount: row.amount }, after: { reason },
    });
    return { ok: true as const, data: undefined };
  });
}

/** Pemeriksaan Terima Uang tidak boleh dibatalkan selama kurang serahnya sudah ditindaklanjuti (spec B3 butir 6). */
export async function shortHandoverVoidBlock(executor: Executor, key: ShortKey): Promise<string | null> {
  const links = await linksFor(executor, [key]);
  if (links.deductions.some((d) => d.status === 'PENDING' || d.status === 'ACTIVE')) {
    return 'Kurang serah ini sudah jadi Potongan Lain (menunggu / berjalan). Batalkan atau tolak Potongan Lainnya dulu.';
  }
  if (links.settlements.length) return 'Kurang serah ini sudah dicatat diganti tunai / tidak dipotong. Batalkan catatan itu dulu.';
  return null;
}

/** Angka Beranda (spec B3 butir 7): kurang serah belum ditindaklanjuti, dan yang lebih dari 3 hari. */
export async function shortHandoverAttention(actor: Actor | null): Promise<{ open: number; red: number; left: number }> {
  if (!actor || !(canProposeShort(actor) || can(actor, DO))) return { open: 0, red: 0, left: 0 };
  const today = wibDate(new Date());
  const rows = await shortRows(db, null);
  const links = await linksFor(db, rows.map((r) => ({ source: r.source, paymentId: r.paymentId })));
  let open = 0; let red = 0; let left = 0;
  for (const r of rows) {
    const s = summaryOf(r, links.deductions, links.settlements);
    if (s.state !== 'OPEN') continue;
    open += 1; left += s.left;
    if (daysBetween(wibDate(r.checkedAt), today) > SHORT_RED_DAYS) red += 1;
  }
  return { open, red, left };
}

/** Foto bukti ganti tunai: pemeriksa Terima Uang / pengusul Potongan Lain. */
export async function openShortProof(actor: Actor | null, id: number): Promise<string | null> {
  if (!actor || !(can(actor, DO) || canProposeShort(actor) || can(actor, 'logistics.store_payment.view'))) return null;
  const [row] = await db.select({ file: shortHandoverSettlements.proofFileId }).from(shortHandoverSettlements).where(eq(shortHandoverSettlements.id, id));
  return row?.file ?? null;
}
