import { and, eq, inArray } from 'drizzle-orm';
import { advanceInstallments, advanceMovements, advances } from '@petshop/hris-db/schema/advances';
import { db } from '@/lib/db';
import { can, hasAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { todayWib } from '@/modules/employees';
import { filesUploadedBy } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { checkReason, settingOn } from '@/modules/settings';
import {
  MSG_NO_SLIP, SPECIAL_EVENT_KINDS_DEFAULT, addDays, advanceNumber, firstPeriodFrom, installmentsProblem, nextOpenPeriod, periodLabel, placeFrom,
  reduceAmountProblem, reduceOrder, repayDateProblem, rescheduleProblem, rupiah, splitInstallments, type IsoDate, type SlipKind, type SlipTrack,
} from '../rules/advance';
import {
  activeSourceOf, basisOnDate, carriedRowsOf, closedPeriodsOf, hasPackageOn, lastPeriodOf, leavingOn, loadAdvances, lockAdvances, lockPersonSlips, nextNumber,
  payBasisOf, personOf, personTrack, rulesOn, shrinkCarry, trackOf, type AdvanceView, type Executor, type InstallmentRow,
} from './data';
import { installmentIdOfKey, isAdvanceKey } from './slip';

// Sesudah kasbon diberikan (spec L5 §3.9–3.11; DRV-68 s.d. 76, 134 s.d. 141): pelunasan tunai, hapus utang, pembatalannya,
// ubah jadwal, Kasbon Khusus, dan pindah slip utama. Tiap perubahan jadwal = versi baru (DRV-132); tidak ada yang dihapus.

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });
type Done = ServiceResult<{ message: string; id?: number }>;

/** Cicilan yang masih menunggu dipotong: Terjadwal, atau Menunggu slip mingguan (spec L5 §9 butir 3). */
export const WAITING = ['SCHEDULED', 'WAITING_WEEKLY'];
export const isWaiting = (status: string) => WAITING.includes(status);

async function accountOf(employeeId: number) {
  return (await activeHrisAccounts([employeeId])).get(employeeId) ?? null;
}

/** Sisa potongan kasbon yang sedang dibawa milik satu kasbon, paling lama lebih dulu. */
export async function carriesOf(executor: Executor, view: AdvanceView) {
  const ids = new Set(view.installments.map((i) => i.id));
  return (await carriedRowsOf(executor, view.row.employeeId)).filter((r) => isAdvanceKey(r.sourceKey) && ids.has(installmentIdOfKey(r.sourceKey!)));
}

type NewPiece = { sequence: number; total: number; amount: number; periodStart: IsoDate | null; slipKind: SlipKind };

/** Jalur slip tujuan satu cicilan; "Menunggu slip mingguan" (sebelum L7b-2) = periode bulanan yang belum dipasang ulang. */
export const kindOf = (i: Pick<InstallmentRow, 'slipKind' | 'status'>): SlipKind => (i.status === 'WAITING_WEEKLY' ? 'MONTHLY' : (i.slipKind as SlipKind));
export const labelOf = (i: Pick<InstallmentRow, 'slipKind' | 'status' | 'periodStart'>) => periodLabel(i.periodStart!, kindOf(i));

/** Tulis versi jadwal baru: cicilan yang masih menunggu → Diganti; potongan baru dengan periodenya (DRV-132). */
export async function writeVersion(tx: Tx, view: AdvanceView, pieces: readonly NewPiece[], cause: string, sync = true) {
  const open = view.installments.filter((i) => isWaiting(i.status));
  const version = view.installments.reduce((max, i) => Math.max(max, i.version), 0) + 1;
  if (open.length) await tx.update(advanceInstallments).set({ status: 'REPLACED' }).where(inArray(advanceInstallments.id, open.map((i) => i.id)));
  const rows = pieces.filter((p) => p.amount > 0);
  if (rows.length) {
    await tx.insert(advanceInstallments).values(rows.map((p) => ({ advanceId: view.row.id, version, ...p, status: 'SCHEDULED', cause })));
  }
  if (sync) await syncMainSlip(view.row.employeeId, tx, false);
}

/** Kurangi sisa (pelunasan / hapus): sisa dibawa lebih dulu, lalu cicilan terdekat (DRV-136, 137). */
async function reduceInTx(tx: Tx, view: AdvanceView, amount: number, cause: 'REPAY' | 'WRITE_OFF') {
  const carries = await carriesOf(tx, view);
  const open = view.installments.filter((i) => isWaiting(i.status) && i.periodStart);
  const plan = reduceOrder(amount, carries.map((c) => ({ id: c.id, amount: c.amount })), open.map((i) => ({ id: i.id, amount: i.amount, periodStart: i.periodStart! })));
  for (const piece of plan.fromCarry) {
    const carry = carries.find((c) => c.id === piece.id)!;
    if (!(await shrinkCarry(tx, carry, piece.rest))) return fail(409, 'Sisa potongan kasbon ini baru saja berubah (slip sedang ditutup). Muat ulang, lalu ulangi.');
  }
  const touched = plan.schedule.some((s) => s.amount !== open.find((o) => o.id === s.id)?.amount);
  if (touched) {
    await writeVersion(tx, view, plan.schedule.map((s) => {
      const old = open.find((o) => o.id === s.id)!;
      return { sequence: old.sequence, total: old.total, amount: s.amount, periodStart: s.periodStart, slipKind: kindOf(old) };
    }), cause);
  }
  return null;
}

/** Kembalikan jumlah ke jadwal (batal pelunasan / hapus, DRV-138): ke cicilan terdekat, atau satu cicilan baru di slip terbuka berikutnya. */
async function addBackInTx(tx: Tx, view: AdvanceView, amount: number, today: IsoDate) {
  const open = view.installments.filter((i) => isWaiting(i.status) && i.periodStart)
    .sort((a, b) => (a.periodStart! < b.periodStart! ? -1 : a.periodStart! > b.periodStart! ? 1 : a.id - b.id));
  if (open.length) {
    await writeVersion(tx, view, open.map((i, index) => ({
      sequence: i.sequence, total: i.total, amount: i.amount + (index === 0 ? amount : 0), periodStart: i.periodStart, slipKind: kindOf(i),
    })), 'UNDO');
    return labelOf(open[0]);
  }
  const track = await personTrack(view.row.employeeId, today, tx);
  const person = await personOf(view.row.employeeId);
  const closed = await closedPeriodsOf(view.row.employeeId, tx, track.kind);
  const [period] = placeFrom(1, track.startOf(today), closed, person ? lastPeriodOf(person, track) : null, track);
  const sequence = view.installments.reduce((max, i) => Math.max(max, i.sequence), 0) + 1;
  await writeVersion(tx, view, [{ sequence, total: sequence, amount, periodStart: period, slipKind: track.kind }], 'UNDO');
  return periodLabel(period, track.kind);
}

type RepayInput = { amount: unknown; sourceId: unknown; moneyDate: unknown; dateReason?: unknown; proofFileId?: unknown };

/** DRV-L34 Terima pelunasan tunai (DRV-70, 136): Finance, Pemilik, GM; penerima bukan pemilik kasbon kecuali Pemilik/GM. */
export async function repayAdvance(actor: Actor | null, advanceId: number, input: RepayInput, announce: ChangeAnnounce, now: Date = new Date()): Promise<Done> {
  if (!actor || !(actor.fullAccess || hasAction(actor, 'advance.repay'))) return fail(403, 'Anda tidak berhak menerima pelunasan kasbon.');
  const today = todayWib(now);
  const amount = Number(input.amount);
  const moneyDate = String(input.moneyDate ?? '');
  const dateReason = String(input.dateReason ?? '').trim() || null;
  const proofFileId = String(input.proofFileId ?? '').trim() || null;
  const source = await activeSourceOf(Number(input.sourceId));
  if (!source) return fail(400, 'Pilih sumber uang yang aktif.');
  return db.transaction(async (tx) => {
    const [pre] = await loadAdvances({ ids: [advanceId] }, tx);
    if (!pre) return fail(404, 'Kasbon tidak ditemukan.');
    await lockAdvances(tx);
    await lockPersonSlips(tx, pre.row.employeeId);
    const [view] = await loadAdvances({ ids: [advanceId] }, tx);
    const person = await personOf(view.row.employeeId);
    if (!person) return fail(404, 'Karyawan tidak ditemukan.');
    if (!actor.fullAccess && !can(actor, 'advance.repay', person.target)) return fail(403, 'Anda tidak berhak menerima pelunasan kasbon orang ini.');
    if (view.row.employeeId === actor.personId && !actor.fullAccess) return fail(403, 'Pelunasan kasbon Anda sendiri diterima orang lain.');
    if (view.stage === 'TRANSFERRED') return fail(409, 'Sisa kasbon ini sudah dialihkan ke Piutang Lain; pelunasannya dicatat di Piutang Lain.');
    if (view.stage !== 'RUNNING') return fail(409, 'Hanya kasbon yang sedang berjalan yang bisa dilunasi.');
    const problem = reduceAmountProblem(amount, view.remaining)
      ?? repayDateProblem({ moneyDate, today, handedOn: view.handover!.moneyDate, reason: dateReason });
    if (problem) return fail(400, problem);
    if (proofFileId && !(await filesUploadedBy(tx, actor.accountId, [proofFileId])).length) return fail(400, 'Foto bukti tidak ditemukan. Unggah ulang.');
    const reduced = await reduceInTx(tx, view, amount, 'REPAY');
    if (reduced) return reduced;
    const [move] = await tx.insert(advanceMovements).values({
      advanceId, kind: 'CASH', amount, moneyDate, moneyPlaceId: source.id, proofFileId, reason: dateReason, recordedByAccountId: actor.accountId,
    }).returning({ id: advanceMovements.id });
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'advance', entityId: advanceId, action: 'advance.repay', after: { movementId: move.id, amount, moneyDate, moneyPlaceId: source.id }, reason: dateReason ?? undefined });
    const left = view.remaining - amount;
    const account = await accountOf(view.row.employeeId);
    if (account) {
      await notify(tx, [account], {
        kind: left === 0 ? 'advance.paid_off' : 'advance.repaid',
        title: left === 0 ? `Kasbon ${view.row.number} sudah lunas.` : `Pelunasan kasbon ${view.row.number} ${rupiah(amount)} diterima. Sisa ${rupiah(left)}.`,
        body: left === 0 ? `Dilunasi tunai ${rupiah(amount)}.` : 'Cicilan berikutnya di slip sudah disesuaikan.', link: '/kasbon', entity: 'advance', entityId: advanceId,
      }, actor.accountId);
    }
    if (view.row.employeeId === actor.personId) {
      await announce(tx, actor.accountId, { what: `mencatat pelunasan kasbonnya sendiri ${view.row.number} (${rupiah(amount)})`, link: `/gaji/kasbon/${advanceId}`, entity: 'advance', entityId: advanceId });
    }
    return { ok: true as const, data: { message: `Pelunasan ${rupiah(amount)} tercatat. ${left === 0 ? 'Kasbon lunas.' : `Sisa ${rupiah(left)}.`}` } };
  });
}

/** Pemilik/GM, bukan kasbon miliknya sendiri (spec L5 §5 `advance.manage`). */
function managerProblem(actor: Actor | null, view: AdvanceView | undefined): Fail | null {
  if (!actor?.fullAccess || !hasAction(actor, 'advance.manage')) return fail(403, 'Hanya Pemilik atau GM.');
  if (!view) return fail(404, 'Kasbon tidak ditemukan.');
  if (view.row.employeeId === actor.personId) return fail(403, 'Kasbon Anda sendiri diurus Pemilik atau GM yang lain.');
  return null;
}

/** DRV-L35 Hapus utang (DRV-70, 137): tanpa uang bergerak; dicatat sebagai biaya "Utang kasbon dihapus". Bukan pemberian (DRV-77). */
export async function writeOffAdvance(actor: Actor | null, advanceId: number, input: { amount: unknown; reason: unknown }, announce: ChangeAnnounce, now: Date = new Date()): Promise<Done> {
  const reason = await checkReason(input.reason, 'Alasan menghapus');
  if (!reason.ok) return fail(400, reason.error);
  const amount = Number(input.amount);
  return db.transaction(async (tx) => {
    const [pre] = await loadAdvances({ ids: [advanceId] }, tx);
    const denied = managerProblem(actor, pre);
    if (denied) return denied;
    await lockAdvances(tx);
    await lockPersonSlips(tx, pre.row.employeeId);
    const [view] = await loadAdvances({ ids: [advanceId] }, tx);
    if (view.stage !== 'RUNNING') return fail(409, view.stage === 'TRANSFERRED' ? 'Sisa kasbon ini sudah dialihkan ke Piutang Lain.' : 'Hanya kasbon yang sedang berjalan yang bisa dihapus.');
    const problem = reduceAmountProblem(amount, view.remaining);
    if (problem) return fail(400, problem);
    const reduced = await reduceInTx(tx, view, amount, 'WRITE_OFF');
    if (reduced) return reduced;
    const [move] = await tx.insert(advanceMovements).values({
      advanceId, kind: 'WRITE_OFF', amount, moneyDate: todayWib(now), reason: reason.reason, recordedByAccountId: actor!.accountId,
    }).returning({ id: advanceMovements.id });
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'advance', entityId: advanceId, action: 'advance.write_off', after: { movementId: move.id, amount }, reason: reason.reason });
    const left = view.remaining - amount;
    const account = await accountOf(view.row.employeeId);
    if (account) {
      await notify(tx, [account], {
        kind: 'advance.written_off', title: `Utang kasbon ${view.row.number} ${rupiah(amount)} dihapus. ${left === 0 ? 'Kasbon selesai.' : `Sisa ${rupiah(left)}.`}`,
        body: `Alasan: ${reason.reason}`, link: '/kasbon', entity: 'advance', entityId: advanceId,
      }, actor!.accountId);
    }
    await announce(tx, actor!.accountId, { what: `menghapus utang kasbon ${view.row.number} sebesar ${rupiah(amount)}`, link: `/gaji/kasbon/${advanceId}`, entity: 'advance', entityId: advanceId });
    return { ok: true as const, data: { message: `Utang ${rupiah(amount)} dihapus. ${left === 0 ? 'Kasbon selesai.' : `Sisa ${rupiah(left)}.`}` } };
  });
}

/** DRV-L39 Batalkan pelunasan atau hapus (DRV-138): catatan Dibalik, jumlahnya kembali ke jadwal. */
export async function reverseMovement(actor: Actor | null, advanceId: number, movementId: number, reasonInput: unknown, announce: ChangeAnnounce, now: Date = new Date()): Promise<Done> {
  const reason = await checkReason(reasonInput, 'Alasan membatalkan');
  if (!reason.ok) return fail(400, reason.error);
  return db.transaction(async (tx) => {
    const [pre] = await loadAdvances({ ids: [advanceId] }, tx);
    const denied = managerProblem(actor, pre);
    if (denied) return denied;
    await lockAdvances(tx);
    await lockPersonSlips(tx, pre.row.employeeId);
    const [view] = await loadAdvances({ ids: [advanceId] }, tx);
    const move = view.movements.find((m) => m.id === movementId);
    if (!move || (move.kind !== 'CASH' && move.kind !== 'WRITE_OFF')) return fail(404, 'Catatan pelunasan atau hapus tidak ditemukan.');
    if (move.status !== 'ACTIVE') return fail(409, 'Catatan ini sudah dibatalkan.');
    if (view.stage === 'TRANSFERRED') return fail(409, 'Sisa kasbon ini sudah dialihkan ke Piutang Lain; catatan tidak dibatalkan.');
    const done = await tx.update(advanceMovements).set({ status: 'REVERSED', reversedAt: new Date(), reversedByAccountId: actor!.accountId, reversedReason: reason.reason })
      .where(and(eq(advanceMovements.id, movementId), eq(advanceMovements.status, 'ACTIVE'))).returning({ id: advanceMovements.id });
    if (!done.length) return fail(409, 'Catatan ini baru saja diubah orang lain.');
    const where = await addBackInTx(tx, view, move.amount, todayWib(now));
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'advance', entityId: advanceId, action: 'advance.movement_reverse', before: { movementId, kind: move.kind, amount: move.amount }, after: null, reason: reason.reason });
    const what = move.kind === 'CASH' ? 'Pelunasan' : 'Hapus utang';
    const account = await accountOf(view.row.employeeId);
    if (account) {
      await notify(tx, [account], {
        kind: 'advance.movement_reversed', title: `${what} kasbon ${view.row.number} ${rupiah(move.amount)} dibatalkan; jumlahnya kembali dipotong di slip ${where}.`,
        body: `Alasan: ${reason.reason}`, link: '/kasbon', entity: 'advance', entityId: advanceId,
      }, actor!.accountId);
    }
    await announce(tx, actor!.accountId, { what: `membatalkan ${what.toLowerCase()} kasbon ${view.row.number} (${rupiah(move.amount)})`, link: `/gaji/kasbon/${advanceId}`, entity: 'advance', entityId: advanceId });
    return { ok: true as const, data: { message: `${what} dibatalkan. ${rupiah(move.amount)} kembali ke cicilan slip ${where}.` } };
  });
}

/** Slip terbuka terdekat untuk ubah jadwal: periode cicilan menunggu paling awal atau periode hari ini, melewati yang ditutup. */
export function nearestOpenOf(view: AdvanceView, today: IsoDate, closed: ReadonlySet<IsoDate>, track: SlipTrack): IsoDate {
  const earliest = view.installments.filter((i) => isWaiting(i.status) && i.periodStart && kindOf(i) === track.kind).map((i) => i.periodStart!).sort()[0];
  const current = track.startOf(today);
  return nextOpenPeriod(earliest && earliest < current ? earliest : current, closed, track);
}

/** Batas ubah jadwal pada jalur slip utama orang itu hari ini (bulanan atau mingguan). */
export async function rescheduleLimits(view: AdvanceView, today: IsoDate, executor: Executor = db) {
  const track = await personTrack(view.row.employeeId, today, executor);
  const closed = await closedPeriodsOf(view.row.employeeId, executor, track.kind);
  const rules = await rulesOn(today);
  const maxCount = view.row.kind === 'SPECIAL' ? Number(await settingOn<number>('advance.special_max_installments', today)) || 12 : rules.maxInstallments;
  const maxAhead = Number(await settingOn<number>('advance.reschedule_max_ahead', today) ?? 3);
  const total = view.installments.filter((i) => isWaiting(i.status)).reduce((s, i) => s + i.amount, 0);
  return { closed, maxCount, maxAhead: Number.isFinite(maxAhead) ? maxAhead : 3, total, nearestOpen: nearestOpenOf(view, today, closed, track), track };
}

/** DRV-L36 Ubah jadwal (DRV-69, 135): jumlah tetap = cicilan yang menunggu; tidak memakai jatah tunda. */
export async function rescheduleAdvance(actor: Actor | null, advanceId: number, input: { count: unknown; start: unknown; reason: unknown }, now: Date = new Date()): Promise<Done> {
  const reason = await checkReason(input.reason, 'Alasan mengubah jadwal');
  if (!reason.ok) return fail(400, reason.error);
  const today = todayWib(now);
  return db.transaction(async (tx) => {
    const [pre] = await loadAdvances({ ids: [advanceId] }, tx);
    const denied = managerProblem(actor, pre);
    if (denied) return denied;
    await lockAdvances(tx);
    await lockPersonSlips(tx, pre.row.employeeId);
    const [view] = await loadAdvances({ ids: [advanceId] }, tx);
    if (view.stage !== 'RUNNING') return fail(409, 'Hanya kasbon yang sedang berjalan yang bisa diubah jadwalnya.');
    const person = await personOf(view.row.employeeId);
    const limits = await rescheduleLimits(view, today, tx);
    const lastPeriod = person ? lastPeriodOf(person, limits.track) : null;
    const count = Number(input.count);
    const start = String(input.start ?? '');
    const problem = rescheduleProblem({
      count, maxCount: limits.maxCount, start, nearestOpen: limits.nearestOpen, maxAhead: limits.maxAhead, closed: limits.closed, lastPeriod, total: limits.total, track: limits.track,
    });
    if (problem) return fail(400, problem);
    const amounts = splitInstallments(limits.total, count);
    const periods = placeFrom(count, start, limits.closed, lastPeriod, limits.track);
    const done = view.installments.filter((i) => i.status === 'TAKEN' || i.status === 'PARTIAL').length;
    await writeVersion(tx, view, amounts.map((amount, index) => ({
      sequence: done + index + 1, total: done + count, amount, periodStart: periods[index], slipKind: limits.track.kind,
    })), 'RESCHEDULE');
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'advance', entityId: advanceId, action: 'advance.reschedule', after: { amounts, periods }, reason: reason.reason });
    const account = await accountOf(view.row.employeeId);
    const text = `${count} kali potong mulai gajian ${periodLabel(periods[0], limits.track.kind)} (${amounts.map(rupiah).join(' + ')})`;
    if (account) {
      await notify(tx, [account], {
        kind: 'advance.rescheduled', title: `Jadwal cicilan kasbon ${view.row.number} diubah: ${text}.`, body: `Alasan: ${reason.reason}`, link: '/kasbon', entity: 'advance', entityId: advanceId,
      }, actor!.accountId);
    }
    return { ok: true as const, data: { message: `Jadwal diubah: ${text}.` } };
  });
}

/** Jenis kejadian Kasbon Khusus dari pengaturan (DRV-76). */
export async function specialEventKinds(today: IsoDate): Promise<string[]> {
  const value = await settingOn<string[]>('advance.special_event_kinds', today);
  return Array.isArray(value) && value.length ? value : SPECIAL_EVENT_KINDS_DEFAULT;
}

type SpecialInput = { employeeId: unknown; eventKind: unknown; reason: unknown; amount: unknown; installments: unknown };

/**
 * DRV-L37 Buat Kasbon Khusus (DRV-73 s.d. 76, 141): Pemilik/GM, bukan untuk dirinya; karyawan aktif berslip utama (bulanan
 * dengan paket gaji, atau mingguan sejak L7b-2).
 * Tanpa syarat masa kerja, batas orang, dana, dan satu-menunggu; tidak dihitung terpakai. Lahir Disetujui, belum diberikan.
 */
export async function createSpecialAdvance(actor: Actor | null, input: SpecialInput, announce: ChangeAnnounce, now: Date = new Date()): Promise<Done> {
  if (!actor?.fullAccess || !hasAction(actor, 'advance.manage')) return fail(403, 'Kasbon Khusus hanya dibuat Pemilik atau GM.');
  const today = todayWib(now);
  const employeeId = Number(input.employeeId);
  if (employeeId === actor.personId) return fail(403, 'Kasbon Khusus untuk Anda sendiri dibuat Pemilik atau GM yang lain.');
  const person = await personOf(employeeId);
  if (!person?.activeToday) return fail(404, 'Pilih karyawan aktif.');
  const basis = await payBasisOf(person.positionId, today);
  if (!basis || (basis === 'MONTHLY' && !(await hasPackageOn(employeeId, today)))) return fail(409, MSG_NO_SLIP);
  if (leavingOn(person, today)) return fail(409, 'Tanggal berhenti orang ini sudah tercatat; Kasbon Khusus tidak dibuat.');
  const kinds = await specialEventKinds(today);
  const eventKind = String(input.eventKind ?? '');
  if (!kinds.includes(eventKind)) return fail(400, 'Pilih jenis kejadian.');
  const rules = await rulesOn(today);
  const reason = String(input.reason ?? '').trim();
  if (reason.length < rules.reasonMin) return fail(400, `Alasan paling sedikit ${rules.reasonMin} huruf.`);
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount % rules.amountStep !== 0) return fail(400, `Nominal harus kelipatan ${rupiah(rules.amountStep)} dan lebih dari 0.`);
  const maxCount = Number(await settingOn<number>('advance.special_max_installments', today)) || 12;
  const installments = Number(input.installments);
  const countProblem = installmentsProblem(installments, maxCount);
  if (countProblem) return fail(400, countProblem);
  return db.transaction(async (tx) => {
    await lockAdvances(tx);
    const number = advanceNumber(await nextNumber(tx));
    const decidedAt = new Date(now);
    const [row] = await tx.insert(advances).values({
      number, employeeId, kind: 'SPECIAL', requestId: null, filledByAccountId: actor.accountId, filledByEmployeeId: actor.personId,
      requestedAmount: amount, requestedInstallments: installments, reason, fund: basis, finalAmount: amount, finalInstallments: installments,
      decidedByAccountId: actor.accountId, decidedAt, state: 'APPROVED', eventKind,
    }).returning({ id: advances.id });
    const amounts = splitInstallments(amount, installments);
    await tx.insert(advanceInstallments).values(amounts.map((a, index) => ({
      advanceId: row.id, version: 1, sequence: index + 1, total: amounts.length, amount: a, periodStart: null, cause: 'APPROVE',
    })));
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'advance', entityId: row.id, action: 'advance.special_create', after: { number, employeeId, amount, installments, eventKind }, reason });
    const account = await accountOf(employeeId);
    if (account) {
      await notify(tx, [account], {
        kind: 'advance.special_created', title: `Kasbon Khusus ${number} ${rupiah(amount)} dibuat untuk Anda (${eventKind}).`,
        body: `Dicicil ${installments} kali lewat slip gaji mulai uangnya diberikan.`, link: '/kasbon', entity: 'advance', entityId: row.id,
      }, actor.accountId);
    }
    await announce(tx, actor.accountId, { what: `membuat Kasbon Khusus ${number} untuk ${person.name} (${rupiah(amount)}, ${eventKind})`, link: `/gaji/kasbon/${row.id}`, entity: 'advance', entityId: row.id });
    return { ok: true as const, data: { message: `Kasbon Khusus ${number} dibuat. Serahkan uangnya dari Rincian Kasbon.`, id: row.id } };
  });
}

/**
 * Ganti slip utama (DRV-140; L7b-2): cicilan menunggu yang slipnya belum ditutup dan periodenya berakhir pada atau sesudah
 * tanggal pindah dipasang ulang ke jalur slip utama baru, banyak dan nominalnya tetap, mulai periode baru pertama yang
 * dimulai pada atau sesudah tanggal pindah (versi baru, sebab MAIN_SLIP). Cicilan "Menunggu slip mingguan" dari L5b ikut
 * dipasang ke slip mingguan. Dijalankan sesudah jadwal ditulis, saat penempatan disimpan/dibatalkan, dan oleh mesin harian.
 */
export async function syncMainSlip(employeeId: number, tx?: Tx, tell = true): Promise<number> {
  const run = async (executor: Tx) => {
    const person = await personOf(employeeId);
    const cache = new Map<IsoDate, SlipKind | null>();
    const basisOn = async (date: IsoDate) => {
      if (!cache.has(date)) cache.set(date, await basisOnDate(employeeId, date, executor));
      return cache.get(date)!;
    };
    const tracks = { MONTHLY: await trackOf('MONTHLY'), WEEKLY: await trackOf('WEEKLY') };
    let changed = 0;
    let firstId: number | null = null;
    const numbers = new Set<string>();
    let firstNew: { period: IsoDate; kind: SlipKind } | null = null;
    // Beberapa putaran: pindah lalu pindah balik di jadwal yang sama dipasang berurutan maju (paling banyak 4 kali).
    for (let round = 0; round < 4; round += 1) {
      const views = (await loadAdvances({ employeeIds: [employeeId] }, executor)).filter((v) => v.handover);
      let moved = false;
      for (const v of views) {
        const waiting = v.installments.filter((i) => isWaiting(i.status) && i.periodStart)
          .sort((x, y) => (x.periodStart! < y.periodStart! ? -1 : x.periodStart! > y.periodStart! ? 1 : x.id - y.id));
        let from = -1;
        let target: SlipKind | null = null;
        for (let k = 0; k < waiting.length; k += 1) {
          const kind = kindOf(waiting[k]);
          const basis = await basisOn(tracks[kind].endOf(waiting[k].periodStart!));
          if (basis && basis !== kind) { from = k; target = basis; break; }
        }
        // "Menunggu slip mingguan" yang dasar gajinya kembali Bulanan: kembali Terjadwal di tempat (seperti L5b).
        const back = waiting.slice(0, from < 0 ? waiting.length : from).filter((i) => i.status === 'WAITING_WEEKLY').map((i) => i.id);
        if (back.length) {
          await executor.update(advanceInstallments).set({ status: 'SCHEDULED' }).where(inArray(advanceInstallments.id, back));
          changed += back.length;
          numbers.add(v.row.number);
          firstId ??= v.row.id;
        }
        if (from < 0 || !target) continue;
        // Tanggal pindah: hari pertama di periode cicilan itu yang dasar gajinya sudah jalur baru.
        const head = waiting[from];
        const end = tracks[kindOf(head)].endOf(head.periodStart!);
        let switchOn = head.periodStart!;
        while (switchOn < end && (await basisOn(switchOn)) !== target) switchOn = addDays(switchOn, 1);
        const track = tracks[target];
        const moving = waiting.slice(from);
        const closed = await closedPeriodsOf(employeeId, executor, target);
        const startFits = (await basisOn(track.startOf(switchOn))) === target;
        const periods = placeFrom(moving.length, firstPeriodFrom(switchOn, track, startFits), closed, person ? lastPeriodOf(person, track) : null, track);
        const kept = waiting.slice(0, from).map((i) => ({ sequence: i.sequence, total: i.total, amount: i.amount, periodStart: i.periodStart, slipKind: kindOf(i) }));
        const placed = moving.map((i, index) => ({ sequence: i.sequence, total: i.total, amount: i.amount, periodStart: periods[index], slipKind: target! }));
        await writeVersion(executor, v, [...kept, ...placed], 'MAIN_SLIP', false);
        changed += moving.length;
        numbers.add(v.row.number);
        firstId ??= v.row.id;
        if (!firstNew || periods[0] < firstNew.period) firstNew = { period: periods[0], kind: target };
        moved = true;
      }
      if (!moved) break;
    }
    if (changed && tell) {
      const account = await accountOf(employeeId);
      if (account) {
        await notify(executor, [account], {
          kind: 'advance.main_slip_changed',
          title: firstNew
            ? `Slip utama Anda berganti ke ${firstNew.kind === 'WEEKLY' ? 'mingguan' : 'bulanan'}: cicilan kasbon ${[...numbers].join(', ')} dipotong mulai slip ${periodLabel(firstNew.period, firstNew.kind)}.`
            : `Cicilan kasbon ${[...numbers].join(', ')} kembali dipotong di slip bulanan.`,
          body: 'Banyak dan nominal cicilan tetap.', link: '/kasbon', entity: 'advance', entityId: firstId,
        }, null);
      }
    }
    return changed;
  };
  return tx ? run(tx) : db.transaction(run);
}

/** Semua orang yang punya cicilan menunggu (mesin harian: menangkap perubahan dasar gaji jabatan lewat pengaturan). */
export async function syncAllMainSlips(): Promise<number> {
  const rows = await db.selectDistinct({ employeeId: advances.employeeId }).from(advances)
    .innerJoin(advanceInstallments, eq(advanceInstallments.advanceId, advances.id))
    .where(inArray(advanceInstallments.status, WAITING));
  let changed = 0;
  for (const r of rows) changed += await syncMainSlip(r.employeeId);
  return changed;
}
