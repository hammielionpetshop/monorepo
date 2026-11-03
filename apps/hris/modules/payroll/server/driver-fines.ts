import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { driverFineKindVersions, driverFineKinds, driverFines, payslipLines, payslips } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { hasAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { listPeopleForModules, todayWib } from '@/modules/employees';
import { filesUploadedBy } from '@/modules/files';
import { crewTripsBetween, dayLabel } from '@/modules/logistics';
import { notify } from '@/modules/notifications';
import type { RequestHandler } from '@/modules/requests';
import { checkReason, settingOn } from '@/modules/settings';
import { objectionDeadline } from '../rules/deductions';
import {
  FINE_STATUS_LABELS, MIN_DESCRIPTION, NOT_A_FINE_NOTE, earliestKindChange, endKind, fineAmountOn, kindChangeProblem, occurredOnProblem, tabOf, targetProblem,
  versionOn, type FineStatus, type FineTab, type KindVersion,
} from '../rules/driver-fines';
import { addDays, longDate, rupiah, type IsoDate } from '../rules/salary';
import { accountNames, loadPeriodPeople, positionFlags, type PayrollPerson } from './data';
import { slippedSourceKeys } from './slip-state';

// Denda driver & kenek (spec L7 §3.6, L7c; DRV-29, 30; S1 s.d. S3).

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });
const LINK = '/gaji/denda-driver';
const isoWib = (date: Date) => new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

const canSeeFines = (actor: Actor | null) => !!actor && (actor.fullAccess || hasAction(actor, 'fine.view') || hasAction(actor, 'fine.propose'));

// ---- Jenis Denda ----

async function kindVersions(executor: typeof db | Tx = db) {
  const rows = await executor.select().from(driverFineKindVersions).orderBy(asc(driverFineKindVersions.effectiveOn), asc(driverFineKindVersions.id));
  const byKind = new Map<number, (KindVersion & { reason: string; createdByAccountId: number | null })[]>();
  for (const r of rows) {
    const list = byKind.get(r.kindId) ?? [];
    list.push({ id: r.id, effectiveOn: r.effectiveOn, amount: r.amount, active: r.active, cancelled: r.cancelledAt != null, reason: r.reason, createdByAccountId: r.createdByAccountId });
    byKind.set(r.kindId, list);
  }
  return byKind;
}

export async function fineKindsScreen(actor: Actor | null, now: Date = new Date()) {
  if (!canSeeFines(actor)) return null;
  const today = todayWib(now);
  const [kinds, versions, names] = await Promise.all([
    db.select().from(driverFineKinds).orderBy(asc(driverFineKinds.sortOrder), asc(driverFineKinds.id)), kindVersions(), accountNames(),
  ]);
  return {
    today,
    canEdit: !!actor?.fullAccess && hasAction(actor, 'fine_kind.manage'),
    kinds: kinds.map((k) => {
      const list = versions.get(k.id) ?? [];
      const current = versionOn(list, today);
      return {
        id: k.id, name: k.name, example: k.example,
        current: current ? { amount: current.amount, active: current.active, effectiveOn: current.effectiveOn } : null,
        versions: list.filter((v) => !v.cancelled).map((v) => ({
          id: v.id, effectiveOn: v.effectiveOn, amount: v.amount, active: v.active, reason: v.reason, by: v.createdByAccountId ? names.get(v.createdByAccountId) ?? '-' : 'Isi awal',
          future: v.effectiveOn > today,
        })).reverse(),
      };
    }),
  };
}

type KindInput = { id?: unknown; name: unknown; example: unknown; amount: unknown; active: unknown; effectiveOn: unknown; reason: unknown };

/**
 * Tambah jenis atau ubah jenis (Pemilik/GM). Nama dan contoh langsung berganti; nominal dan aktif lewat versi bertanggal:
 * lebih berat bagi orang paling cepat 7 hari lagi, lebih ringan 1 hari (spec L7 §3.6). Versi tanggal sama yang belum berlaku diganti.
 */
export async function saveFineKind(actor: Actor | null, input: KindInput, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ id: number }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'fine_kind.manage')) return fail(403, 'Hanya Pemilik atau GM yang mengubah Jenis Denda.');
  const name = String(input.name ?? '').trim();
  if (name.length < 3 || name.length > 60) return fail(400, 'Nama jenis 3 sampai 60 huruf.');
  const example = String(input.example ?? '').trim().slice(0, 300);
  const amount = Number(input.amount);
  const active = input.active !== false;
  const effectiveOn = String(input.effectiveOn ?? '');
  const reason = String(input.reason ?? '').trim();
  const today = todayWib(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn)) return fail(400, 'Tanggal berlaku tidak sah.');
  try {
    return await db.transaction(async (tx) => {
      const id = input.id ? Number(input.id) : null;
      const versions = id ? (await kindVersions(tx)).get(id) ?? [] : [];
      const before = versionOn(versions, addDays(effectiveOn, -1));
      const problem = kindChangeProblem({ amount, active, effectiveOn, reason }, earliestKindChange(before, { amount, active }, today));
      if (id) {
        const [old] = await tx.select().from(driverFineKinds).where(eq(driverFineKinds.id, id));
        if (!old) return fail(404, 'Jenis tidak ditemukan.');
        const atDate = versionOn(versions, effectiveOn);
        const numbersChanged = !atDate || atDate.amount !== amount || atDate.active !== active;
        if (numbersChanged && problem) return fail(400, problem);
        await tx.update(driverFineKinds).set({ name, example }).where(eq(driverFineKinds.id, id));
        if (numbersChanged) {
          const same = versions.find((v) => !v.cancelled && v.effectiveOn === effectiveOn);
          if (same) {
            if (same.effectiveOn <= today) return fail(409, 'Versi tanggal itu sudah berlaku; pilih tanggal lain.');
            await tx.update(driverFineKindVersions).set({ cancelledAt: now, cancelledByAccountId: actor.accountId }).where(eq(driverFineKindVersions.id, same.id));
          }
          await tx.insert(driverFineKindVersions).values({ kindId: id, effectiveOn, amount, active, reason, createdByAccountId: actor.accountId });
        }
        await recordAudit(tx, {
          actorAccountId: actor.accountId, entity: 'driver_fine_kind', entityId: id, action: 'driver_fine_kind.update',
          before: { name: old.name, example: old.example }, after: { name, example, ...(numbersChanged ? { amount, active, effectiveOn } : {}) }, reason: numbersChanged ? reason : undefined,
        });
        await announce(tx, actor.accountId, { what: `mengubah Jenis Denda ${name}${numbersChanged ? ` (${active ? rupiah(amount) : 'nonaktif'} mulai ${longDate(effectiveOn)})` : ''}`, link: '/pengaturan/jenis-denda', entity: 'driver_fine_kind', entityId: id });
        return { ok: true as const, data: { id } };
      }
      if (!active) return fail(400, 'Jenis baru harus aktif.');
      if (problem) return fail(400, problem);
      const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${driverFineKinds.sortOrder}), 0) + 1` }).from(driverFineKinds);
      const [row] = await tx.insert(driverFineKinds).values({ name, example, sortOrder: Number(next), createdByAccountId: actor.accountId }).returning({ id: driverFineKinds.id });
      await tx.insert(driverFineKindVersions).values({ kindId: row.id, effectiveOn, amount, active: true, reason, createdByAccountId: actor.accountId });
      await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'driver_fine_kind', entityId: row.id, action: 'driver_fine_kind.create', before: null, after: { name, amount, effectiveOn }, reason });
      await announce(tx, actor.accountId, { what: `menambah Jenis Denda ${name} ${rupiah(amount)} mulai ${longDate(effectiveOn)}`, link: '/pengaturan/jenis-denda', entity: 'driver_fine_kind', entityId: row.id });
      return { ok: true as const, data: { id: row.id } };
    });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } })?.cause ?? (error as { code?: string });
    if ((cause as { code?: string })?.code === '23505') return fail(409, 'Nama jenis itu sudah ada.');
    throw error;
  }
}

/** Batalkan perubahan jenis yang belum berlaku. */
export async function cancelFineKindVersion(actor: Actor | null, versionId: number, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<object>> {
  if (!actor?.fullAccess || !hasAction(actor, 'fine_kind.manage')) return fail(403, 'Hanya Pemilik atau GM yang mengubah Jenis Denda.');
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(driverFineKindVersions).where(and(eq(driverFineKindVersions.id, versionId), isNull(driverFineKindVersions.cancelledAt)));
    if (!v) return fail(404, 'Perubahan tidak ditemukan.');
    if (v.effectiveOn <= todayWib(now)) return fail(409, 'Perubahan ini sudah berlaku; buat perubahan baru.');
    const [{ live }] = await tx.select({ live: sql<number>`count(*)::int` }).from(driverFineKindVersions)
      .where(and(eq(driverFineKindVersions.kindId, v.kindId), isNull(driverFineKindVersions.cancelledAt)));
    if (Number(live) <= 1) return fail(409, 'Ini satu-satunya nominal jenis ini; nonaktifkan jenisnya bila tidak dipakai.');
    await tx.update(driverFineKindVersions).set({ cancelledAt: now, cancelledByAccountId: actor.accountId }).where(eq(driverFineKindVersions.id, v.id));
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'driver_fine_kind', entityId: v.kindId, action: 'driver_fine_kind.cancel_version', before: { effectiveOn: v.effectiveOn, amount: v.amount, active: v.active }, after: null });
    await announce(tx, actor.accountId, { what: `membatalkan perubahan Jenis Denda mulai ${longDate(v.effectiveOn)}`, link: '/pengaturan/jenis-denda', entity: 'driver_fine_kind', entityId: v.kindId });
    return { ok: true as const, data: {} };
  });
}

// ---- Ajukan Denda ----

export type FineCandidate = { id: number; name: string; branchName: string; weekly: boolean; trips: { id: number; number: string; role: string }[] };

/** Sasaran sah pada tanggal itu: orang Mingguan atau awak trip, bukan diri sendiri / Pemilik / GM; jabatan bergaji rahasia hanya untuk Pemilik/GM. */
async function candidatesOn(actor: Actor, date: IsoDate): Promise<{ list: FineCandidate[]; all: Map<number, { person: PayrollPerson; weekly: boolean; trips: FineCandidate['trips'] }> }> {
  const [everyone, weekly, crew] = await Promise.all([loadPeriodPeople(date, date, 'ANY'), loadPeriodPeople(date, date, 'WEEKLY'), crewTripsBetween(date, date)]);
  const weeklyIds = new Set(weekly.map((p) => p.id));
  const all = new Map<number, { person: PayrollPerson; weekly: boolean; trips: FineCandidate['trips'] }>();
  for (const person of everyone) {
    if (person.ownerOnly && !actor.fullAccess) continue;
    all.set(person.id, { person, weekly: weeklyIds.has(person.id), trips: crew.filter((c) => c.employeeId === person.id).map((c) => ({ id: c.tripId, number: c.number, role: c.role })) });
  }
  const list: FineCandidate[] = [];
  for (const { person, weekly: w, trips } of all.values()) {
    if (targetProblem({ id: person.id, weekly: w, onTrip: trips.length > 0, ownerOrGm: person.isOwnerPosition || person.isGmPosition }, actor.personId)) continue;
    list.push({ id: person.id, name: person.name, branchName: person.branchName, weekly: w, trips });
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  return { list, all };
}

export async function fineFormScreen(actor: Actor | null, dateInput: string | null, now: Date = new Date()) {
  if (!actor || (!actor.fullAccess && !hasAction(actor, 'fine.propose'))) return null;
  const today = todayWib(now);
  const backdateDays = Number(await settingOn<number>('payroll.fine_backdate_days', today));
  const date = dateInput && !occurredOnProblem(dateInput, today, backdateDays) ? dateInput : today;
  const [{ list }, kinds, versions] = await Promise.all([
    candidatesOn(actor, date), db.select().from(driverFineKinds).orderBy(asc(driverFineKinds.sortOrder), asc(driverFineKinds.id)), kindVersions(),
  ]);
  return {
    today, date, minDate: addDays(today, -backdateDays), backdateDays, direct: actor.fullAccess, note: NOT_A_FINE_NOTE, minDescription: MIN_DESCRIPTION,
    people: list,
    kinds: kinds.flatMap((k) => {
      const amount = fineAmountOn(versions.get(k.id) ?? [], date);
      return amount ? [{ id: k.id, name: k.name, example: k.example, amount }] : [];
    }),
  };
}

type FineInput = { employeeId: unknown; kindId: unknown; occurredOn: unknown; tripId: unknown; description: unknown; photoId: unknown };
type CheckedFine = { person: PayrollPerson; kindId: number; kindName: string; occurredOn: IsoDate; tripId: number | null; tripNumber: string | null; description: string; amount: number; photoId: string | null };

async function checkFine(tx: Tx, actor: Actor, input: FineInput, today: IsoDate): Promise<CheckedFine | Fail> {
  const backdateDays = Number(await settingOn<number>('payroll.fine_backdate_days', today));
  const occurredOn = String(input.occurredOn ?? '');
  const dateProblem = occurredOnProblem(occurredOn, today, backdateDays);
  if (dateProblem) return fail(400, dateProblem);
  const { all } = await candidatesOn(actor, occurredOn);
  const found = all.get(Number(input.employeeId)) ?? null;
  const problem = targetProblem(found && {
    id: found.person.id, weekly: found.weekly, onTrip: found.trips.length > 0, ownerOrGm: found.person.isOwnerPosition || found.person.isGmPosition,
  }, actor.personId);
  if (problem) return fail(400, problem);
  const tripId = input.tripId ? Number(input.tripId) : null;
  const trip = tripId != null ? found!.trips.find((t) => t.id === tripId) : null;
  if (tripId != null && !trip) return fail(400, 'Trip itu bukan trip orang ini pada tanggal kejadian.');
  const [kind] = await tx.select().from(driverFineKinds).where(eq(driverFineKinds.id, Number(input.kindId)));
  const amount = kind ? fineAmountOn((await kindVersions(tx)).get(kind.id) ?? [], occurredOn) : null;
  if (!kind || !amount) return fail(400, 'Pilih jenis denda yang aktif pada tanggal kejadian.');
  const description = String(input.description ?? '').trim();
  if (description.length < MIN_DESCRIPTION) return fail(400, `Uraian kejadian paling sedikit ${MIN_DESCRIPTION} huruf.`);
  if (description.length > 1000) return fail(400, 'Uraian paling banyak 1000 huruf.');
  const photoId = input.photoId ? String(input.photoId) : null;
  if (photoId && !(await filesUploadedBy(tx, actor.accountId, [photoId])).length) return fail(400, 'Foto tidak ditemukan. Unggah ulang fotonya.');
  return { person: found!.person, kindId: kind.id, kindName: kind.name, occurredOn, tripId, tripNumber: trip?.number ?? null, description, amount, photoId };
}

const fineText = (f: { kindName: string; amount: number; occurredOn: IsoDate }) => `Denda ${f.kindName} ${rupiah(f.amount)} (${dayLabel(f.occurredOn)})`;

async function accountOf(employeeId: number) {
  return (await activeHrisAccounts([employeeId])).get(employeeId) ?? null;
}

/** Denda berlaku: orangnya diberi tahu + tombol Ajukan keberatan 3 hari (spec L7 §3.6). */
async function announceActive(tx: Tx, row: { id: number; employeeId: number; amount: number; occurredOn: IsoDate; description: string }, kindName: string, actorAccountId: number, now: Date) {
  const account = await accountOf(row.employeeId);
  if (!account) return;
  await notify(tx, [account], {
    kind: 'driver_fine.active',
    title: `${fineText({ kindName, amount: row.amount, occurredOn: row.occurredOn })} berlaku.`,
    body: `Dipotong di slip utama periode tanggal kejadian (atau slip berikutnya bila sudah ditutup). Uraian: ${row.description}. Bila tidak setuju, ajukan keberatan paling lambat ${longDate(isoWib(objectionDeadline(now)))} pukul 23.59.`,
    link: `/keberatan-potongan/ajukan?jenis=DRIVER_FINE&id=${row.id}`, entity: 'driver_fine', entityId: row.id,
  }, actorAccountId);
}

export async function recordFineDirect(actor: Actor | null, input: FineInput, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ id: number }>> {
  if (!actor?.fullAccess) return fail(403, 'Hanya Pemilik atau GM yang mencatat denda langsung; Kepala Gudang mengajukan usulan.');
  return db.transaction(async (tx) => {
    const checked = await checkFine(tx, actor, input, todayWib(now));
    if ('ok' in checked) return checked;
    const [row] = await tx.insert(driverFines).values({
      employeeId: checked.person.id, kindId: checked.kindId, occurredOn: checked.occurredOn, tripId: checked.tripId, description: checked.description,
      photoFileId: checked.photoId, amount: checked.amount, status: 'ACTIVE', recordedByAccountId: actor.accountId, recordedByEmployeeId: actor.personId,
      approvedByAccountId: actor.accountId, approvedAt: now,
    }).returning({ id: driverFines.id });
    await announceActive(tx, { id: row.id, employeeId: checked.person.id, amount: checked.amount, occurredOn: checked.occurredOn, description: checked.description }, checked.kindName, actor.accountId, now);
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'driver_fine', entityId: row.id, action: 'driver_fine.create', before: null, after: { employeeId: checked.person.id, amount: checked.amount, occurredOn: checked.occurredOn } });
    await announce(tx, actor.accountId, { what: `mencatat ${fineText(checked)} untuk ${checked.person.name}`, link: LINK, entity: 'driver_fine', entityId: row.id });
    return { ok: true as const, data: { id: row.id } };
  });
}

async function loadFine(executor: typeof db | Tx, by: { id?: number; requestId?: number }) {
  const [row] = await executor.select({ fine: driverFines, kindName: driverFineKinds.name }).from(driverFines)
    .innerJoin(driverFineKinds, eq(driverFineKinds.id, driverFines.kindId))
    .where(by.id != null ? eq(driverFines.id, by.id) : eq(driverFines.requestId, by.requestId ?? -1));
  return row ?? null;
}

const personNameOf = async (id: number) => (await listPeopleForModules()).find((p) => p.id === id)?.name ?? `#${id}`;

export function driverFineHandler(announce: ChangeAnnounce): RequestHandler {
  return {
    async prepare(tx, actor, input) {
      if (actor.fullAccess) return fail(400, 'Pemilik dan GM mencatat denda langsung.');
      const checked = await checkFine(tx, actor, input as FineInput, todayWib());
      if ('ok' in checked) return checked;
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `${fineText(checked)} untuk ${checked.person.name}`,
          dedupeKey: null,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            await saveTx.insert(driverFines).values({
              employeeId: checked.person.id, kindId: checked.kindId, occurredOn: checked.occurredOn, tripId: checked.tripId, description: checked.description,
              photoFileId: checked.photoId, amount: checked.amount, status: 'PENDING', requestId, recordedByAccountId: actor.accountId, recordedByEmployeeId: actor.personId,
            });
          },
        },
      };
    },
    async apply(tx, actorAccountId, requestId) {
      const found = await loadFine(tx, { requestId });
      if (!found || found.fine.status !== 'PENDING') return fail(404, 'Usulan denda tidak ditemukan.');
      const row = found.fine;
      if ((await accountOf(row.employeeId)) === actorAccountId) return fail(403, 'Denda atas diri Anda sendiri disahkan pemilik lain.');
      const now = new Date();
      await tx.update(driverFines).set({ status: 'ACTIVE', approvedByAccountId: actorAccountId, approvedAt: now }).where(eq(driverFines.id, row.id));
      await announceActive(tx, row, found.kindName, actorAccountId, now);
      const name = await personNameOf(row.employeeId);
      await announce(tx, actorAccountId, { what: `mengesahkan ${fineText({ ...row, kindName: found.kindName })} untuk ${name}`, link: LINK, entity: 'driver_fine', entityId: row.id });
      return { ok: true as const, effect: `Denda berlaku dan dipotong di slip utama periode ${longDate(row.occurredOn)} (atau slip berikutnya bila sudah ditutup). ${name} diberi tahu dan boleh mengajukan keberatan 3 hari.` };
    },
    async close(tx, actorAccountId, requestId, reason) {
      const found = await loadFine(tx, { requestId });
      if (!found || found.fine.status !== 'PENDING') return;
      const withdrawn = actorAccountId === found.fine.recordedByAccountId;
      await tx.update(driverFines).set({ status: withdrawn ? 'WITHDRAWN' : 'REJECTED' }).where(and(eq(driverFines.id, found.fine.id), eq(driverFines.status, 'PENDING')));
      if (withdrawn) return;
      const account = await accountOf(found.fine.employeeId);
      if (account) {
        await notify(tx, [account], {
          kind: 'driver_fine.rejected', title: `Usulan ${fineText({ ...found.fine, kindName: found.kindName })} ditolak; tidak dipotong.`,
          ...(reason ? { body: `Alasan: ${reason}` } : {}), link: LINK, entity: 'driver_fine', entityId: found.fine.id,
        }, actorAccountId);
      }
    },
    async effectPreview(requestId) {
      const found = await loadFine(db, { requestId });
      if (!found) return 'Usulan ini akan disahkan.';
      return `${rupiah(found.fine.amount)} dipotong di slip utama periode ${longDate(found.fine.occurredOn)} (atau slip berikutnya bila sudah ditutup). Orangnya diberi tahu dan boleh mengajukan keberatan 3 hari.`;
    },
    async describe(requestId) {
      const found = await loadFine(db, { requestId });
      if (!found) return [];
      const f = found.fine;
      const trip = f.tripId ? (await crewTripsBetween(f.occurredOn, f.occurredOn, [f.employeeId])).find((t) => t.tripId === f.tripId) : null;
      return [
        { label: 'Orang', before: null, after: await personNameOf(f.employeeId) },
        { label: 'Jenis', before: null, after: found.kindName },
        { label: 'Tanggal kejadian', before: null, after: longDate(f.occurredOn) },
        ...(trip ? [{ label: 'Trip', before: null, after: trip.number }] : []),
        { label: 'Nominal', before: null, after: rupiah(f.amount) },
        { label: 'Uraian', before: null, after: f.description },
      ];
    },
    async resubmitValues(requestId) {
      const found = await loadFine(db, { requestId });
      return found ? { employeeId: found.fine.employeeId, kindId: found.fine.kindId, occurredOn: found.fine.occurredOn, tripId: found.fine.tripId, description: found.fine.description } : null;
    },
  };
}

// ---- Batalkan / Tiadakan ----

/** Denda sudah terpotong di slip tertutup (langsung, lewat sisa dibawa tidak dihitung: baris asalnya pasti sudah tertutup). */
async function fineSlipped(executor: typeof db | Tx, fineId: number, employeeId: number) {
  return (await slippedSourceKeys([`fine:${fineId}`], employeeId, executor)).size > 0;
}

/** Ubah denda Berlaku menjadi Dibatalkan (belum terpotong) atau Ditiadakan (sudah terpotong → dikembalikan di slip berikutnya). */
export async function endFineIn(tx: Tx, fineId: number, actorAccountId: number, reason: string, now: Date): Promise<{ kind: 'CANCELLED' | 'WAIVED'; row: typeof driverFines.$inferSelect; kindName: string } | Fail> {
  const found = await loadFine(tx, { id: fineId });
  if (!found || found.fine.status !== 'ACTIVE') return fail(404, 'Denda yang berlaku tidak ditemukan.');
  const kind = endKind(await fineSlipped(tx, fineId, found.fine.employeeId));
  const done = await tx.update(driverFines).set({ status: kind, endedAt: now, endedByAccountId: actorAccountId, endReason: reason })
    .where(and(eq(driverFines.id, fineId), eq(driverFines.status, 'ACTIVE'))).returning({ id: driverFines.id });
  if (!done.length) return fail(409, 'Denda ini baru saja diubah orang lain.');
  return { kind, row: found.fine, kindName: found.kindName };
}

export async function endFine(actor: Actor | null, id: number, reasonInput: unknown, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ status: 'CANCELLED' | 'WAIVED' }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'fine.cancel')) return fail(403, 'Hanya Pemilik atau GM yang membatalkan atau meniadakan denda.');
  const reason = await checkReason(reasonInput, 'Alasan');
  if (!reason.ok) return fail(400, reason.error);
  return db.transaction(async (tx) => {
    const [peek] = await tx.select({ employeeId: driverFines.employeeId }).from(driverFines).where(eq(driverFines.id, id));
    if (peek?.employeeId === actor.personId) return fail(403, 'Denda atas diri Anda sendiri diubah pemilik lain.');
    const ended = await endFineIn(tx, id, actor.accountId, reason.reason, now);
    if ('ok' in ended) return ended;
    const { kind, row, kindName } = ended;
    const text = fineText({ ...row, kindName });
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'driver_fine', entityId: id, action: kind === 'WAIVED' ? 'driver_fine.waive' : 'driver_fine.cancel', before: { status: 'ACTIVE' }, after: { status: kind }, reason: reason.reason });
    const recipients = [await accountOf(row.employeeId), row.recordedByAccountId].filter((a): a is number => a != null);
    await notify(tx, recipients, {
      kind: kind === 'WAIVED' ? 'driver_fine.waived' : 'driver_fine.cancelled',
      title: kind === 'WAIVED' ? `${text} ditiadakan; uangnya kembali di slip utama berikutnya.` : `${text} dibatalkan; tidak dipotong.`,
      body: `Alasan: ${reason.reason}`, link: LINK, entity: 'driver_fine', entityId: id,
    }, actor.accountId);
    await announce(tx, actor.accountId, { what: `${kind === 'WAIVED' ? 'meniadakan' : 'membatalkan'} ${text} ${await personNameOf(row.employeeId)}`, link: LINK, entity: 'driver_fine', entityId: id });
    return { ok: true as const, data: { status: kind } };
  });
}

// ---- Layar Denda Driver & Kenek ----

type CutState = 'NOT_YET' | 'CUT' | 'PARTLY' | 'UNCOLLECTIBLE';
export const CUT_STATE_LABELS: Record<CutState, string> = { NOT_YET: 'Belum terpotong', CUT: 'Terpotong', PARTLY: 'Sebagian terpotong, sisa dibawa', UNCOLLECTIBLE: 'Tidak tertagih (slip terakhir)' };

/** Keadaan potong dari baris slip tertutup `fine:<id>`: sisa di slip terakhir = Tidak tertagih (spec L7 §3.6). */
async function cutStates(ids: number[]): Promise<Map<number, { state: CutState; slipNumber: string | null }>> {
  const out = new Map<number, { state: CutState; slipNumber: string | null }>();
  if (!ids.length) return out;
  const rows = await db.select({ key: payslipLines.sourceKey, remaining: payslipLines.remaining, last: payslips.lastSlip, number: payslips.number }).from(payslipLines)
    .innerJoin(payslips, eq(payslips.id, payslipLines.payslipId))
    .where(and(inArray(payslipLines.sourceKey, ids.map((id) => `fine:${id}`)), eq(payslipLines.status, 'ACTIVE'), eq(payslips.status, 'CLOSED'), sql`${payslipLines.version} = ${payslips.version}`));
  for (const r of rows) {
    const id = Number(r.key.slice(5));
    out.set(id, { state: r.remaining > 0 ? (r.last ? 'UNCOLLECTIBLE' : 'PARTLY') : 'CUT', slipNumber: r.number });
  }
  return out;
}

export async function finesScreen(actor: Actor | null, tabInput: string | null) {
  if (!canSeeFines(actor)) return null;
  const tab: FineTab = tabInput === 'ACTIVE' || tabInput === 'DONE' ? tabInput : 'PENDING';
  const seeAll = actor!.fullAccess || hasAction(actor, 'fine.view');
  const [rows, names, people] = await Promise.all([
    db.select({ fine: driverFines, kindName: driverFineKinds.name }).from(driverFines).innerJoin(driverFineKinds, eq(driverFineKinds.id, driverFines.kindId))
      .where(seeAll ? undefined : eq(driverFines.recordedByAccountId, actor!.accountId))
      .orderBy(desc(driverFines.occurredOn), desc(driverFines.id)),
    accountNames(), listPeopleForModules(),
  ]);
  const flags = await positionFlags(people.map((p) => p.positionId), todayWib());
  const visible = rows.filter(({ fine }) => {
    const person = people.find((p) => p.id === fine.employeeId);
    return !(person && flags.get(person.positionId)?.ownerOnly) || actor!.fullAccess;
  });
  const counts: Record<FineTab, number> = { PENDING: 0, ACTIVE: 0, DONE: 0 };
  for (const { fine } of visible) counts[tabOf(fine.status as FineStatus)] += 1;
  const mine = visible.filter(({ fine }) => tabOf(fine.status as FineStatus) === tab);
  const states = await cutStates(mine.filter(({ fine }) => fine.status === 'ACTIVE').map(({ fine }) => fine.id));
  const trips = new Map<number, string>();
  for (const { fine } of mine) {
    if (fine.tripId && !trips.has(fine.tripId)) {
      const t = (await crewTripsBetween(fine.occurredOn, fine.occurredOn, [fine.employeeId])).find((x) => x.tripId === fine.tripId);
      if (t) trips.set(fine.tripId, t.number);
    }
  }
  const canEnd = !!actor!.fullAccess && hasAction(actor, 'fine.cancel');
  return {
    tab, counts,
    canPropose: actor!.fullAccess || hasAction(actor, 'fine.propose'),
    direct: actor!.fullAccess,
    rows: mine.map(({ fine, kindName }) => {
      const cut = states.get(fine.id) ?? null;
      const person = people.find((p) => p.id === fine.employeeId);
      return {
        id: fine.id, name: person?.name ?? `#${fine.employeeId}`, kindName, occurredOn: fine.occurredOn, tripNumber: fine.tripId ? trips.get(fine.tripId) ?? null : null,
        description: fine.description, amount: fine.amount, status: fine.status as FineStatus, statusLabel: FINE_STATUS_LABELS[fine.status as FineStatus],
        recordedBy: names.get(fine.recordedByAccountId) ?? '-', approvedBy: fine.approvedByAccountId ? names.get(fine.approvedByAccountId) ?? '-' : null,
        requestId: fine.requestId, endReason: fine.endReason,
        cut: fine.status === 'ACTIVE' ? { label: CUT_STATE_LABELS[cut?.state ?? 'NOT_YET'], slipNumber: cut?.slipNumber ?? null } : null,
        endAction: canEnd && fine.status === 'ACTIVE' && fine.employeeId !== actor!.personId ? (cut ? 'WAIVE' as const : 'CANCEL' as const) : null,
      };
    }),
  };
}

// ---- Keberatan (dipakai Keberatan Potongan) ----

export async function fineObjectionSubject(fineId: number) {
  const found = await loadFine(db, { id: fineId });
  if (!found || !found.fine.approvedAt) return null;
  return {
    employeeId: found.fine.employeeId, notifiedAt: found.fine.approvedAt, live: found.fine.status === 'ACTIVE',
    text: `${fineText({ ...found.fine, kindName: found.kindName })} — ${found.fine.description}`,
  };
}
