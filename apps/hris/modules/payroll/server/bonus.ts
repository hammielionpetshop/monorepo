import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import { employees } from '@petshop/hris-db/schema/employees';
import { bonusEntries, bonusPosChanges, bonusTypes, posGroomerLinks } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { getOrgLookup, hasAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { placementOn, todayWib } from '@/modules/employees';
import { notify } from '@/modules/notifications';
import { checkReason, loadRows, resolveSetting, setSettingsBatch, settingOn, upcomingRows } from '@/modules/settings';
import {
  BONUS_KIND_LABELS, BONUS_STATUS_LABELS, amountOf, baseOf, birthStatus, correctionsFor, entryKindLabel, fingerprint, originKeyOf, reconcile,
  type BonusKind, type BonusStatus, type Desired, type EntryKind, type LiveEntry, type PosService, type Recipient,
} from '../rules/bonus';
import { addPeriods, longDate, periodStartOf, rupiah, type IsoDate } from '../rules/salary';
import { isPeriodLocked, periodChoices } from './attendance-pay';
import { accountNames, loadPayrollPeople } from './data';
import { loadTimelines, type Timeline } from './deduction-data';
import { typedBonusTypes } from './free-bonus';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

/**
 * Jasa grooming dan ongkir POS paling awal yang ditarik ke Buku Bonus. Diset ke periode 26 Oktober 2026 supaya bisa diuji
 * di staging dengan data nyata; sebelum produksi diganti ke periode gaji HRIS pertama (spec L4d §9 butir 3).
 */
export const BONUS_FROM: IsoDate = '2026-10-26';

export const BONUS_PERCENT_KEYS = ['payroll.bonus_grooming_percent', 'payroll.bonus_delivery_percent'] as const;
const PERCENT_KEY: Record<BonusKind, (typeof BONUS_PERCENT_KEYS)[number]> = { GROOMING: 'payroll.bonus_grooming_percent', DELIVERY: 'payroll.bonus_delivery_percent' };
const FLAG_KEY = { GROOMING: 'position.bonus_grooming', DELIVERY: 'position.bonus_delivery' } as const;

// ---- Bacaan POS ----

type GroomingRow = {
  id: number; status: string; kasir_branch_id: number; kasir_branch_name: string; trx_number: string; service_name: string; groomer_id: number;
  picked_up_on: string | null; line_total: number; payable_amount: number; lines_total: number; groomer_changed: boolean;
};
type DeliveryRow = {
  id: number; status: string; kasir_branch_id: number; kasir_branch_name: string; trx_number: string; courier_id: number; is_free_shipping: boolean;
  goods_only: boolean; trx_on: string; line_total: number; payable_amount: number; lines_total: number;
};

/** Jasa grooming dan ongkir sejak BONUS_FROM, ditambah semua yang sudah punya baris (supaya batal/retur sesudahnya terbaca). */
export async function readPosServices(): Promise<PosService[]> {
  const known = await db.select({ kind: bonusEntries.kind, ref: bonusEntries.posRefId }).from(bonusEntries).where(sql`coalesce(${bonusEntries.flag}, '') <> 'CORRECTION'`);
  const knownIds = (kind: BonusKind) => known.filter((k) => k.kind === kind && k.ref != null).map((k) => Number(k.ref));
  const inList = (ids: number[]) => (ids.length ? sql.raw(`(${ids.join(',')})`) : sql.raw('(0)'));
  const grooming = await db.execute<GroomingRow>(sql`
    select id, status, kasir_branch_id, kasir_branch_name, trx_number, service_name, groomer_id, picked_up_on::text as picked_up_on,
      line_total, payable_amount, lines_total, groomer_changed
    from hris.pos_grooming_services where picked_up_on >= ${BONUS_FROM}::date or id in ${inList(knownIds('GROOMING'))}`);
  const deliveries = await db.execute<DeliveryRow>(sql`
    select id, status, kasir_branch_id, kasir_branch_name, trx_number, courier_id, is_free_shipping, goods_only, trx_on::text as trx_on,
      line_total, payable_amount, lines_total
    from hris.pos_deliveries where trx_on >= ${BONUS_FROM}::date or id in ${inList(knownIds('DELIVERY'))}`);
  return [
    ...grooming.map((g): PosService => ({
      kind: 'GROOMING', refId: Number(g.id), eligible: g.status === 'DIAMBIL' && g.picked_up_on != null, posGroomerId: Number(g.groomer_id),
      occurredOn: g.picked_up_on, kasirBranchId: Number(g.kasir_branch_id), branchName: String(g.kasir_branch_name), trxNumber: String(g.trx_number),
      serviceName: String(g.service_name), lineTotal: Number(g.line_total), payableAmount: Number(g.payable_amount), linesTotal: Number(g.lines_total),
      groomerChanged: Boolean(g.groomer_changed),
    })),
    ...deliveries.map((d): PosService => ({
      kind: 'DELIVERY', refId: Number(d.id), eligible: d.status !== 'DIBATALKAN' && !d.is_free_shipping, posGroomerId: Number(d.courier_id),
      occurredOn: String(d.trx_on), kasirBranchId: Number(d.kasir_branch_id), branchName: String(d.kasir_branch_name), trxNumber: String(d.trx_number),
      serviceName: d.goods_only ? 'Antar barang' : 'Antar-jemput grooming', lineTotal: Number(d.line_total), payableAmount: Number(d.payable_amount),
      linesTotal: Number(d.lines_total), groomerChanged: false,
    })),
  ];
}

type GroomerLink = { employeeId: number | null; notEmployee: boolean };

async function activeGroomerLinks(executor: typeof db | Tx = db): Promise<Map<number, GroomerLink>> {
  const rows = await executor.select().from(posGroomerLinks).where(isNull(posGroomerLinks.releasedAt));
  return new Map(rows.map((r) => [r.posGroomerId, { employeeId: r.employeeId, notEmployee: r.notEmployee }]));
}

// ---- Hak penerima dan nominal (pintu tulis recordBonus) ----

/** Pembaca hak penerima dan persen yang berlaku pada tanggal kejadian, dengan tembolok per hitungan. */
async function makeResolver() {
  const [timelines, org] = await Promise.all([loadTimelines(), getOrgLookup()]);
  const byId = new Map<number, Timeline>(timelines.map((t) => [t.employeeId, t]));
  const positions = new Map(org.positions.map((p) => [p.id, p]));
  const cache = new Map<string, unknown>();
  const cached = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
    if (!cache.has(key)) cache.set(key, await load());
    return cache.get(key) as T;
  };
  async function recipient(kind: BonusKind, employeeId: number, date: IsoDate): Promise<Recipient> {
    const placement = placementOn(byId.get(employeeId)?.placements ?? [], date);
    const position = placement ? positions.get(placement.positionId) : undefined;
    const name = position?.name.trim().toLowerCase();
    const role = position?.fullAccess ? (name === 'gm' ? 'GM' : 'OWNER') : 'STAFF';
    const flag = placement
      ? await cached(`${kind}:${placement.positionId}:${periodStartOf(date)}`, () => settingOn<string>(FLAG_KEY[kind], date, { positionId: placement.positionId }))
      : 'NO';
    return { employeeId, role, eligibleFlag: flag === 'YES' };
  }
  const percent = (kind: BonusKind, date: IsoDate) => cached(`p:${kind}:${periodStartOf(date)}`, async () => Number(await settingOn<number>(PERCENT_KEY[kind], date)));
  return { recipient, percent, nameOf: (id: number) => byId.get(id)?.name ?? `#${id}` };
}
type Resolver = Awaited<ReturnType<typeof makeResolver>>;

/** Keadaan baris yang diinginkan dari satu jasa POS; `undefined` = penerima belum diketahui (belum dipasangkan). */
async function desiredOf(s: PosService, links: Map<number, GroomerLink>, resolve: Resolver): Promise<Desired | undefined> {
  const link = links.get(s.posGroomerId);
  if (!link) return s.eligible ? undefined : null;
  if (!s.eligible || !s.occurredOn || link.notEmployee || link.employeeId == null) return null;
  const recipient = await resolve.recipient(s.kind, link.employeeId, s.occurredOn);
  const status = birthStatus(s.kind, recipient);
  if (!status) return null;
  const base = baseOf(s);
  const percent = await resolve.percent(s.kind, s.occurredOn);
  const amount = amountOf(base, percent);
  if (amount <= 0) return null;
  return { employeeId: link.employeeId, status, base, percent, amount, occurredOn: s.occurredOn, posGroomerId: s.posGroomerId };
}

type EntryRow = typeof bonusEntries.$inferSelect;
const asLive = (r: EntryRow): LiveEntry => ({
  id: r.id, kind: r.kind as BonusKind, employeeId: r.employeeId, status: r.status as BonusStatus, amount: r.amount, occurredOn: r.occurredOn, posGroomerId: r.posGroomerId,
});

/** Satu-satunya pintu tulis Buku Bonus (GAJ-83): nominal dari dasar hitungan dan persen yang berlaku, kunci asal mencegah dobel. */
async function recordBonus(tx: Tx, s: PosService, d: NonNullable<Desired>, extra: { flag?: string | null; replacesId?: number | null; note?: string | null } = {}) {
  const [row] = await tx.insert(bonusEntries).values({
    kind: s.kind, employeeId: d.employeeId, occurredOn: d.occurredOn, periodStart: periodStartOf(d.occurredOn), kasirBranchId: s.kasirBranchId,
    branchName: s.branchName, baseAmount: d.base, percent: d.percent, amount: d.amount, status: d.status,
    flag: extra.flag ?? (s.groomerChanged ? 'GROOMER_CHANGED' : null), originKey: originKeyOf(s), posRefId: s.refId, posGroomerId: s.posGroomerId,
    trxNumber: s.trxNumber, serviceName: s.serviceName, replacesId: extra.replacesId ?? null, note: extra.note ?? null,
  }).returning({ id: bonusEntries.id });
  return row.id;
}

// ---- Mesin bonus-sync (spec L4d §3.2, §6) ----

/** Menyamakan Buku Bonus dengan data kasir. Idempoten: dua kali jalan tanpa perubahan POS = tanpa tulisan baru. */
export async function syncBonuses() {
  const [services, links, resolve] = await Promise.all([readPosServices(), activeGroomerLinks(), makeResolver()]);
  const live = await db.select().from(bonusEntries)
    .where(and(ne(bonusEntries.status, 'CANCELLED'), ne(bonusEntries.kind, 'TYPED'), sql`coalesce(${bonusEntries.flag}, '') <> 'CORRECTION'`));
  const byKey = new Map(live.map((r) => [r.originKey, r]));
  const changes = await db.select().from(bonusPosChanges);
  const counts = { created: 0, updated: 0, replaced: 0, cancelled: 0, flagged: 0, unpaired: 0 };
  for (const s of services) {
    const desired = await desiredOf(s, links, resolve);
    const existing = byKey.get(originKeyOf(s)) ?? null;
    if (desired === undefined) {
      counts.unpaired += 1;
      continue;
    }
    const entryChanges = existing ? changes.filter((c) => c.entryId === existing.id) : [];
    const decided = entryChanges.filter((c) => c.status !== 'OPEN').map((c) => String((c.after as { fp?: string }).fp ?? ''));
    const action = reconcile(existing ? asLive(existing) : null, desired, { periodLocked: existing ? await isPeriodLocked(existing.periodStart, existing.employeeId) : false, decidedFingerprints: decided });
    if (action.kind === 'none') continue;
    await db.transaction(async (tx) => {
      if (action.kind === 'create' && desired) {
        await recordBonus(tx, s, desired);
        counts.created += 1;
      } else if (action.kind === 'status' && existing) {
        await tx.update(bonusEntries).set({ status: action.status }).where(eq(bonusEntries.id, existing.id));
        counts.updated += 1;
      } else if (action.kind === 'cancel' && existing) {
        await tx.update(bonusEntries).set({ status: 'CANCELLED', reason: s.eligible ? 'Penerima di kasir bukan lagi karyawan penerima bonus.' : 'Dibatalkan atau diretur di kasir.' })
          .where(eq(bonusEntries.id, existing.id));
        counts.cancelled += 1;
      } else if (action.kind === 'replace' && existing && desired) {
        const note = `Berubah di kasir: ${resolve.nameOf(existing.employeeId)} ${rupiah(existing.amount)} menjadi ${resolve.nameOf(desired.employeeId)} ${rupiah(desired.amount)}.`;
        await tx.update(bonusEntries).set({ status: 'CANCELLED', reason: note }).where(eq(bonusEntries.id, existing.id));
        await recordBonus(tx, s, desired, { flag: action.flag, replacesId: existing.id, note });
        counts.replaced += 1;
      } else if (action.kind === 'flag_change' && existing) {
        const after = {
          fp: fingerprint(desired), cancelled: desired == null, employeeId: desired?.employeeId ?? null, amount: desired?.amount ?? 0,
          base: desired?.base ?? 0, percent: desired?.percent ?? null, occurredOn: desired?.occurredOn ?? null, posGroomerId: desired?.posGroomerId ?? null,
          text: desired ? `${resolve.nameOf(desired.employeeId)} ${rupiah(desired.amount)}${desired.occurredOn !== existing.occurredOn ? ` (tanggal ${longDate(desired.occurredOn)})` : ''}` : 'Dibatalkan atau diretur di kasir',
        };
        const openChange = entryChanges.find((c) => c.status === 'OPEN');
        if (openChange) {
          if ((openChange.after as { fp?: string }).fp === after.fp) return;
          await tx.update(bonusPosChanges).set({ after }).where(eq(bonusPosChanges.id, openChange.id));
        } else {
          await tx.insert(bonusPosChanges).values({ entryId: existing.id, after });
        }
        counts.flagged += 1;
      }
    });
  }
  return counts;
}

export async function runBonusSync() {
  return syncBonuses();
}

export async function syncNow(actor: Actor | null): Promise<ServiceResult<Awaited<ReturnType<typeof syncBonuses>>>> {
  if (!hasAction(actor, 'bonus.sync')) return fail(403, 'Anda tidak berhak menarik data bonus.');
  return { ok: true, data: await syncBonuses() };
}

// ---- Siapa melihat dan memutus ----

/** Bonus jabatan Pemilik/GM dan orang bertanda "gaji hanya terlihat Pemilik dan GM" tidak dikirim ke non-Pemilik/GM (GAJ-46). */
async function hiddenPeople(actor: Actor | null, today: IsoDate): Promise<Set<number>> {
  if (actor?.fullAccess) return new Set();
  const people = await loadPayrollPeople(today);
  return new Set(people.filter((p) => p.ownerOnly || p.isOwnerPosition || p.isGmPosition).map((p) => p.id));
}

async function checkDecider(actor: Actor | null, employeeId: number, today: IsoDate): Promise<Fail | null> {
  if (!hasAction(actor, 'bonus.approve')) return fail(403, 'Anda tidak berhak memutus bonus.');
  if (employeeId === actor!.personId) return fail(403, 'Bonus Anda sendiri diputuskan orang lain.');
  if ((await hiddenPeople(actor, today)).has(employeeId)) return fail(403, 'Bonus orang ini diputuskan Pemilik atau GM.');
  return null;
}

async function personName(executor: typeof db | Tx, id: number) {
  return (await executor.select({ name: employees.name }).from(employees).where(eq(employees.id, id)))[0]?.name ?? `#${id}`;
}

async function tellPerson(tx: Tx, employeeId: number, actorAccountId: number, input: { kind: string; title: string; body?: string; entityId: number }) {
  const account = (await activeHrisAccounts([employeeId])).get(employeeId);
  if (account) await notify(tx, [account], { ...input, link: `/pemberitahuan`, entity: 'bonus_entry' }, actorAccountId);
}

async function slipNote(periodStart: IsoDate, employeeId: number) {
  return (await isPeriodLocked(periodStart, employeeId)) ? 'Masuk slip periode berikutnya.' : `Masuk slip periode ${longDate(periodStart)}.`;
}

// ---- Pengesahan (GAJ-26, 85) ----

/** Sahkan bonus grooming satu groomer satu periode: tepat baris yang tampil di layar (dikirim id-nya). */
export async function approveGrooming(actor: Actor | null, ids: number[], announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ total: number; count: number }>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return fail(400, 'Tidak ada bonus yang dipilih.');
  const rows = await db.select().from(bonusEntries).where(inArray(bonusEntries.id, unique));
  if (rows.length !== unique.length || rows.some((r) => r.kind !== 'GROOMING' || r.status !== 'PENDING')) {
    return fail(409, 'Daftar bonus berubah sejak layar dibuka. Muat ulang halaman, lalu ulangi.');
  }
  const first = rows[0];
  if (rows.some((r) => r.employeeId !== first.employeeId || r.periodStart !== first.periodStart)) return fail(400, 'Pengesahan hanya per groomer per periode.');
  if (rows.length > 1 && rows.some((r) => r.flag === 'GROOMER_CHANGED')) return fail(400, 'Putuskan dulu satu per satu baris bertanda ganti groomer.');
  const today = todayWib(now);
  const denied = await checkDecider(actor, first.employeeId, today);
  if (denied) return denied;
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const note = await slipNote(first.periodStart, first.employeeId);
  const result = await db.transaction(async (tx) => {
    const done = await tx.update(bonusEntries).set({ status: 'APPROVED', decidedByAccountId: actor!.accountId, decidedByEmployeeId: actor!.personId, decidedAt: now })
      .where(and(inArray(bonusEntries.id, unique), eq(bonusEntries.status, 'PENDING'))).returning({ id: bonusEntries.id });
    if (done.length !== unique.length) {
      tx.rollback();
    }
    const name = await personName(tx, first.employeeId);
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'bonus_entry', entityId: first.id, action: 'bonus.approve', before: { status: 'PENDING', ids: unique }, after: { status: 'APPROVED', total } });
    await tellPerson(tx, first.employeeId, actor!.accountId, {
      kind: 'bonus.approved', entityId: first.id,
      title: `Bonus grooming periode ${longDate(first.periodStart)} disahkan: ${rows.length} jasa, ${rupiah(total)}.`, body: note,
    });
    if (actor!.fullAccess) {
      await announce(tx, actor!.accountId, { what: `mengesahkan bonus grooming ${name} periode ${longDate(first.periodStart)} (${rupiah(total)})`, link: `/bonus/persetujuan?periode=${first.periodStart}`, entity: 'bonus_entry', entityId: first.id });
    }
    return { ok: true as const, data: { total, count: rows.length } };
  }).catch((error: unknown) => {
    if (error instanceof Error && /rollback/i.test(error.message)) return fail(409, 'Daftar bonus berubah sejak layar dibuka. Muat ulang halaman, lalu ulangi.');
    throw error;
  });
  // Orang yang slip terakhirnya sudah Dibayar: bonus ini menjadi tagihan bayar di luar slip (spec L4f §3.7).
  if (result.ok) await (await import('./off-slip')).syncOffSlipClaimsQuietly([first.employeeId]);
  return result;
}

/** Tolak (Menunggu/Ditahan) atau Batalkan (Disahkan sebelum periodenya terkunci), alasan wajib. */
export async function rejectOrCancelBonus(actor: Actor | null, id: number, reasonInput: unknown, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<object>> {
  const [row] = await db.select().from(bonusEntries).where(eq(bonusEntries.id, id));
  if (!row) return fail(404, 'Bonus tidak ditemukan.');
  const denied = await checkDecider(actor, row.employeeId, todayWib(now));
  if (denied) return denied;
  // Bonus Bebas (L4d-2): hanya Pemilik/GM; usulan HR diputus di kotak Persetujuan, bukan di sini.
  if (row.kind === 'TYPED') {
    if (!actor?.fullAccess || !hasAction(actor, 'bonus.approve_free')) return fail(403, 'Bonus Bebas hanya dibatalkan Pemilik atau GM.');
    if (row.status !== 'APPROVED') return fail(409, row.requestId ? 'Usulan ini diputuskan di menu Persetujuan.' : 'Bonus ini sudah diputuskan.');
  }
  const reason = await checkReason(reasonInput, 'Alasan');
  if (!reason.ok) return fail(400, reason.error);
  const cancelling = row.status === 'APPROVED';
  if (!cancelling && row.status !== 'PENDING' && row.status !== 'HELD') return fail(409, 'Bonus ini sudah diputuskan.');
  if (row.status === 'IN_SLIP' || row.status === 'FORFEITED' || row.status === 'PAID_OUTSIDE') return fail(409, 'Bonus ini sudah masuk slip yang ditutup; perbaiki lewat koreksi.');
  const next: BonusStatus = cancelling ? 'CANCELLED' : 'REJECTED';
  return db.transaction(async (tx) => {
    const done = await tx.update(bonusEntries).set({ status: next, reason: reason.reason, decidedByAccountId: actor!.accountId, decidedByEmployeeId: actor!.personId, decidedAt: now })
      .where(and(eq(bonusEntries.id, id), eq(bonusEntries.status, row.status))).returning({ id: bonusEntries.id });
    if (!done.length) return fail(409, 'Bonus ini baru saja diputuskan orang lain.');
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'bonus_entry', entityId: id, action: cancelling ? 'bonus.cancel' : 'bonus.reject', before: { status: row.status }, after: { status: next }, reason: reason.reason });
    await tellPerson(tx, row.employeeId, actor!.accountId, {
      kind: 'bonus.rejected', entityId: id,
      title: row.kind === 'TYPED'
        ? `${(await typeNames()).get(row.typeId ?? 0) ?? 'Bonus Bebas'} ${rupiah(row.amount)} ${cancelling ? 'dibatalkan' : 'ditolak'}.`
        : `Bonus ${BONUS_KIND_LABELS[row.kind as BonusKind].toLowerCase()} ${rupiah(row.amount)} (${row.trxNumber ?? '-'}) ${cancelling ? 'dibatalkan' : 'ditolak'}.`,
      body: `Alasan: ${reason.reason}`,
    });
    if (actor!.fullAccess) {
      await announce(tx, actor!.accountId, { what: `${cancelling ? 'membatalkan' : 'menolak'} bonus ${await personName(tx, row.employeeId)} ${rupiah(row.amount)}`, link: '/bonus/buku', entity: 'bonus_entry', entityId: id });
    }
    return { ok: true as const, data: {} };
  });
}

/** Perubahan dari kasir atas bonus final: Terima perubahan (baris koreksi di periode berjalan) atau Biarkan (GAJ-90). */
export async function decidePosChange(actor: Actor | null, changeId: number, accept: boolean, reasonInput: unknown, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<object>> {
  const [change] = await db.select().from(bonusPosChanges).where(eq(bonusPosChanges.id, changeId));
  if (!change || change.status !== 'OPEN') return fail(409, 'Perubahan ini sudah diputuskan.');
  const [entry] = await db.select().from(bonusEntries).where(eq(bonusEntries.id, change.entryId));
  const today = todayWib(now);
  const denied = await checkDecider(actor, entry.employeeId, today);
  if (denied) return denied;
  const after = change.after as { cancelled: boolean; employeeId: number | null; amount: number; base: number; percent: number | null; occurredOn: string | null; posGroomerId: number | null; text: string };
  if (accept && after.employeeId != null && after.employeeId === actor!.personId) return fail(403, 'Perubahan ini menyangkut bonus Anda sendiri.');
  const reason = await checkReason(reasonInput, 'Alasan');
  if (!reason.ok) return fail(400, reason.error);
  const desired: Desired = after.cancelled || after.employeeId == null ? null
    : { employeeId: after.employeeId, status: 'APPROVED', base: after.base, percent: after.percent ?? 0, amount: after.amount, occurredOn: after.occurredOn ?? entry.occurredOn, posGroomerId: after.posGroomerId ?? 0 };
  const period = periodStartOf(today);
  return db.transaction(async (tx) => {
    const done = await tx.update(bonusPosChanges).set({ status: accept ? 'ACCEPTED' : 'IGNORED', reason: reason.reason, decidedByAccountId: actor!.accountId, decidedAt: now })
      .where(and(eq(bonusPosChanges.id, changeId), eq(bonusPosChanges.status, 'OPEN'))).returning({ id: bonusPosChanges.id });
    if (!done.length) return fail(409, 'Perubahan ini baru saja diputuskan orang lain.');
    let firstCorrection: number | null = null;
    if (accept) {
      for (const c of correctionsFor(entry, desired)) {
        const [row] = await tx.insert(bonusEntries).values({
          kind: entry.kind, employeeId: c.employeeId, occurredOn: today, periodStart: period, kasirBranchId: entry.kasirBranchId, branchName: entry.branchName,
          baseAmount: c.amount, percent: null, amount: c.amount, status: 'APPROVED', flag: 'CORRECTION', originKey: `CORRECTION:${changeId}:${c.employeeId}`,
          posRefId: entry.posRefId, posGroomerId: entry.posGroomerId, trxNumber: entry.trxNumber, serviceName: entry.serviceName, replacesId: entry.id,
          note: `Koreksi dari kasir (periode asal ${longDate(entry.periodStart)}): ${after.text}.`,
          decidedByAccountId: actor!.accountId, decidedByEmployeeId: actor!.personId === c.employeeId ? null : actor!.personId, decidedAt: now,
        }).returning({ id: bonusEntries.id });
        firstCorrection ??= row.id;
        await tellPerson(tx, c.employeeId, actor!.accountId, {
          kind: 'bonus.correction', entityId: row.id,
          title: `Koreksi bonus ${BONUS_KIND_LABELS[entry.kind as BonusKind].toLowerCase()} ${c.amount < 0 ? '−' : '+'}${rupiah(Math.abs(c.amount))} (${entry.trxNumber ?? '-'}).`,
          body: `Perubahan di kasir: ${after.text}. Masuk slip periode ${longDate(period)}.`,
        });
      }
      if (firstCorrection) await tx.update(bonusPosChanges).set({ correctionEntryId: firstCorrection }).where(eq(bonusPosChanges.id, changeId));
    }
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'bonus_pos_change', entityId: changeId, action: accept ? 'bonus.change_accept' : 'bonus.change_ignore', before: { entry: entry.id }, after: { correction: firstCorrection }, reason: reason.reason });
    if (actor!.fullAccess) {
      await announce(tx, actor!.accountId, { what: `${accept ? 'menerima' : 'membiarkan'} perubahan kasir atas bonus ${await personName(tx, entry.employeeId)}`, link: '/bonus/persetujuan?tab=perubahan', entity: 'bonus_pos_change', entityId: changeId });
    }
    return { ok: true as const, data: {} };
  });
}

// ---- Pasangkan Groomer & Pengantar (PRD 04 §3.3) ----

export async function linkGroomer(
  actor: Actor | null, input: { posGroomerId: number; employeeId: number | null; notEmployee: boolean; note: unknown }, announce: ChangeAnnounce,
): Promise<ServiceResult<object>> {
  if (!hasAction(actor, 'pos_groomer_link.manage')) return fail(403, 'Hanya Pemilik atau GM yang memasangkan groomer.');
  const [pos] = await db.execute<{ id: number; name: string }>(sql`select id, name from hris.pos_groomers where id = ${input.posGroomerId}`);
  if (!pos) return fail(404, 'Nama groomer kasir tidak ditemukan.');
  let note: string | null = null;
  if (input.notEmployee) {
    const checked = await checkReason(input.note, 'Keterangan');
    if (!checked.ok) return fail(400, checked.error);
    note = checked.reason;
  } else {
    if (input.employeeId == null) return fail(400, 'Pilih karyawannya.');
    const [person] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, input.employeeId));
    if (!person) return fail(404, 'Karyawan tidak ditemukan.');
  }
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx.insert(posGroomerLinks).values({
        posGroomerId: input.posGroomerId, employeeId: input.notEmployee ? null : input.employeeId, notEmployee: input.notEmployee, note, createdByAccountId: actor!.accountId,
      }).returning({ id: posGroomerLinks.id });
      await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'pos_groomer_link', entityId: row.id, action: 'pos_groomer_link.create', before: null, after: { ...input, note } });
      const target = input.notEmployee ? 'bukan karyawan HRIS' : await personName(tx, input.employeeId!);
      await announce(tx, actor!.accountId, { what: `memasangkan groomer kasir "${pos.name}" ke ${target}`, link: '/bonus/pasangkan', entity: 'pos_groomer_link', entityId: row.id });
    });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } })?.cause ?? (error as { code?: string });
    if ((cause as { code?: string })?.code === '23505') return fail(409, 'Nama ini sudah dipasangkan. Lepas dulu pasangannya.');
    throw error;
  }
  await syncBonuses();
  return { ok: true, data: {} };
}

export async function unlinkGroomer(actor: Actor | null, posGroomerId: number, reasonInput: unknown, announce: ChangeAnnounce): Promise<ServiceResult<object>> {
  if (!hasAction(actor, 'pos_groomer_link.manage')) return fail(403, 'Hanya Pemilik atau GM yang melepas pasangan groomer.');
  const reason = await checkReason(reasonInput, 'Alasan melepas');
  if (!reason.ok) return fail(400, reason.error);
  const result = await db.transaction(async (tx) => {
    const done = await tx.update(posGroomerLinks).set({ releasedAt: new Date(), releasedByAccountId: actor!.accountId, releaseReason: reason.reason })
      .where(and(eq(posGroomerLinks.posGroomerId, posGroomerId), isNull(posGroomerLinks.releasedAt))).returning({ id: posGroomerLinks.id });
    if (!done.length) return fail(404, 'Pasangan tidak ditemukan.');
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'pos_groomer_link', entityId: done[0].id, action: 'pos_groomer_link.release', before: { posGroomerId }, after: null, reason: reason.reason });
    await announce(tx, actor!.accountId, { what: 'melepas pasangan groomer kasir', link: '/bonus/pasangkan', entity: 'pos_groomer_link', entityId: done[0].id });
    return { ok: true as const, data: {} };
  });
  if (result.ok) await syncBonuses();
  return result;
}

const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** Jasa yang menunggu karena groomer/pengantarnya belum dipasangkan (bonus tidak hilang). */
async function unpairedSummary(services: PosService[], links: Map<number, GroomerLink>, resolve: Resolver) {
  const map = new Map<number, { posGroomerId: number; grooming: number; delivery: number; estimate: number }>();
  for (const s of services) {
    if (!s.eligible || !s.occurredOn || links.has(s.posGroomerId)) continue;
    const g = map.get(s.posGroomerId) ?? { posGroomerId: s.posGroomerId, grooming: 0, delivery: 0, estimate: 0 };
    if (s.kind === 'GROOMING') g.grooming += 1; else g.delivery += 1;
    g.estimate += amountOf(baseOf(s), await resolve.percent(s.kind, s.occurredOn));
    map.set(s.posGroomerId, g);
  }
  return map;
}

export async function groomerLinksScreen(actor: Actor | null) {
  if (!hasAction(actor, 'bonus.view') && !hasAction(actor, 'pos_groomer_link.manage')) return null;
  const [groomers, links, people, services, resolve] = await Promise.all([
    db.execute<{ id: number; name: string; active: boolean; is_groomer: boolean; is_courier: boolean }>(sql`select id, name, active, is_groomer, is_courier from hris.pos_groomers order by name`),
    db.select().from(posGroomerLinks).where(isNull(posGroomerLinks.releasedAt)),
    db.select({ id: employees.id, name: employees.name }).from(employees).orderBy(asc(employees.name)),
    readPosServices(),
    makeResolver(),
  ]);
  const active = new Map(links.map((l) => [l.posGroomerId, l]));
  const waiting = await unpairedSummary(services, new Map([...active].map(([k, v]) => [k, { employeeId: v.employeeId, notEmployee: v.notEmployee }])), resolve);
  const byName = new Map(people.map((p) => [nameKey(p.name), p]));
  const rows = groomers.map((g) => {
    const link = active.get(Number(g.id));
    const suggestion = !link ? byName.get(nameKey(String(g.name))) ?? null : null;
    return {
      posGroomerId: Number(g.id), name: String(g.name), active: Boolean(g.active),
      roles: [g.is_groomer ? 'memandikan' : null, g.is_courier ? 'mengantar' : null].filter(Boolean).join(', ') || '-',
      linkedTo: link?.employeeId ? people.find((p) => p.id === link.employeeId) ?? null : null,
      notEmployee: link?.notEmployee ? link.note : null,
      waiting: waiting.get(Number(g.id)) ?? null,
      suggestion,
    };
  });
  return { rows, people, canManage: hasAction(actor, 'pos_groomer_link.manage') };
}

// ---- Layar Persetujuan Bonus (GAJ-L20) ----

/** Nama jenis ketik per id (L4d-2). */
async function typeNames(): Promise<Map<number, string>> {
  return new Map((await db.select({ id: bonusTypes.id, name: bonusTypes.name }).from(bonusTypes)).map((t) => [t.id, t.name]));
}

const entryView = (r: EntryRow, names: Map<number, string>, accounts: Map<number, string>, types: Map<number, string> = new Map()) => ({
  id: r.id, kind: r.kind as EntryKind, kindLabel: entryKindLabel(r.kind, r.typeId ? types.get(r.typeId) : null), fund: r.fund, requestId: r.requestId,
  employeeId: r.employeeId, name: names.get(r.employeeId) ?? `#${r.employeeId}`, occurredOn: r.occurredOn,
  periodStart: r.periodStart, branchName: r.branchName, baseAmount: r.baseAmount, percent: r.percent, amount: r.amount, status: r.status as BonusStatus,
  flag: r.flag, trxNumber: r.trxNumber, serviceName: r.serviceName, note: r.note, reason: r.reason,
  decidedBy: r.decidedByAccountId ? accounts.get(r.decidedByAccountId) ?? '-' : null,
});
export type BonusEntryView = ReturnType<typeof entryView>;

async function employeeNames() {
  return new Map((await db.select({ id: employees.id, name: employees.name }).from(employees)).map((p) => [p.id, p.name]));
}

export async function bonusApprovalScreen(actor: Actor | null, input: { period: string | null }, now: Date = new Date()) {
  if (!hasAction(actor, 'bonus.view')) return null;
  const today = todayWib(now);
  const periods = periodChoices(today);
  const period = periods.find((p) => p.start === input.period) ?? periods[0];
  const hidden = await hiddenPeople(actor, today);
  const [rows, held, openChanges, names, accounts, services, linkMap, resolve, groomers, types, freePending] = await Promise.all([
    db.select().from(bonusEntries).where(and(eq(bonusEntries.periodStart, period.start), ne(bonusEntries.status, 'CANCELLED'))).orderBy(asc(bonusEntries.occurredOn), asc(bonusEntries.id)),
    db.select().from(bonusEntries).where(eq(bonusEntries.status, 'HELD')).orderBy(asc(bonusEntries.occurredOn)),
    db.select().from(bonusPosChanges).where(eq(bonusPosChanges.status, 'OPEN')).orderBy(asc(bonusPosChanges.createdAt)),
    employeeNames(), accountNames(), readPosServices(), activeGroomerLinks(), makeResolver(),
    db.execute<{ id: number; name: string }>(sql`select id, name from hris.pos_groomers`),
    typeNames(),
    db.select().from(bonusEntries).where(and(eq(bonusEntries.kind, 'TYPED'), eq(bonusEntries.status, 'PENDING'))).orderBy(asc(bonusEntries.occurredOn)),
  ]);
  const visible = (r: EntryRow) => !hidden.has(r.employeeId);
  const view = (r: EntryRow) => entryView(r, names, accounts, types);
  // Bonus Bebas (L4d-2): usulan yang menunggu dari periode mana pun, ditambah yang sudah diputus di periode ini.
  const free = [...freePending, ...rows.filter((x) => x.kind === 'TYPED' && x.status !== 'PENDING')].filter(visible).map(view);
  const grooming = new Map<number, { employeeId: number; name: string; pending: BonusEntryView[]; approvedTotal: number; approvedCount: number }>();
  for (const r of rows.filter((x) => x.kind === 'GROOMING' && x.flag !== 'CORRECTION' && visible(x))) {
    const g = grooming.get(r.employeeId) ?? { employeeId: r.employeeId, name: names.get(r.employeeId) ?? `#${r.employeeId}`, pending: [], approvedTotal: 0, approvedCount: 0 };
    if (r.status === 'PENDING') g.pending.push(view(r));
    if (r.status === 'APPROVED') { g.approvedTotal += r.amount; g.approvedCount += 1; }
    grooming.set(r.employeeId, g);
  }
  const entryIds = openChanges.map((c) => c.entryId);
  const changeEntries = entryIds.length ? await db.select().from(bonusEntries).where(inArray(bonusEntries.id, entryIds)) : [];
  const changes = openChanges.flatMap((c) => {
    const entry = changeEntries.find((e) => e.id === c.entryId);
    if (!entry || !visible(entry)) return [];
    return [{ id: c.id, entry: view(entry), afterText: String((c.after as { text?: string }).text ?? '-'), createdAt: c.createdAt.toISOString() }];
  });
  const unpaired = await unpairedSummary(services, linkMap, resolve);
  const posNames = new Map(groomers.map((g) => [Number(g.id), String(g.name)]));
  return {
    period, periods, me: actor?.personId ?? null,
    grooming: [...grooming.values()].sort((a, b) => b.pending.length - a.pending.length || a.name.localeCompare(b.name)),
    delivery: rows.filter((x) => x.kind === 'DELIVERY' && x.flag !== 'CORRECTION' && visible(x) && (x.status === 'APPROVED' || x.status === 'HELD')).map(view),
    changes,
    held: held.filter(visible).map(view),
    unpaired: [...unpaired.values()].map((u) => ({ ...u, name: posNames.get(u.posGroomerId) ?? `#${u.posGroomerId}` })),
    free,
    can: {
      approve: hasAction(actor, 'bonus.approve'), sync: hasAction(actor, 'bonus.sync'), link: hasAction(actor, 'pos_groomer_link.manage'),
      recordFree: hasAction(actor, 'bonus.record_free') || hasAction(actor, 'bonus.approve_free'),
      cancelFree: Boolean(actor?.fullAccess) && hasAction(actor, 'bonus.approve_free'),
    },
    locked: await isPeriodLocked(period.start),
  };
}

// ---- Buku Bonus (GAJ-L21) ----

export async function bonusBookScreen(actor: Actor | null, input: { period: string | null; kind: string | null; status: string | null; employeeId: number | null }, now: Date = new Date()) {
  const full = hasAction(actor, 'bonus.view');
  if (!full && !hasAction(actor, 'bonus.view_totals')) return null;
  const today = todayWib(now);
  const periods = periodChoices(today);
  const period = periods.find((p) => p.start === input.period) ?? periods[0];
  const [all, types] = await Promise.all([
    db.select().from(bonusEntries).where(eq(bonusEntries.periodStart, period.start)).orderBy(desc(bonusEntries.occurredOn), desc(bonusEntries.id)),
    typeNames(),
  ]);
  const totals = totalsByKind(all.filter((r) => r.status === 'APPROVED'), types).map((t) => ({ ...t, count: all.filter((r) => r.status === 'APPROVED' && kindKey(r) === t.kind && r.flag !== 'CORRECTION').length }));
  if (!full) return { period, periods, totals, rows: null, people: [], filters: input, can: { cancel: false, cancelFree: false }, me: null };
  const [hidden, names, accounts] = await Promise.all([hiddenPeople(actor, today), employeeNames(), accountNames()]);
  const rows = all.filter((r) => !hidden.has(r.employeeId)
    && (!input.kind || r.kind === input.kind) && (!input.status || r.status === input.status) && (!input.employeeId || r.employeeId === input.employeeId))
    .map((r) => entryView(r, names, accounts, types));
  const people = [...new Set(all.filter((r) => !hidden.has(r.employeeId)).map((r) => r.employeeId))].map((id) => ({ id, name: names.get(id) ?? `#${id}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const open = !(await isPeriodLocked(period.start));
  return {
    period, periods, totals, rows, people, filters: input,
    can: { cancel: hasAction(actor, 'bonus.approve') && open, cancelFree: Boolean(actor?.fullAccess) && hasAction(actor, 'bonus.approve_free') && open },
    me: actor?.personId ?? null,
  };
}

/** Kunci kelompok jumlah: GROOMING, DELIVERY, atau TYPED:<id jenis>. */
const kindKey = (r: Pick<EntryRow, 'kind' | 'typeId'>) => (r.kind === 'TYPED' ? `TYPED:${r.typeId}` : r.kind);

/** Jumlah per jenis: Grooming dan Ongkir selalu tampil, jenis ketik bila ada barisnya. */
function totalsByKind(rows: Pick<EntryRow, 'kind' | 'typeId' | 'amount'>[], types: Map<number, string>) {
  const keys = ['GROOMING', 'DELIVERY', ...new Set(rows.filter((r) => r.kind === 'TYPED').map(kindKey))];
  return keys.map((kind) => {
    const own = rows.filter((r) => kindKey(r) === kind);
    const typeId = kind.startsWith('TYPED:') ? Number(kind.slice(6)) : null;
    return { kind, label: typeId != null ? types.get(typeId) ?? 'Bonus Bebas' : BONUS_KIND_LABELS[kind as BonusKind], amount: own.reduce((s, r) => s + r.amount, 0) };
  });
}

// ---- Bonus seseorang (GAJ-L27) dan bacaan slip ----

/** Bonus yang Disahkan satu orang satu periode (dibaca slip 4E-5a): plus ke pendapatan, koreksi minus ke kelompok (c). */
export async function bonusesOf(employeeId: number, periodStart: IsoDate) {
  const rows = await db.select().from(bonusEntries).where(and(eq(bonusEntries.employeeId, employeeId), eq(bonusEntries.periodStart, periodStart), eq(bonusEntries.status, 'APPROVED')));
  const plus = rows.filter((r) => r.amount > 0);
  const minus = rows.filter((r) => r.amount < 0);
  const types = await typeNames();
  return {
    byKind: totalsByKind(plus, types),
    income: plus.reduce((s, r) => s + r.amount, 0),
    /** Bonus bersumber Dana Disiplin (dibaca langkah tutup slip 4E-5a untuk mutasi dana keluar). */
    fromDisciplineFund: plus.filter((r) => r.fund === 'DISCIPLINE_FUND').reduce((s, r) => s + r.amount, 0),
    minusCorrections: minus.map((r) => ({ id: r.id, kind: r.kind as EntryKind, amount: -r.amount, occurredOn: r.occurredOn, note: r.note })),
  };
}

export async function bonusTabScreen(actor: Actor | null, employeeId: number, periodInput: string | null, now: Date = new Date()) {
  if (!hasAction(actor, 'bonus.view')) return null;
  const today = todayWib(now);
  if ((await hiddenPeople(actor, today)).has(employeeId)) return null;
  const [person] = await db.select({ id: employees.id, name: employees.name }).from(employees).where(eq(employees.id, employeeId));
  if (!person) return null;
  const periods = periodChoices(today);
  const period = periods.find((p) => p.start === periodInput) ?? periods[0];
  const [names, accounts, types] = await Promise.all([employeeNames(), accountNames(), typeNames()]);
  const all = await db.select().from(bonusEntries).where(and(eq(bonusEntries.employeeId, employeeId), eq(bonusEntries.periodStart, period.start)))
    .orderBy(asc(bonusEntries.occurredOn), asc(bonusEntries.id));
  // Baris yang diganti tulisan ulang (berubah di kasir) tidak ditampilkan dua kali; penggantinya membawa catatannya.
  const replaced = new Set(all.map((r) => r.replacesId).filter((x): x is number => x != null));
  const rows = all.filter((r) => !(r.status === 'CANCELLED' && replaced.has(r.id))).map((r) => entryView(r, names, accounts, types));
  return { person, period, periods, rows, summary: await bonusesOf(employeeId, period.start) };
}

// ---- Jenis Bonus (GAJ-L23) ----

export async function bonusTypesScreen(actor: Actor | null, now: Date = new Date()) {
  if (!hasAction(actor, 'bonus.view') && !hasAction(actor, 'settings.manage')) return null;
  const today = todayWib(now);
  const org = await getOrgLookup();
  const rows = await loadRows(db, [...BONUS_PERCENT_KEYS]);
  const types = [];
  for (const kind of ['GROOMING', 'DELIVERY'] as BonusKind[]) {
    const own = rows.filter((r) => r.key === PERCENT_KEY[kind]);
    const current = Number(resolveSetting(own, today, {})?.value ?? 0);
    const recipients = [];
    for (const p of org.positions.filter((x) => x.active)) {
      const isGm = p.fullAccess && p.name.trim().toLowerCase() === 'gm';
      const flag = await settingOn<string>(FLAG_KEY[kind], today, { positionId: p.id });
      const allowed = !isGm && !(p.fullAccess && kind === 'DELIVERY') && flag === 'YES';
      if (allowed) recipients.push(p.name);
    }
    types.push({
      kind, label: BONUS_KIND_LABELS[kind], key: PERCENT_KEY[kind], percent: current,
      bornAs: kind === 'GROOMING' ? 'Menunggu — disahkan per groomer per periode' : 'Disahkan otomatis — bisa dibatalkan dengan alasan',
      from: kind === 'GROOMING' ? 'Jasa grooming yang sudah diambil di kasir; tanggal = tanggal kucing diambil' : 'Ongkir nota kasir yang bukan gratis ongkir; tanggal = tanggal nota',
      ownerAllowed: kind === 'GROOMING',
      example: kind === 'GROOMING' ? `Jasa ${rupiah(85000)} sesudah diskon → bonus ${rupiah(amountOf(85000, current))}` : `Ongkir ${rupiah(15000)} → bonus ${rupiah(amountOf(15000, current))}`,
      scheduled: upcomingRows(own, today, 'ALL', null).map((r) => ({ id: r.id, value: Number(r.value), effectiveFrom: r.effectiveFrom })),
      recipients,
    });
  }
  return {
    types, typed: await typedBonusTypes(), nextStart: addPeriods(periodStartOf(today), 1),
    canEdit: hasAction(actor, 'settings.manage'), canEditTyped: Boolean(actor?.fullAccess) && hasAction(actor, 'settings.manage'),
  };
}

export async function saveBonusPercents(actor: Actor | null, input: { values: unknown; effectiveFrom: unknown; reason: unknown }, announce: ChangeAnnounce) {
  const values = typeof input.values === 'object' && input.values !== null ? (input.values as Record<string, unknown>) : {};
  if (Object.keys(values).some((key) => !(BONUS_PERCENT_KEYS as readonly string[]).includes(key))) return fail(400, 'Ada angka yang bukan milik Jenis Bonus.');
  return setSettingsBatch(actor, { values, effectiveFrom: String(input.effectiveFrom ?? ''), reason: String(input.reason ?? '') }, announce);
}

// ---- Perlu perhatian (Beranda) ----

export async function bonusAttentionCounts(actor: Actor | null, now: Date = new Date()) {
  if (!hasAction(actor, 'bonus.view')) return null;
  const hidden = await hiddenPeople(actor, todayWib(now));
  const [held, changes, pending] = await Promise.all([
    db.select({ employeeId: bonusEntries.employeeId }).from(bonusEntries).where(eq(bonusEntries.status, 'HELD')),
    db.select({ id: bonusPosChanges.id }).from(bonusPosChanges).where(eq(bonusPosChanges.status, 'OPEN')),
    db.select({ employeeId: bonusEntries.employeeId }).from(bonusEntries).where(and(eq(bonusEntries.status, 'PENDING'), lte(bonusEntries.periodStart, periodStartOf(todayWib(now))), gte(bonusEntries.periodStart, BONUS_FROM))),
  ]);
  return {
    held: held.filter((r) => !hidden.has(r.employeeId)).length,
    changes: changes.length,
    pending: pending.filter((r) => !hidden.has(r.employeeId)).length,
  };
}

export { BONUS_KIND_LABELS, BONUS_STATUS_LABELS };
