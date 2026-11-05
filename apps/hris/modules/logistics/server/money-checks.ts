import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { moneyChecks } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, listEmployeesWithAnyAction, type Actor, type ServiceResult } from '@/modules/access';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import {
  CHECK_RED_DAYS, MONEY_KIND_LABELS, POS_STATUS_LABELS, cleanCheck, moneyKindOf, posStatusOf, splitEditable, suggestSplit, voidProblem,
  type CheckLineInput, type MoneyKind, type NoteBill, type PosStatus,
} from '../rules/money-checks';
import { rupiah } from '../rules/rates';
import { PAYMENT_LABELS, type PaymentMethod } from '../rules/store-payments';
import { addDays, reasonProblem, wibClock, wibDate, type IsoDate } from '../rules/trip';
import { FORBIDDEN, accountsOf, fail, isUniqueViolation, peopleNames, type Executor } from './data';

// Terima Uang (spec LT1 §16.1, LT4a): Finance memeriksa uang trip truk dan antar sendiri per nota. Piutang tetap milik kasir;
// HRIS hanya membaca `logistics.pos_customer_debts` untuk tanda pelunasan POS (tanpa data ganda).

export type CheckSource = 'TRUCK' | 'SELF';
const DO = 'logistics.money_check.do';
const ids = (values: number[]) => sql.join((values.length ? values : [-1]).map((v) => sql`${v}`), sql`, `);
const daysBetween = (from: IsoDate, to: IsoDate) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));

export const CHECKED_LOCK = 'Cara bayar ini sudah diperiksa Finance di Terima Uang. Batalkan pemeriksaannya dulu bila memang perlu dikoreksi.';

/** Cara bayar ini sudah diperiksa (ada pemeriksaan berlaku)? Dipakai untuk mengunci koreksi cara bayar (§16.1 butir 9). */
export async function paymentChecked(source: CheckSource, paymentId: number, executor: Executor = db): Promise<boolean> {
  const column = source === 'TRUCK' ? moneyChecks.visitPaymentId : moneyChecks.selfPaymentId;
  const [row] = await executor.select({ id: moneyChecks.id }).from(moneyChecks).where(and(eq(column, paymentId), isNull(moneyChecks.voidedAt))).limit(1);
  return !!row;
}

type RawPayment = {
  source: CheckSource; paymentId: number; tripId: number; tripNumber: string; tripHref: string; store: string; customerId: number | null;
  method: PaymentMethod; received: number; recordedAt: Date; recordedBy: number; proofUrl: string | null;
  /** Pembawa uang tunai: driver trip (kenek tidak) atau PJ antar sendiri. */
  carrierId: number | null; crewIds: number[]; branch: string | null; notes: NoteBill[];
};

/** Cara bayar beruang (Lunas cash / transfer / Bayar sebagian) yang siap diperiksa, dicatat sejak `since`. */
async function loadPayments(since: IsoDate, only: { truck?: number[]; self?: number[] } | null = null): Promise<RawPayment[]> {
  const truckFilter = only ? sql`and p.id in (${ids(only.truck ?? [])})` : sql``;
  const selfFilter = only ? sql`and p.id in (${ids(only.self ?? [])})` : sql``;
  const [truck, self] = await Promise.all([
    db.execute<{
      id: number; visit_id: number; trip_id: number; number: string; store: string; customer_id: number; method: PaymentMethod; received_amount: number;
      proof_photo_file_id: string | null; recorded_at: string; recorded_by_employee_id: number; processed_at: string | null;
    }>(sql`
      select p.id, p.visit_id, p.trip_id, t.number, v.destination_name as store, p.customer_id, p.method, p.received_amount, p.proof_photo_file_id,
        p.recorded_at, p.recorded_by_employee_id, v.processed_at
      from logistics.visit_payments p join logistics.trips t on t.id = p.trip_id join logistics.trip_visits v on v.id = p.visit_id
      where p.replaced_at is null and p.method in ('CASH', 'TRANSFER', 'PARTIAL')
        and (p.recorded_at at time zone 'Asia/Jakarta')::date >= ${since}::date
        and (t.heading_home_at is not null or t.status <> 'RUNNING') ${truckFilter}
      order by p.recorded_at`),
    db.execute<{
      id: number; trip_id: number; number: string; branch: string | null; employee_id: number; store: string; trx_number: string; transaction_id: number;
      customer_id: number | null; method: PaymentMethod; received_amount: number; bill_amount: number; proof_photo_file_id: string | null;
      stop_id: number; branch_id: number; recorded_at: string; recorded_by_employee_id: number;
    }>(sql`
      select p.id, p.trip_id, t.number, b.name as branch, t.employee_id, t.branch_id, x.destination_name as store, x.trx_number, p.transaction_id, p.customer_id,
        p.method, p.received_amount, p.bill_amount, p.proof_photo_file_id, p.stop_id, p.recorded_at, p.recorded_by_employee_id
      from logistics.self_trip_payments p join logistics.self_trips t on t.id = p.trip_id join logistics.self_trip_stops x on x.id = p.stop_id
      left join hris.branches b on b.id = t.branch_id
      where p.replaced_at is null and p.method in ('CASH', 'TRANSFER', 'PARTIAL')
        and (p.recorded_at at time zone 'Asia/Jakarta')::date >= ${since}::date
        and t.status in ('DONE', 'CLOSED') ${selfFilter}
      order by p.recorded_at`),
  ]);
  const visitIds = truck.map((r) => Number(r.visit_id));
  const tripIds = [...new Set(truck.map((r) => Number(r.trip_id)))];
  const [bills, legacy, crew] = await Promise.all([
    db.execute<{ visit_id: number; transaction_id: number; number: string; bill_amount: number }>(sql`
      select b.visit_id, b.transaction_id, n.number, b.bill_amount from logistics.visit_note_bills b join logistics.delivery_notes n on n.id = b.note_id
      where b.visit_id in (${ids(visitIds)}) and b.bill_amount > 0 order by b.transaction_id`),
    // Kunjungan sebelum LT4a (tanpa tagihan per nota): nota SALE yang berakhir bersama Terkirim dan punya piutang di kasir.
    db.execute<{ visit_id: number; transaction_id: number; number: string }>(sql`
      select distinct l.visit_id, n.doc_id as transaction_id, n.number
      from logistics.trip_visit_notes l join logistics.trip_visits v on v.id = l.visit_id
      join logistics.delivery_notes n on n.id = l.note_id and n.kind = 'SALE'
      where l.visit_id in (${ids(visitIds)}) and l.ended_at = v.processed_at
        and exists (select 1 from logistics.pos_customer_debts d where d.transaction_id = n.doc_id)
        and not exists (select 1 from logistics.visit_note_bills b where b.visit_id = l.visit_id)
      order by n.doc_id`),
    db.execute<{ trip_id: number; employee_id: number; role: string }>(sql`
      select trip_id, employee_id, role from logistics.trip_crew where trip_id in (${ids(tripIds)}) and removed_at is null order by role desc, id`),
  ]);
  const photo = (tripId: number, fileId: string | null) => (fileId ? `/api/logistics/photo?trip=${tripId}&file=${fileId}` : null);
  return [
    ...truck.map((r): RawPayment => {
      const visitId = Number(r.visit_id);
      const tripId = Number(r.trip_id);
      const own = bills.filter((b) => Number(b.visit_id) === visitId);
      const notes: NoteBill[] = own.length
        ? own.map((b) => ({ transactionId: Number(b.transaction_id), number: b.number, bill: Number(b.bill_amount) }))
        : legacy.filter((l) => Number(l.visit_id) === visitId).map((l) => ({ transactionId: Number(l.transaction_id), number: l.number, bill: null }));
      const tripCrew = crew.filter((c) => Number(c.trip_id) === tripId);
      return {
        source: 'TRUCK', paymentId: Number(r.id), tripId, tripNumber: r.number, tripHref: `/logistik/trip/${tripId}`, store: r.store,
        customerId: Number(r.customer_id), method: r.method, received: Number(r.received_amount), recordedAt: new Date(r.recorded_at),
        recordedBy: Number(r.recorded_by_employee_id), proofUrl: photo(tripId, r.proof_photo_file_id),
        carrierId: tripCrew.find((c) => c.role === 'DRIVER') ? Number(tripCrew.find((c) => c.role === 'DRIVER')!.employee_id) : null,
        crewIds: tripCrew.map((c) => Number(c.employee_id)), branch: null, notes,
      };
    }),
    ...self.map((r): RawPayment => ({
      source: 'SELF', paymentId: Number(r.id), tripId: Number(r.trip_id), tripNumber: r.number,
      tripHref: `/logistik/antar-sendiri/kantor?tab=DONE&cabang=${r.branch_id}`, store: r.store,
      customerId: r.customer_id != null ? Number(r.customer_id) : null, method: r.method, received: Number(r.received_amount),
      recordedAt: new Date(r.recorded_at), recordedBy: Number(r.recorded_by_employee_id),
      proofUrl: r.proof_photo_file_id ? `/api/logistics/self-photo?trip=${r.trip_id}&kind=proof&stop=${r.stop_id}` : null,
      carrierId: Number(r.employee_id), crewIds: [Number(r.employee_id)], branch: r.branch,
      notes: [{ transactionId: Number(r.transaction_id), number: r.trx_number, bill: Number(r.bill_amount) }],
    })),
  ];
}

type CheckRow = typeof moneyChecks.$inferSelect;

async function currentChecks(payments: RawPayment[]): Promise<CheckRow[]> {
  const truck = payments.filter((p) => p.source === 'TRUCK').map((p) => p.paymentId);
  const self = payments.filter((p) => p.source === 'SELF').map((p) => p.paymentId);
  if (!truck.length && !self.length) return [];
  return db.select().from(moneyChecks).where(and(isNull(moneyChecks.voidedAt), sql`(
    ${moneyChecks.visitPaymentId} in (${ids(truck)}) or ${moneyChecks.selfPaymentId} in (${ids(self)}))`)).orderBy(moneyChecks.id);
}

const checksOf = (checks: CheckRow[], p: RawPayment) =>
  checks.filter((c) => (p.source === 'TRUCK' ? c.visitPaymentId : c.selfPaymentId) === p.paymentId);

/** Sisa piutang kasir + potong nota HRIS yang sudah dicatat di kasir, per nota (untuk tanda pelunasan POS). */
async function posState(transactionIds: number[]) {
  if (!transactionIds.length) return { debtOf: () => null, cutsOf: () => 0 };
  const [debts, cuts] = await Promise.all([
    db.execute<{ transaction_id: number; remaining: number; voided: boolean }>(sql`
      select transaction_id, coalesce(sum(remaining_amount) filter (where status <> 'VOIDED'), 0)::int as remaining, bool_and(status = 'VOIDED') as voided
      from logistics.pos_customer_debts where transaction_id in (${ids(transactionIds)}) group by transaction_id`),
    db.execute<{ trx: number; amount: number }>(sql`
      select coalesce(n.doc_id, c.transaction_id) as trx, sum(c.amount)::int as amount
      from logistics.report_decisions c left join logistics.delivery_notes n on n.id = c.note_id
      where c.decision = 'CUT' and c.replaced_at is null and c.recorded_at is not null
        and coalesce(n.doc_id, c.transaction_id) in (${ids(transactionIds)})
      group by 1`),
  ]);
  const debtMap = new Map(debts.map((d) => [Number(d.transaction_id), { remaining: Number(d.remaining), voided: !!d.voided }]));
  const cutMap = new Map(cuts.map((c) => [Number(c.trx), Number(c.amount)]));
  return { debtOf: (id: number) => debtMap.get(id) ?? null, cutsOf: (id: number) => cutMap.get(id) ?? 0 };
}

export type MoneyNoteView = {
  transactionId: number; number: string; bill: number | null; suggested: number;
  check: { reported: number; actual: number; difference: number; note: string | null; posExpected: number } | null;
  pos: { status: PosStatus; label: string; paid: number | null; red: boolean } | null;
};
export type MoneyPaymentView = {
  key: string; source: CheckSource; paymentId: number; tripId: number; tripNumber: string; tripHref: string; store: string; branch: string | null;
  crew: string; carrier: string | null; method: PaymentMethod; label: string; kind: MoneyKind; kindLabel: string; received: number;
  on: IsoDate; at: string; days: number; red: boolean; proofUrl: string | null; customerUrl: string | null;
  notes: MoneyNoteView[]; splitEditable: boolean; canCheck: boolean; selfProblem: string | null;
  checked: { by: string; on: IsoDate; at: string; canVoid: boolean; voidProblem: string | null } | null;
};
export type MoneyCheckTab = 'WAITING' | 'DONE' | 'DIFF';

/**
 * Layar Terima Uang (§16.1): Belum diperiksa (paling lama di atas), Sudah diperiksa (30 hari, tanda POS), Selisih (kurang /
 * lebih serah 60 hari). Pemegang `logistics.money_check.do` memeriksa; pemegang Uang dari Toko hanya melihat.
 */
export async function moneyCheckScreen(actor: Actor | null, tab: MoneyCheckTab, source: 'ALL' | CheckSource = 'ALL') {
  if (!actor || !(can(actor, DO) || can(actor, 'logistics.store_payment.view'))) return null;
  const today = wibDate(new Date());
  const from = String(await settingOn<string>('logistics.money_check_from', today));
  const back = addDays(today, tab === 'DIFF' ? -60 : -30);
  const since = tab === 'WAITING' || from > back ? from : back;
  const all = (await loadPayments(since)).filter((p) => source === 'ALL' || p.source === source);
  const checks = await currentChecks(all);
  const picked = all.filter((p) => {
    const mine = checksOf(checks, p);
    if (tab === 'WAITING') return mine.length === 0;
    if (tab === 'DONE') return mine.length > 0;
    return mine.some((c) => c.actualAmount !== c.reportedAmount);
  });
  if (tab !== 'WAITING') picked.reverse();
  const canCheck = can(actor, DO);
  const [names, checkerNames, pos] = await Promise.all([
    peopleNames(),
    accountNames([...new Set(checks.map((c) => c.checkedByAccountId))]),
    posState([...new Set(checks.map((c) => c.transactionId))]),
  ]);
  const boRoot = (process.env.BACKOFFICE_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');
  const view = (p: RawPayment): MoneyPaymentView => {
    const mine = checksOf(checks, p);
    const kind = moneyKindOf(p.method)!;
    const on = wibDate(p.recordedAt);
    const days = daysBetween(on, today);
    const suggested = suggestSplit(p.method, p.received, p.notes);
    const first = mine[0];
    const checkedOn = first ? wibDate(first.checkedAt) : null;
    const problem = first ? voidProblem({ fullAccess: actor.fullAccess, own: first.checkedByAccountId === actor.accountId, daysSince: daysBetween(checkedOn!, today) }) : null;
    // Catatan pada baris lama (kunjungan sebelum LT4a tanpa nota berpiutang) tetap tampil dari pemeriksaannya.
    const noteList: NoteBill[] = p.notes.length ? p.notes : mine.map((c) => ({ transactionId: c.transactionId, number: c.noteNumber, bill: c.billAmount }));
    return {
      key: `${p.source}-${p.paymentId}`, source: p.source, paymentId: p.paymentId, tripId: p.tripId, tripNumber: p.tripNumber, tripHref: p.tripHref,
      store: p.store, branch: p.branch, crew: p.crewIds.map((id) => names.get(id) ?? '-').join(', '),
      carrier: p.carrierId != null ? names.get(p.carrierId) ?? '-' : null, method: p.method, label: PAYMENT_LABELS[p.method], kind,
      kindLabel: MONEY_KIND_LABELS[kind], received: p.received, on, at: wibClock(p.recordedAt), days, red: !first && days > CHECK_RED_DAYS,
      proofUrl: p.proofUrl, customerUrl: boRoot && p.customerId ? `${boRoot}/master-data/customers/${p.customerId}` : null,
      notes: noteList.map((n, i) => {
        const c = mine.find((x) => x.transactionId === n.transactionId) ?? null;
        const state = c ? posStatusOf({ expected: c.posExpectedAmount, bill: c.billAmount, debt: pos.debtOf(n.transactionId), recordedCuts: pos.cutsOf(n.transactionId) }) : null;
        return {
          transactionId: n.transactionId, number: n.number, bill: n.bill, suggested: suggested[i] ?? 0,
          check: c ? { reported: c.reportedAmount, actual: c.actualAmount, difference: c.actualAmount - c.reportedAmount, note: c.note, posExpected: c.posExpectedAmount } : null,
          pos: state ? {
            status: state.status, label: POS_STATUS_LABELS[state.status], paid: state.paid,
            red: (state.status === 'WAITING' || state.status === 'PARTLY') && daysBetween(wibDate(c!.checkedAt), today) > CHECK_RED_DAYS,
          } : null,
        };
      }),
      splitEditable: splitEditable(p.method, p.notes), canCheck: canCheck && !first && p.notes.length > 0,
      selfProblem: p.recordedBy === actor.personId || p.crewIds.includes(actor.personId) ? 'Uang yang Anda catat / bawa sendiri diperiksa orang lain.' : null,
      checked: first ? {
        by: checkerNames.get(first.checkedByAccountId) ?? '-', on: checkedOn!, at: wibClock(first.checkedAt), canVoid: canCheck && !problem, voidProblem: problem,
      } : null,
    };
  };
  const payments = picked.map(view);
  const groups = new Map<string, { key: string; source: CheckSource; tripId: number; number: string; href: string; crew: string; branch: string | null; payments: MoneyPaymentView[] }>();
  for (const p of payments) {
    const key = `${p.source}-${p.tripId}`;
    if (!groups.has(key)) groups.set(key, { key, source: p.source, tripId: p.tripId, number: p.tripNumber, href: p.tripHref, crew: p.crew, branch: p.branch, payments: [] });
    groups.get(key)!.payments.push(p);
  }
  const diffs = tab === 'DIFF' ? differences(checks.filter((c) => c.actualAmount !== c.reportedAmount), all, names) : [];
  return { tab, source, from, redDays: CHECK_RED_DAYS, trips: [...groups.values()], diffs, canCheck };
}

/** Selisih per nota (§16.1 butir 4–6): kurang serah tunai atas nama pembawa, lebih serah, transfer kurang (piutang toko). */
function differences(rows: CheckRow[], payments: RawPayment[], names: Map<number, string>) {
  return rows.map((c) => {
    const p = payments.find((x) => (x.source === 'TRUCK' ? c.visitPaymentId : c.selfPaymentId) === x.paymentId);
    const difference = c.actualAmount - c.reportedAmount;
    const label = difference > 0 ? 'Lebih serah' : c.kind === 'CASH' ? 'Kurang serah' : 'Transfer kurang (tetap piutang toko)';
    return {
      id: c.id, number: c.noteNumber, store: p?.store ?? '-', tripNumber: p?.tripNumber ?? '-', tripHref: p?.tripHref ?? '#', kind: c.kind as MoneyKind,
      label, difference, note: c.note, person: c.responsibleEmployeeId ? names.get(c.responsibleEmployeeId) ?? '-' : null, on: wibDate(c.checkedAt),
    };
  }).reverse();
}

async function accountNames(accountIds: number[]): Promise<Map<number, string>> {
  if (!accountIds.length) return new Map();
  const rows = await db.execute<{ account_id: number; name: string }>(sql`
    select l.account_id, e.name from auth.account_links l join hris.employees e on e.id = l.local_user_id
    where l.app_code = 'hris' and l.account_id in (${ids(accountIds)})`);
  return new Map(rows.map((r) => [Number(r.account_id), r.name]));
}

async function onePayment(source: CheckSource, paymentId: number) {
  const [p] = await loadPayments('2000-01-01', source === 'TRUCK' ? { truck: [paymentId] } : { self: [paymentId] });
  return p ?? null;
}

/**
 * Simpan pemeriksaan satu cara bayar (§16.1 butir 2–5): semua nota toko itu sekaligus. Kurang serah tunai → atas nama pembawa
 * (driver / PJ antar sendiri) dan ia diberi tahu, begitu pula Pemilik/GM. Transfer kurang = tetap piutang toko.
 */
export async function saveMoneyCheck(
  actor: Actor | null, input: { source: CheckSource; paymentId: number; lines: CheckLineInput[] },
): Promise<ServiceResult> {
  if (!actor || !can(actor, DO)) return fail(403, FORBIDDEN);
  const p = await onePayment(input.source, input.paymentId);
  if (!p) return fail(404, 'Cara bayar ini tidak ditemukan, sudah dikoreksi, atau belum siap diperiksa (trip belum pulang).');
  if (p.recordedBy === actor.personId || p.crewIds.includes(actor.personId)) return fail(403, 'Uang yang Anda catat / bawa sendiri diperiksa orang lain.');
  if (!p.notes.length) return fail(409, 'Nota kasir kunjungan ini tidak terbaca; periksa lewat Uang dari Toko.');
  const kind = moneyKindOf(p.method);
  if (!kind) return fail(409, 'Cara bayar ini tidak membawa uang.');
  const clean = cleanCheck(kind, p.received, p.notes, input.lines);
  if (!clean.ok) return fail(400, clean.error);
  try {
    return await db.transaction(async (tx) => {
      const now = new Date();
      await tx.insert(moneyChecks).values(clean.lines.map((l) => ({
        source: p.source, visitPaymentId: p.source === 'TRUCK' ? p.paymentId : null, selfPaymentId: p.source === 'SELF' ? p.paymentId : null,
        tripId: p.source === 'TRUCK' ? p.tripId : null, selfTripId: p.source === 'SELF' ? p.tripId : null, transactionId: l.transactionId, noteNumber: l.number,
        kind, reportedAmount: l.reported, actualAmount: l.actual, posExpectedAmount: l.posExpected, billAmount: l.bill,
        responsibleEmployeeId: kind === 'CASH' && l.difference < 0 ? p.carrierId : null, note: l.note, checkedByAccountId: actor.accountId, checkedAt: now,
      })));
      const short = clean.lines.filter((l) => kind === 'CASH' && l.difference < 0);
      if (short.length && p.carrierId != null) {
        const total = short.reduce((n, l) => n - l.difference, 0);
        const owners = await accountsOf(await listEmployeesWithAnyAction(['logistics.wage.manage']));
        await notify(tx, [...new Set([...(await accountsOf([p.carrierId])), ...owners])], {
          kind: 'logistics.cash_short', title: `Kurang serah ${rupiah(total)}: ${p.store} (${p.tripNumber})`,
          body: `${short.map((l) => `${l.number}: lapor ${rupiah(l.reported)}, diterima ${rupiah(l.actual)}`).join('; ')}. Bahan Potongan Lain HR, tidak memotong gaji otomatis.`,
          link: '/logistik/terima-uang?tab=DIFF', entity: 'money_check', entityId: p.paymentId,
        }, actor.accountId);
      }
      return { ok: true as const, data: undefined };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'money_checks_truck_current') || isUniqueViolation(error, 'money_checks_self_current')) {
      return fail(409, 'Cara bayar ini baru saja diperiksa orang lain. Muat ulang halaman.');
    }
    throw error;
  }
}

/** Batalkan pemeriksaan satu cara bayar (§16.1 butir 9): alasan wajib; pemeriksa sendiri ≤ 7 hari, Pemilik/GM kapan saja. */
export async function voidMoneyCheck(actor: Actor | null, input: { source: CheckSource; paymentId: number; reason: string }): Promise<ServiceResult> {
  if (!actor || !can(actor, DO)) return fail(403, FORBIDDEN);
  const reason = (input.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  const column = input.source === 'TRUCK' ? moneyChecks.visitPaymentId : moneyChecks.selfPaymentId;
  const rows = await db.select().from(moneyChecks).where(and(eq(column, input.paymentId), isNull(moneyChecks.voidedAt)));
  if (!rows.length) return fail(404, 'Pemeriksaan ini tidak ditemukan atau sudah dibatalkan.');
  const problem = voidProblem({
    fullAccess: actor.fullAccess, own: rows[0].checkedByAccountId === actor.accountId, daysSince: daysBetween(wibDate(rows[0].checkedAt), wibDate(new Date())),
  });
  if (problem) return fail(403, problem);
  const done = await db.update(moneyChecks).set({ voidedAt: new Date(), voidedByAccountId: actor.accountId, voidReason: reason })
    .where(and(inArray(moneyChecks.id, rows.map((r) => r.id)), isNull(moneyChecks.voidedAt))).returning({ id: moneyChecks.id });
  return done.length === rows.length ? { ok: true, data: undefined } : fail(409, 'Pemeriksaan ini baru saja berubah. Muat ulang halaman.');
}

/** Angka Beranda (§16.1 butir 8): toko belum diperiksa (dan yang > 3 hari), nota diperiksa > 3 hari tapi belum masuk POS. */
export async function moneyCheckAttention(actor: Actor | null): Promise<{ waiting: number; red: number; posRed: number }> {
  if (!actor || !can(actor, DO)) return { waiting: 0, red: 0, posRed: 0 };
  return countMoneyChecks();
}

/** Hitung uang toko belum diperiksa / belum masuk POS tanpa pemeriksaan hak (Dashboard Logistik). */
export async function countMoneyChecks(): Promise<{ waiting: number; red: number; posRed: number }> {
  const today = wibDate(new Date());
  const from = String(await settingOn<string>('logistics.money_check_from', today));
  const back = addDays(today, -30);
  const all = await loadPayments(from);
  const checks = await currentChecks(all);
  const waiting = all.filter((p) => !checksOf(checks, p).length);
  const pos = await posState([...new Set(checks.map((c) => c.transactionId))]);
  const posRed = checks.filter((c) => {
    const on = wibDate(c.checkedAt);
    if (on < back || daysBetween(on, today) <= CHECK_RED_DAYS) return false;
    const s = posStatusOf({ expected: c.posExpectedAmount, bill: c.billAmount, debt: pos.debtOf(c.transactionId), recordedCuts: pos.cutsOf(c.transactionId) }).status;
    return s === 'WAITING' || s === 'PARTLY';
  }).length;
  return { waiting: waiting.length, red: waiting.filter((p) => daysBetween(wibDate(p.recordedAt), today) > CHECK_RED_DAYS).length, posRed };
}

/** Kurang serah 30 hari terakhir dari pemeriksaan yang berlaku (Dashboard Logistik), tanpa pemeriksaan hak. */
export async function shortHandoverSummary(): Promise<{ count: number; total: number }> {
  const [row] = await db.execute<{ n: number; total: number }>(sql`
    select count(*)::int as n, coalesce(sum(reported_amount - actual_amount), 0)::bigint as total
    from logistics.money_checks
    where voided_at is null and responsible_employee_id is not null and checked_at > now() - interval '30 days'`);
  return { count: Number(row?.n ?? 0), total: Number(row?.total ?? 0) };
}
