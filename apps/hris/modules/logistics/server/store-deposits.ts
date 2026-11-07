import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { storeDeposits } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { rupiah } from '../rules/rates';
import { DEPOSIT_KIND_LABELS, cleanRecordedRef, depositBalance, type DepositKind } from '../rules/store-payments';
import { reasonProblem, wibClock, wibDate, type IsoDate } from '../rules/trip';
import { FORBIDDEN, fail, peopleNames } from './data';

// Titipan toko (A1, spec docs/work/specs/2026-11-08-titipan-toko-design.md). Buku logistics.store_deposits (migrasi logistics
// 0018). Kasir tidak ditulis: pemakaian titipan dicatat Finance di kasir sebagai Pelunasan Piutang lalu ditandai Sudah dicatat.

const DO = 'logistics.money_check.do';
const ids = (values: number[]) => sql.join((values.length ? values : [-1]).map((v) => sql`${v}`), sql`, `);
const canSee = (actor: Actor) => can(actor, DO) || can(actor, 'logistics.store_payment.view');
type Row = typeof storeDeposits.$inferSelect;

/** Kunci per toko supaya dua pemakaian bersamaan tidak membuat saldo minus. */
async function lockStore(tx: Tx, customerId: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('logistics.store_deposit'), ${customerId})`);
}

async function balanceOf(tx: Tx, customerId: number): Promise<number> {
  const rows = await tx.select().from(storeDeposits).where(eq(storeDeposits.customerId, customerId));
  return depositBalance(rows.map((r) => ({ kind: r.kind as DepositKind, amount: r.amount, actualAmount: r.actualAmount, voided: !!r.voidedAt })));
}

function cleanAmount(value: number | null | undefined): number | null {
  return value != null && Number.isInteger(value) && value > 0 && value <= 100_000_000 ? value : null;
}

/** Periksa uang titipan (Finance, Terima Uang): Cocok = dilaporkan; selain itu catatan wajib. Trip harus sudah Menuju Garasi. */
export async function checkDeposit(actor: Actor | null, id: number, input: { actual?: number | null; note?: string | null }): Promise<ServiceResult> {
  if (!actor || !can(actor, DO)) return fail(403, FORBIDDEN);
  const actual = input.actual;
  if (actual == null || !Number.isInteger(actual) || actual < 0) return fail(400, 'Isi uang titipan yang diterima (rupiah).');
  const note = (input.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 300) || null;
  const [row] = await db.select().from(storeDeposits).where(eq(storeDeposits.id, id)).limit(1);
  if (!row || row.kind !== 'IN') return fail(404, 'Titipan tidak ditemukan.');
  if (actual !== row.amount && (!note || note.length < 5)) return fail(400, 'Uang tidak sama dengan laporan: tulis catatan paling sedikit 5 huruf.');
  const [trip] = await db.execute<{ ready: boolean }>(sql`
    select (heading_home_at is not null or status <> 'RUNNING') as ready from logistics.trips where id = ${row.tripId}`);
  if (!trip?.ready) return fail(409, 'Trip belum Menuju Garasi. Titipan diperiksa sesudah uangnya diserahkan.');
  const [done] = await db.update(storeDeposits).set({ actualAmount: actual, checkNote: note, checkedByAccountId: actor.accountId, checkedAt: new Date() })
    .where(and(eq(storeDeposits.id, id), isNull(storeDeposits.checkedAt))).returning({ id: storeDeposits.id });
  return done ? { ok: true, data: undefined } : fail(409, 'Titipan ini sudah diperiksa.');
}

/** Pakai titipan untuk nota berpiutang toko itu: nominal ≤ saldo dan ≤ sisa piutang; lalu Perlu dicatat di kasir. */
export async function applyDeposit(actor: Actor | null, input: { customerId: number; transactionId: number; amount?: number | null }): Promise<ServiceResult> {
  if (!actor || !can(actor, DO)) return fail(403, FORBIDDEN);
  const amount = cleanAmount(input.amount);
  if (!amount) return fail(400, 'Isi nominal yang dipakai (rupiah bulat).');
  const [debt] = await db.execute<{ trx_number: string; remaining_amount: number }>(sql`
    select trx_number, remaining_amount from logistics.pos_open_debts where customer_id = ${input.customerId} and transaction_id = ${input.transactionId}`);
  if (!debt) return fail(400, 'Nota ini tidak berpiutang lagi di kasir.');
  const pending = await db.execute<{ n: number }>(sql`
    select coalesce(sum(amount), 0)::int as n from logistics.store_deposits
    where kind = 'USE' and transaction_id = ${input.transactionId} and voided_at is null and recorded_at is null`);
  const room = Number(debt.remaining_amount) - Number(pending[0]?.n ?? 0);
  if (amount > room) return fail(400, `Melebihi sisa piutang ${debt.trx_number} (${rupiah(Math.max(0, room))}, sesudah pemakaian yang belum dicatat).`);
  return db.transaction(async (tx) => {
    await lockStore(tx, input.customerId);
    const balance = await balanceOf(tx, input.customerId);
    if (amount > balance) return fail(400, `Melebihi saldo titipan (${rupiah(balance)}).`);
    await tx.insert(storeDeposits).values({
      customerId: input.customerId, kind: 'USE', amount, transactionId: input.transactionId, trxNumber: debt.trx_number, createdByAccountId: actor.accountId,
    });
    return { ok: true as const, data: undefined };
  });
}

/** Kembalikan titipan tunai ke toko: nominal ≤ saldo, alasan wajib. */
export async function refundDeposit(actor: Actor | null, input: { customerId: number; amount?: number | null; reason?: string | null }): Promise<ServiceResult> {
  if (!actor || !can(actor, DO)) return fail(403, FORBIDDEN);
  const amount = cleanAmount(input.amount);
  if (!amount) return fail(400, 'Isi nominal yang dikembalikan (rupiah bulat).');
  const reason = (input.reason ?? '').trim();
  const problem = reasonProblem(reason);
  if (problem) return fail(400, problem);
  return db.transaction(async (tx) => {
    await lockStore(tx, input.customerId);
    const balance = await balanceOf(tx, input.customerId);
    if (amount > balance) return fail(400, `Melebihi saldo titipan (${rupiah(balance)}).`);
    await tx.insert(storeDeposits).values({ customerId: input.customerId, kind: 'REFUND', amount, note: reason.slice(0, 300), createdByAccountId: actor.accountId });
    return { ok: true as const, data: undefined };
  });
}

/** Batalkan pemakaian (belum dicatat di kasir) atau pengembalian; alasan wajib. Titipan masuk tidak dibatalkan (periksa saja). */
export async function voidDeposit(actor: Actor | null, id: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, DO)) return fail(403, FORBIDDEN);
  const problem = reasonProblem(reason);
  if (problem) return fail(400, problem);
  const [row] = await db.update(storeDeposits).set({ voidedAt: new Date(), voidedByAccountId: actor.accountId, voidReason: reason.trim().slice(0, 300) })
    .where(and(eq(storeDeposits.id, id), inArray(storeDeposits.kind, ['USE', 'REFUND']), isNull(storeDeposits.voidedAt), isNull(storeDeposits.recordedAt)))
    .returning({ id: storeDeposits.id });
  return row ? { ok: true, data: undefined } : fail(409, 'Hanya pemakaian yang belum dicatat di kasir atau pengembalian yang bisa dibatalkan.');
}

/** Sudah dicatat di kasir (Pelunasan Piutang memakai titipan): nomor / keterangan wajib; sesudahnya terkunci. */
export async function recordDepositUse(actor: Actor | null, id: number, ref: string): Promise<ServiceResult> {
  if (!actor || !can(actor, DO)) return fail(403, FORBIDDEN);
  const clean = cleanRecordedRef(ref);
  if (!clean.ok) return fail(400, clean.error);
  const [row] = await db.update(storeDeposits).set({ recordedAt: new Date(), recordedByAccountId: actor.accountId, recordedRef: clean.ref })
    .where(and(eq(storeDeposits.id, id), eq(storeDeposits.kind, 'USE'), isNull(storeDeposits.voidedAt), isNull(storeDeposits.recordedAt)))
    .returning({ id: storeDeposits.id });
  return row ? { ok: true, data: undefined } : fail(409, 'Pemakaian ini sudah dicatat atau dibatalkan.');
}

export type DepositEntryView = {
  id: number; kind: DepositKind; label: string; amount: number; actual: number | null; checked: boolean; note: string | null; checkNote: string | null;
  trxNumber: string | null; tripId: number | null; tripNumber: string | null; by: string; on: IsoDate; at: string;
  recorded: { ref: string; on: IsoDate } | null; voided: { reason: string } | null;
};
export type DepositStoreView = {
  customerId: number; store: string; balance: number; waitingCheck: number; entries: DepositEntryView[];
  debts: { transactionId: number; number: string; remaining: number }[];
};

async function entryViews(rows: Row[]) {
  const tripIds = [...new Set(rows.map((r) => r.tripId).filter((id): id is number => id != null))];
  const [tripRows, accounts, names] = await Promise.all([
    tripIds.length ? db.execute<{ id: number; number: string }>(sql`select id, number from logistics.trips where id in (${ids(tripIds)})`) : [],
    db.execute<{ account_id: number; name: string }>(sql`
      select l.account_id, e.name from auth.account_links l join hris.employees e on e.id = l.local_user_id where l.app_code = 'hris'`),
    peopleNames(),
  ]);
  const tripOf = new Map(tripRows.map((t) => [Number(t.id), t.number]));
  const accountName = new Map(accounts.map((a) => [Number(a.account_id), a.name]));
  return (r: Row): DepositEntryView => ({
    id: r.id, kind: r.kind as DepositKind, label: DEPOSIT_KIND_LABELS[r.kind as DepositKind], amount: r.amount, actual: r.actualAmount,
    checked: !!r.checkedAt, note: r.note, checkNote: r.checkNote, trxNumber: r.trxNumber, tripId: r.tripId,
    tripNumber: r.tripId ? tripOf.get(r.tripId) ?? null : null,
    by: (r.createdByEmployeeId != null ? names.get(r.createdByEmployeeId) : null) ?? accountName.get(r.createdByAccountId) ?? '-',
    on: wibDate(r.createdAt), at: wibClock(r.createdAt),
    recorded: r.recordedAt ? { ref: r.recordedRef ?? '-', on: wibDate(r.recordedAt) } : null,
    voided: r.voidedAt ? { reason: r.voidReason ?? '-' } : null,
  });
}

/** Halaman Titipan Toko: toko yang pernah menitip, saldo, menunggu diperiksa, riwayat, nota berpiutang untuk dipakai. */
export async function depositsScreen(actor: Actor | null) {
  if (!actor || !canSee(actor)) return null;
  const rows = await db.select().from(storeDeposits).orderBy(desc(storeDeposits.id)).limit(2000);
  const customerIds = [...new Set(rows.map((r) => r.customerId))];
  const [customers, debts, view] = await Promise.all([
    customerIds.length ? db.execute<{ id: number; name: string }>(sql`select id, name from logistics.pos_customers where id in (${ids(customerIds)})`) : [],
    customerIds.length ? db.execute<{ customer_id: number; transaction_id: number; trx_number: string; remaining_amount: number }>(sql`
      select customer_id, transaction_id, trx_number, remaining_amount from logistics.pos_open_debts
      where customer_id in (${ids(customerIds)}) order by created_at`) : [],
    entryViews(rows),
  ]);
  const nameOf = new Map(customers.map((c) => [Number(c.id), c.name]));
  const stores: DepositStoreView[] = customerIds.map((customerId) => {
    const mine = rows.filter((r) => r.customerId === customerId);
    return {
      customerId, store: nameOf.get(customerId) ?? `Pelanggan #${customerId}`,
      balance: depositBalance(mine.map((r) => ({ kind: r.kind as DepositKind, amount: r.amount, actualAmount: r.actualAmount, voided: !!r.voidedAt }))),
      waitingCheck: mine.filter((r) => r.kind === 'IN' && !r.checkedAt).reduce((s, r) => s + r.amount, 0),
      entries: mine.map(view),
      debts: debts.filter((d) => Number(d.customer_id) === customerId)
        .map((d) => ({ transactionId: Number(d.transaction_id), number: d.trx_number, remaining: Number(d.remaining_amount) })),
    };
  }).sort((a, b) => b.waitingCheck - a.waitingCheck || b.balance - a.balance || a.store.localeCompare(b.store));
  return { stores, canAct: can(actor, DO) };
}

export type PendingDepositView = DepositEntryView & { customerId: number; store: string; ready: boolean };

/** Titipan menunggu diperiksa (Terima Uang): `ready` = trip sudah Menuju Garasi / selesai. */
export async function pendingDeposits(actor: Actor | null): Promise<{ rows: PendingDepositView[]; canCheck: boolean } | null> {
  if (!actor || !canSee(actor)) return null;
  const rows = await db.select().from(storeDeposits).where(and(eq(storeDeposits.kind, 'IN'), isNull(storeDeposits.checkedAt))).orderBy(storeDeposits.id);
  if (!rows.length) return { rows: [], canCheck: can(actor, DO) };
  const [view, customers, ready] = await Promise.all([
    entryViews(rows),
    db.execute<{ id: number; name: string }>(sql`select id, name from logistics.pos_customers where id in (${ids([...new Set(rows.map((r) => r.customerId))])})`),
    db.execute<{ id: number }>(sql`select id from logistics.trips where id in (${ids(rows.map((r) => r.tripId!))}) and (heading_home_at is not null or status <> 'RUNNING')`),
  ]);
  const nameOf = new Map(customers.map((c) => [Number(c.id), c.name]));
  const readySet = new Set(ready.map((t) => Number(t.id)));
  return {
    rows: rows.map((r) => ({ ...view(r), customerId: r.customerId, store: nameOf.get(r.customerId) ?? '-', ready: readySet.has(r.tripId!) })),
    canCheck: can(actor, DO),
  };
}

export type DepositUseView = DepositEntryView & { customerId: number; store: string };

/** Perlu dicatat di kasir › Pakai titipan: belum dicatat, dan 30 terakhir yang sudah dicatat. */
export async function depositUsesToRecord(actor: Actor | null): Promise<{ waiting: DepositUseView[]; done: DepositUseView[] } | null> {
  if (!actor || !can(actor, DO)) return null;
  const [waiting, done] = await Promise.all([
    db.select().from(storeDeposits).where(and(eq(storeDeposits.kind, 'USE'), isNull(storeDeposits.voidedAt), isNull(storeDeposits.recordedAt))).orderBy(storeDeposits.id),
    db.select().from(storeDeposits).where(and(eq(storeDeposits.kind, 'USE'), sql`${storeDeposits.recordedAt} is not null`)).orderBy(desc(storeDeposits.recordedAt)).limit(30),
  ]);
  const all = [...waiting, ...done];
  if (!all.length) return { waiting: [], done: [] };
  const [view, customers] = await Promise.all([
    entryViews(all),
    db.execute<{ id: number; name: string }>(sql`select id, name from logistics.pos_customers where id in (${ids([...new Set(all.map((r) => r.customerId))])})`),
  ]);
  const nameOf = new Map(customers.map((c) => [Number(c.id), c.name]));
  const map = (r: Row): DepositUseView => ({ ...view(r), customerId: r.customerId, store: nameOf.get(r.customerId) ?? '-' });
  return { waiting: waiting.map(map), done: done.map(map) };
}

/** Angka Beranda Finance: titipan menunggu diperiksa + pemakaian belum dicatat di kasir. */
export async function depositAttention(actor: Actor | null): Promise<{ toCheck: number; toRecord: number }> {
  if (!actor || !can(actor, DO)) return { toCheck: 0, toRecord: 0 };
  const [row] = await db.execute<{ to_check: number; to_record: number }>(sql`
    select count(*) filter (where kind = 'IN' and checked_at is null)::int as to_check,
      count(*) filter (where kind = 'USE' and voided_at is null and recorded_at is null)::int as to_record
    from logistics.store_deposits`);
  return { toCheck: Number(row?.to_check ?? 0), toRecord: Number(row?.to_record ?? 0) };
}

/** Titipan yang dicatat bersama Terkirim kunjungan ini (ringkasan kartu kunjungan). */
export async function visitDeposits(visitIds: number[]): Promise<Map<number, number>> {
  if (!visitIds.length) return new Map();
  const rows = await db.select({ visitId: storeDeposits.visitId, amount: storeDeposits.amount }).from(storeDeposits)
    .where(and(eq(storeDeposits.kind, 'IN'), inArray(storeDeposits.visitId, visitIds)));
  return new Map(rows.map((r) => [r.visitId!, r.amount]));
}
