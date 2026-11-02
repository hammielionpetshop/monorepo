// Lembur (spec L3h). Status klaim milik Mesin Pengajuan; modul ini menghitung jam terdeteksi (satu fungsi, WAJ-04),
// menyimpan isi khas klaim, dan menulis akibat pengesahan. Nominal milik Gaji (GAJ-12): di sini hanya jam.
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import {
  branchAssists, branchClosures, dayOffWorkRequests, overtimeClaims, overtimeDays, overtimePhotoViews,
} from '@petshop/hris-db/schema/attendance';
import { db } from '@/lib/db';
import { can, getOrgLookup, listEmployeesWithAnyAction, type Actor, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { notify } from '@/modules/notifications';
import { checkReason, settingOn } from '@/modules/settings';
import { wibClock, wibDate } from '../rules/attendance';
import { daysLeft, isOpenAt, lastDayOf, leftText, urgencyOf } from '../rules/clarification';
import { OFFICE_DEPARTMENT } from '../rules/end-of-day';
import {
  OVERTIME_MARKS_FROM, OVERTIME_STATE_LABELS, approvalProblem, claimDeadline, correctionBlockedByApproval, nextState, officeClosing,
  ordererProblem, overtimeHours, overtimeSkip, overtimeTotals, type OvertimeChoice, type OvertimeSkip, type OvertimeState, type RecapOvertime,
} from '../rules/overtime';
import { payPeriodOf, type DayState } from '../rules/review';
import { addDays, closingTime, versionOn, type IsoDate } from '../rules/schedule';
import { shortDate } from './absence';
import { activeDayOffKeys, loadShifts, rosterOn, type Executor, type RosterPerson } from './read';
import { loadDayInfos } from './review';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });
const FORBIDDEN = 'Anda tidak berhak melakukan tindakan ini.';
const CATCH_UP_DAYS = 14;
const LIST_DAYS = 62;

/** Hari pertama lembur dihitung; tes integrasi menggeser lewat env karena memakai tanggal lampau. */
const marksFrom = (): IsoDate => process.env.HRIS_OVERTIME_MARKS_FROM ?? OVERTIME_MARKS_FROM;

type DayRow = typeof overtimeDays.$inferSelect;
type ClaimRow = typeof overtimeClaims.$inferSelect;

const key = (employeeId: number, date: IsoDate) => `${employeeId}|${date}`;
const yes = (value: unknown) => value === 'YES';
const clock = (at: Date | null | undefined) => (at ? wibClock(at) : '-');
const dot = (time: string | null) => (time ? time.slice(0, 5).replace(':', '.') : '-');
const deadlineText = (deadlineAt: Date) => `sampai ${shortDate(lastDayOf(deadlineAt))} 23.59`;
const targetOf = (person: RosterPerson) => ({ personId: person.employeeId, branchId: person.branchId, departmentId: person.departmentId });

async function overtimeRules(on: IsoDate, executor: Executor = db) {
  const read = (k: Parameters<typeof settingOn>[0]) => settingOn<number>(k, on, {}, executor).then(Number);
  const [claimDays, minHours, maxHours] = await Promise.all([
    read('attendance.overtime_claim_days'), read('attendance.overtime_min_hours'), read('attendance.overtime_max_hours'),
  ]);
  return { claimDays, minHours, maxHours };
}

async function accountsOf(employeeIds: number[]): Promise<number[]> {
  return [...(await activeHrisAccounts(employeeIds)).values()];
}

async function lockPerson(tx: Tx, employeeId: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('attendance.absence'), ${employeeId})`);
}

// ---- Jam terdeteksi: satu fungsi untuk Laporan Pulang, koreksi, penjelasan, dan mesin (KEH-159) ----

export type Detection = {
  hours: number; skip: OvertimeSkip | null; branchId: number | null; scheduledEnd: string | null; outAt: Date | null;
  closing: string | null; explainedOn: IsoDate | null; positionId: number | null;
};

const NONE: Detection = { hours: 0, skip: 'NOT_TRACKED', branchId: null, scheduledEnd: null, outAt: null, closing: null, explainedOn: null, positionId: null };

/**
 * Jam lembur terdeteksi satu orang satu hari. `override` = keadaan hari yang akan ditulis koreksi (untuk menolak
 * koreksi yang menurunkan jam di bawah yang disahkan, KEH-166); tanpa itu dipakai keadaan berlaku sekarang.
 */
export async function detectOvertime(
  employeeId: number, date: IsoDate, executor: Executor = db, now: Date = new Date(), override?: DayState,
): Promise<Detection> {
  const person = (await rosterOn(date, executor)).find((row) => row.employeeId === employeeId);
  if (!person || person.mode !== 'QR') return NONE;
  const info = (await loadDayInfos([employeeId], date, date, executor, now)).get(key(employeeId, date));
  const positionId = info?.day?.positionId ?? person.positionId;
  const [position] = await executor.execute<{ full: boolean; department: string }>(sql`
    select p.full_access as full, d.name as department from hris.positions p join hris.departments d on d.id = p.department_id
    where p.id = ${positionId}`);
  if (!position || position.full) return NONE;
  const state = override ?? info?.effective.state ?? null;
  const eligible = yes(await settingOn<string>('position.overtime_applies', date, { positionId }, executor));
  const branchId = state?.branchId ?? person.branchId;
  const closed = (await executor.select({ id: branchClosures.id }).from(branchClosures).where(and(
    isNull(branchClosures.cancelledAt), lte(branchClosures.startDate, date), gte(branchClosures.endDate, date),
    sql`(${branchClosures.branchId} is null or ${branchClosures.branchId} = ${branchId})`,
  )).limit(1)).length > 0;
  const dayOffWork = (await executor.select({ id: dayOffWorkRequests.id }).from(dayOffWorkRequests).where(and(
    eq(dayOffWorkRequests.employeeId, employeeId), eq(dayOffWorkRequests.workDate, date), ne(dayOffWorkRequests.status, 'CANCELLED'),
  )).limit(1)).length > 0;
  const shifts = await loadShifts([branchId], executor);
  const shift = state?.shiftId != null ? shifts.find((row) => row.id === state.shiftId) : undefined;
  const version = shift?.versions.find((row) => row.id === state?.shiftVersionId) ?? null;
  const skip = overtimeSkip({
    tracked: true, eligible, hasShift: Boolean(version), hasOut: Boolean(state?.inAt && state?.outAt), closed, dayOffWork,
  });
  const latest = override ? null : info?.corrections.at(-1);
  const explainedOn = latest && latest.reasonCode === 'CLARIFICATION' && latest.outAt ? wibDate(latest.createdAt) : null;
  const base = { branchId, positionId, explainedOn, outAt: state?.outAt ?? null, scheduledEnd: version?.endTime ?? null };
  if (skip || !version || !state?.outAt) return { ...base, hours: 0, skip, closing: null };
  const office = position.department.trim().toLowerCase() === OFFICE_DEPARTMENT;
  const closing = office
    ? officeClosing(Number(await settingOn<number>('attendance.office_closing_hour', date, { branchId }, executor)))
    : closingTime(shifts.filter((row) => row.active).map((row) => ({ position: row.position, endTime: versionOn(row.versions, date)?.endTime ?? null })));
  const rules = await overtimeRules(date, executor);
  const hours = overtimeHours({
    workDate: date, startTime: version.startTime, endTime: version.endTime, closing, outAt: state.outAt,
    minHours: rules.minHours, maxHours: rules.maxHours,
  });
  return { ...base, hours, skip: null, closing };
}

async function dayRowsOf(employeeIds: number[] | null, from: IsoDate, to: IsoDate, executor: Executor = db): Promise<DayRow[]> {
  return executor.select().from(overtimeDays).where(and(
    employeeIds ? inArray(overtimeDays.employeeId, employeeIds.length ? employeeIds : [0]) : undefined,
    gte(overtimeDays.workDate, from), lte(overtimeDays.workDate, to),
  )).orderBy(asc(overtimeDays.workDate), asc(overtimeDays.id));
}

async function activeClaimOf(dayId: number, executor: Executor = db): Promise<ClaimRow | null> {
  const [row] = await executor.select().from(overtimeClaims).where(and(eq(overtimeClaims.overtimeDayId, dayId), eq(overtimeClaims.active, true)));
  return row ?? null;
}

/**
 * Pemeriksa sebelum koreksi absen ditulis (KEH-166): jam terdeteksi baru tidak boleh di bawah jam yang sudah disahkan.
 * Mengembalikan pesan penolakan, atau null bila boleh.
 */
export async function overtimeCorrectionProblem(tx: Tx, employeeId: number, date: IsoDate, next: DayState): Promise<string | null> {
  await lockPerson(tx, employeeId);
  const [row] = await tx.select().from(overtimeDays).where(and(eq(overtimeDays.employeeId, employeeId), eq(overtimeDays.workDate, date)));
  if (!row || row.state !== 'APPROVED') return null;
  const claim = await activeClaimOf(row.id, tx);
  if (!claim?.approvedHours) return null;
  const detected = await detectOvertime(employeeId, date, tx, new Date(), next);
  return correctionBlockedByApproval(detected.hours, claim.approvedHours)
    ? `Lembur ${shortDate(date)} sudah disahkan ${claim.approvedHours} jam. Cabut dulu pengesahan lembur tanggal ${shortDate(date)}, lalu koreksi.`
    : null;
}

export type OvertimePrompt = { id: number; dateLabel: string; outClock: string; scheduledEnd: string; hours: number };

/**
 * Selaraskan baris lembur satu orang pada tanggal-tanggal itu (spec L3h §3.2). Baris belum diklaim mengikuti angka baru;
 * yang sudah diklaim/disahkan hanya memperbarui angka tampilan. `quiet` = jangan kirim pemberitahuan (jendela
 * "Ini lembur?" yang memberi tahu). Mengembalikan baris yang baru lahir atau dibuka lagi.
 */
export async function syncOvertimeDays(executor: Tx, employeeId: number, dates: IsoDate[], now: Date = new Date(), quiet = false): Promise<DayRow[]> {
  const today = wibDate(now);
  const due = [...new Set(dates)].filter((date) => date >= marksFrom() && date <= today).sort();
  const born: DayRow[] = [];
  for (const date of due) {
    const found = await detectOvertime(employeeId, date, executor, now);
    const [row] = await executor.select().from(overtimeDays).where(and(eq(overtimeDays.employeeId, employeeId), eq(overtimeDays.workDate, date)));
    const state = nextState((row?.state ?? null) as OvertimeState | null, found.hours);
    if (!state) continue;
    const rules = await overtimeRules(date, executor);
    const deadlineAt = claimDeadline(date, rules.claimDays, found.explainedOn);
    const snapshot = {
      hours: found.hours, branchId: found.branchId ?? row?.branchId ?? 0,
      scheduledEnd: found.scheduledEnd ?? row?.scheduledEnd ?? '-', outAt: found.outAt ?? row?.outAt ?? now,
      closingTime: found.closing ?? row?.closingTime ?? null, explainedForgot: Boolean(found.explainedOn) || Boolean(row?.explainedForgot),
    };
    if (!row) {
      const [created] = await executor.insert(overtimeDays).values({ employeeId, workDate: date, ...snapshot, deadlineAt, state: 'OPEN' })
        .onConflictDoNothing().returning();
      if (created) born.push(created);
      continue;
    }
    // Batas tidak dimulai dari awal, kecuali hari lupa absen pulang baru saja dijelaskan (KEH-165).
    const newlyExplained = Boolean(found.explainedOn) && !row.explainedForgot;
    const reopened = row.state === 'VOID' && state === 'OPEN';
    const [updated] = await executor.update(overtimeDays).set({
      ...snapshot, state, updatedAt: now,
      ...(newlyExplained || reopened ? { deadlineAt: deadlineAt > row.deadlineAt ? deadlineAt : row.deadlineAt } : {}),
      ...(reopened ? { choice: 'UNANSWERED' as const } : {}),
    }).where(eq(overtimeDays.id, row.id)).returning();
    if (reopened || (newlyExplained && state === 'OPEN')) born.push(updated);
  }
  if (born.length && !quiet) {
    const first = born[0];
    await notify(executor, await accountsOf([employeeId]), {
      kind: 'attendance.overtime',
      title: born.length === 1 ? `Terdeteksi lembur ${first.hours} jam ${shortDate(first.workDate)}` : `${born.length} lembur terdeteksi`,
      body: `Klaim dari menu Lembur Saya ${deadlineText(first.deadlineAt)}. Lewat itu hangus.`,
      link: '/lembur',
    }, null);
  }
  return born;
}

/** Jendela "Ini lembur?" (KEH-L40): lembur terbaru yang belum dijawab dan masih dalam batas. */
export async function overtimePromptFor(actor: Actor, now: Date = new Date(), executor: Executor = db): Promise<OvertimePrompt | null> {
  const [row] = await executor.select().from(overtimeDays).where(and(
    eq(overtimeDays.employeeId, actor.personId), eq(overtimeDays.state, 'OPEN'), eq(overtimeDays.choice, 'UNANSWERED'),
    gte(overtimeDays.workDate, addDays(wibDate(now), -7)),
  )).orderBy(desc(overtimeDays.workDate)).limit(1);
  if (!row || !isOpenAt(row.deadlineAt, now)) return null;
  return { id: row.id, dateLabel: shortDate(row.workDate), outClock: clock(row.outAt), scheduledEnd: dot(row.scheduledEnd), hours: row.hours };
}

/** Laporan Pulang terkirim (KEH-160): hitung lembur hari itu lalu kembalikan pertanyaannya bila ada. */
export async function overtimeAfterReport(actor: Actor, workDate: IsoDate, now: Date = new Date()): Promise<OvertimePrompt | null> {
  await db.transaction(async (tx) => {
    await lockPerson(tx, actor.personId);
    await syncOvertimeDays(tx, actor.personId, [workDate], now, true);
  });
  return overtimePromptFor(actor, now);
}

/** Jawab "Nanti" atau "Bukan lembur" (KEH-160). Bisa diubah sampai batas. */
export async function answerOvertime(actor: Actor | null, input: { id: number; choice: 'LATER' | 'NOT_OVERTIME' }, now: Date = new Date()) {
  if (!actor) return fail(403, FORBIDDEN);
  return db.transaction(async (tx) => {
    await lockPerson(tx, actor.personId);
    const [row] = await tx.select().from(overtimeDays).where(eq(overtimeDays.id, input.id));
    if (!row || row.employeeId !== actor.personId) return fail(404, 'Lembur tidak ditemukan.');
    if (row.state !== 'OPEN' || !isOpenAt(row.deadlineAt, now)) return fail(409, 'Lembur ini sudah diklaim, hangus, atau lewat batas. Muat ulang.');
    await tx.update(overtimeDays).set({ choice: input.choice, updatedAt: now }).where(eq(overtimeDays.id, row.id));
    return {
      ok: true as const,
      data: { message: input.choice === 'LATER' ? `Tersimpan. Klaim dari Lembur Saya ${deadlineText(row.deadlineAt)}.` : 'Ditandai bukan lembur. Masih bisa diklaim dari Lembur Saya sampai batas.' },
    };
  });
}

// ---- Siapa memakai Lembur Saya (KEH-25, 99) ----

async function eligibility(actor: Actor, on: IsoDate, executor: Executor = db): Promise<string | null> {
  const person = (await rosterOn(on, executor)).find((row) => row.employeeId === actor.personId);
  if (!person) return 'Data karyawan tidak ditemukan atau tidak aktif.';
  if (actor.fullAccess) return 'Pemilik dan GM tidak memakai Lembur Saya.';
  if (person.mode !== 'QR') return 'Jabatan ini tidak diabsen lewat QR, jadi tidak punya lembur.';
  if (!yes(await settingOn<string>('position.overtime_applies', on, { positionId: person.positionId }, executor))) return 'Jabatan ini tidak dapat lembur.';
  if (!can(actor, 'attendance.self.check', { personId: actor.personId })) return FORBIDDEN;
  return null;
}

/** Orang yang boleh dipilih sebagai penyuruh (KEH-163): aktif, berjabatan "boleh menyuruh lembur", bukan diri sendiri. */
async function orderersOn(on: IsoDate, selfId: number, executor: Executor = db): Promise<{ id: number; name: string }[]> {
  const roster = await rosterOn(on, executor);
  const allowed = new Map<number, boolean>();
  for (const positionId of new Set(roster.map((row) => row.positionId))) {
    allowed.set(positionId, yes(await settingOn<string>('position.overtime_orderer', on, { positionId }, executor)));
  }
  return roster.filter((row) => row.employeeId !== selfId && allowed.get(row.positionId)).map((row) => ({ id: row.employeeId, name: row.name }));
}

// ---- Isi khas pengajuan "Klaim lembur" (RequestHandler) ----

async function claimOf(requestId: number, executor: Executor = db): Promise<ClaimRow | null> {
  const [row] = await executor.select().from(overtimeClaims).where(eq(overtimeClaims.requestId, requestId));
  return row ?? null;
}

async function dayOf(id: number, executor: Executor = db): Promise<DayRow | null> {
  const [row] = await executor.select().from(overtimeDays).where(eq(overtimeDays.id, id));
  return row ?? null;
}

async function nameOf(employeeId: number, executor: Executor = db): Promise<string> {
  const rows = await executor.execute<{ name: string }>(sql`select name from hris.employees where id = ${employeeId}`);
  return rows[0]?.name ?? '-';
}

async function resubmitNth(requestId: number, executor: Executor = db): Promise<number> {
  const rows = await executor.execute<{ n: number }>(sql`
    with recursive chain as (select id, resubmitted_from_id from hris.requests where id = ${requestId}
      union all select r.id, r.resubmitted_from_id from hris.requests r join chain c on r.id = c.resubmitted_from_id)
    select count(*)::int as n from chain`);
  return Number(rows[0]?.n ?? 1) - 1;
}

/** Bentuknya mengikuti `RequestHandler`; dirangkai di `lib/request-handlers.ts`. */
export const overtimeHandler = {
  async prepare(tx: Tx, actor: Actor, input: Record<string, unknown>) {
    const now = new Date();
    const dayId = Number(input.overtimeDayId);
    const ordererId = Number(input.ordererId);
    if (!Number.isInteger(dayId) || dayId <= 0) return fail(400, 'Pilih lembur yang diklaim.');
    if (!Number.isInteger(ordererId) || ordererId <= 0) return fail(400, 'Pilih yang menyuruh lembur.');
    await lockPerson(tx, actor.personId);
    const row = await dayOf(dayId, tx);
    if (!row || row.employeeId !== actor.personId) return fail(403, 'Hanya lembur milik Anda sendiri yang bisa diklaim.');
    const problem = await eligibility(actor, row.workDate, tx);
    if (problem) return fail(403, problem);
    if (!isOpenAt(row.deadlineAt, now)) return fail(409, `Batas klaim lembur ${shortDate(row.workDate)} sudah lewat. Lemburnya hangus; bicarakan langsung dengan pemilik.`);
    if (row.state !== 'OPEN' || row.hours < 1) return fail(409, 'Lembur ini sudah diklaim, hangus, atau tidak ada lagi. Muat ulang.');
    if (await activeClaimOf(row.id, tx)) return fail(409, 'Lembur ini sudah diklaim dan menunggu keputusan.');
    const orderers = await orderersOn(wibDate(now), actor.personId, tx);
    const bad = ordererProblem(ordererId, actor.personId, new Set(orderers.map((o) => o.id)));
    if (bad) return fail(400, bad);
    return {
      ok: true as const,
      data: {
        subjectEmployeeId: actor.personId,
        summary: `Lembur ${row.hours} jam ${shortDate(row.workDate)} (pulang ${clock(row.outAt)}, jadwal ${dot(row.scheduledEnd)})`,
        dedupeKey: `overtime:${row.id}`,
        requiredAttachment: 'Foto kertas lembur',
        save: async (inner: Tx, requestId: number) => {
          await inner.insert(overtimeClaims).values({
            requestId, overtimeDayId: row.id, employeeId: actor.personId, claimedHours: row.hours, ordererEmployeeId: ordererId,
          });
          await inner.update(overtimeDays).set({ state: 'CLAIMED', choice: 'CLAIMED', updatedAt: now }).where(eq(overtimeDays.id, row.id));
        },
      },
    };
  },

  async apply(tx: Tx, _actorAccountId: number, requestId: number, fields: Record<string, unknown> = {}): Promise<{ ok: true; effect: string } | Fail> {
    const claim = await claimOf(requestId, tx);
    if (!claim || !claim.active) return fail(409, 'Klaim lembur ini sudah tidak berlaku. Muat ulang.');
    const row = await dayOf(claim.overtimeDayId, tx);
    if (!row) return fail(404, 'Lembur tidak ditemukan.');
    await lockPerson(tx, claim.employeeId);
    const fresh = await dayOf(claim.overtimeDayId, tx);
    const limit = Math.min(claim.claimedHours, fresh?.hours ?? 0);
    if (limit < 1) return fail(409, 'Sesudah koreksi absen, hari ini tidak punya jam lembur lagi. Tolak klaim ini dengan alasan.');
    const approved = fields.approvedHours == null ? limit : Number(fields.approvedHours);
    if (approved > limit && limit < claim.claimedHours) return fail(400, `Jam terdeteksi sekarang ${limit} jam sesudah koreksi absen. Jam disahkan tidak bisa melebihinya.`);
    let reason: string | null = null;
    if (approved < claim.claimedHours) {
      const checked = await checkReason(fields.reductionReason, 'Alasan menurunkan jam');
      if (!checked.ok) return fail(400, checked.error);
      reason = checked.reason;
    }
    const problem = approvalProblem(approved, claim.claimedHours, reason);
    if (problem) return fail(400, problem);
    await tx.update(overtimeClaims).set({ approvedHours: approved, reductionReason: reason }).where(eq(overtimeClaims.id, claim.id));
    await tx.update(overtimeDays).set({ state: 'APPROVED', updatedAt: new Date() }).where(eq(overtimeDays.id, row.id));
    return {
      ok: true,
      effect: approved < claim.claimedHours
        ? `Lembur ${shortDate(row.workDate)} disahkan ${approved} dari ${claim.claimedHours} jam. Alasan: ${reason}`
        : `Lembur ${shortDate(row.workDate)} disahkan ${approved} jam. Nominalnya dihitung di slip.`,
    };
  },

  /** Ditolak, dibatalkan, atau dicabut: klaim dilepas; lembur kembali Belum diklaim bila masih dalam batas, selain itu hangus. */
  async close(tx: Tx, _actorAccountId: number, requestId: number) {
    const claim = await claimOf(requestId, tx);
    if (!claim || !claim.active) return;
    const now = new Date();
    await tx.update(overtimeClaims).set({ active: false }).where(eq(overtimeClaims.id, claim.id));
    const row = await dayOf(claim.overtimeDayId, tx);
    if (!row) return;
    const open = isOpenAt(row.deadlineAt, now) && row.hours > 0;
    await tx.update(overtimeDays).set({ state: open ? 'OPEN' : 'EXPIRED', choice: 'LATER', updatedAt: now }).where(eq(overtimeDays.id, row.id));
  },

  async revokeBlock(): Promise<string | null> {
    return null;
  },

  async approveOptions(requestId: number) {
    const claim = await claimOf(requestId);
    if (!claim?.active) return null;
    const row = await dayOf(claim.overtimeDayId);
    return { maxHours: Math.min(claim.claimedHours, row?.hours ?? 0), claimedHours: claim.claimedHours };
  },

  async effectPreview(requestId: number) {
    const claim = await claimOf(requestId);
    if (!claim) return '';
    return `Lembur ${claim.claimedHours} jam disahkan dan dibaca Gaji. Boleh diturunkan (jam penuh, dengan alasan), tidak bisa dinaikkan.`;
  },

  async describe(requestId: number, reveal: boolean) {
    const claim = await claimOf(requestId);
    if (!claim) return [];
    const row = await dayOf(claim.overtimeDayId);
    if (!row) return [];
    const rows: { label: string; before: string | null; after: string | null }[] = [
      { label: 'Tanggal', before: null, after: shortDate(row.workDate) },
      { label: 'Jam diklaim', before: null, after: `${claim.claimedHours} jam` },
    ];
    if (claim.approvedHours != null) {
      rows.push({ label: 'Jam disahkan', before: `${claim.claimedHours} jam`, after: `${claim.approvedHours} jam` });
      if (claim.reductionReason) rows.push({ label: 'Alasan penurunan', before: null, after: claim.reductionReason });
    }
    if (!reveal) return rows;
    rows.push({ label: 'Yang menyuruh', before: null, after: await nameOf(claim.ordererEmployeeId) });

    // Keterangan pembantu putusan (KEH-L43): angka server berdampingan dengan yang diklaim.
    const now = await detectOvertime(row.employeeId, row.workDate);
    rows.push({ label: 'Jadwal pulang', before: null, after: dot(row.scheduledEnd) });
    rows.push({ label: 'Jam foto pulang', before: null, after: clock(now.outAt ?? row.outAt) });
    rows.push({ label: 'Jam tutup cabang dipakai', before: null, after: dot(now.closing ?? row.closingTime) });
    rows.push({ label: 'Terdeteksi server', before: `${claim.claimedHours} jam diklaim`, after: `${now.hours} jam sekarang` });
    if (now.hours !== claim.claimedHours) {
      rows.push({ label: 'Perlu dicermati', before: null, after: `Jam terdeteksi berubah sesudah klaim dikirim (koreksi absen). Klaim tetap ${claim.claimedHours} jam.` });
    }
    const period = payPeriodOf(row.workDate);
    const totals = await overtimeTotalsOf([row.employeeId], period.start, period.end);
    const mine = totals.get(row.employeeId) ?? { detected: 0, claimed: 0, approved: 0 };
    rows.push({ label: 'Periode ini', before: null, after: `Diklaim ${mine.claimed} jam, disahkan ${mine.approved} jam` });
    const nth = await resubmitNth(requestId);
    if (nth > 0) rows.push({ label: 'Ajukan ulang', before: null, after: `Ajukan ulang ke-${nth}` });
    if (row.explainedForgot) rows.push({ label: 'Label', before: null, after: 'Hari lupa absen yang dijelaskan' });
    const clashes: string[] = [];
    const [assist] = await db.select({ id: branchAssists.id }).from(branchAssists)
      .where(and(eq(branchAssists.employeeId, row.employeeId), eq(branchAssists.workDate, row.workDate), eq(branchAssists.answer, 'ASSIST')));
    if (assist) clashes.push('perbantuan (jam dan jam tutup cabang tujuan)');
    if ((await activeDayOffKeys([row.employeeId], row.workDate, row.workDate)).size) clashes.push('libur terjadwal');
    if (now.skip === 'CLOSED') clashes.push('hari tutup');
    if (now.skip === 'DAY_OFF_WORK') clashes.push('diminta masuk di hari libur (tanpa lembur)');
    if (clashes.length) rows.push({ label: 'Bentrok', before: null, after: clashes.join(', ') });
    return rows;
  },

  async resubmitValues(requestId: number) {
    const claim = await claimOf(requestId);
    return claim ? { overtimeDayId: claim.overtimeDayId, ordererId: claim.ordererEmployeeId } : null;
  },
};

/** Foto kertas lembur: tiap pembukaan oleh selain pengajunya dicatat (KEH-167). */
export async function logOvertimeAttachmentView(actor: Actor, requestId: number, fileId: string) {
  const claim = await claimOf(requestId);
  if (!claim || claim.employeeId === actor.personId) return;
  await db.insert(overtimePhotoViews).values({ fileId, viewerAccountId: actor.accountId });
}

// ---- Tiga angka rekap (KEH-77) ----

type TotalsRow = { employeeId: number; workDate: IsoDate; state: OvertimeState; hours: number; claimedHours: number | null; approvedHours: number | null };

async function totalsRows(employeeIds: number[], from: IsoDate, to: IsoDate, executor: Executor = db): Promise<TotalsRow[]> {
  if (!employeeIds.length) return [];
  const rows = await executor.select({ day: overtimeDays, claim: overtimeClaims }).from(overtimeDays)
    .leftJoin(overtimeClaims, and(eq(overtimeClaims.overtimeDayId, overtimeDays.id), eq(overtimeClaims.active, true)))
    .where(and(inArray(overtimeDays.employeeId, employeeIds), gte(overtimeDays.workDate, from), lte(overtimeDays.workDate, to)));
  return rows.map(({ day, claim }) => ({
    employeeId: day.employeeId, workDate: day.workDate, state: day.state as OvertimeState, hours: day.hours,
    claimedHours: claim?.claimedHours ?? null, approvedHours: claim?.approvedHours ?? null,
  }));
}

/** Lembur per `orang|tanggal` untuk kartu hari dan rekap. */
export async function overtimeByDay(employeeIds: number[], from: IsoDate, to: IsoDate, executor: Executor = db): Promise<Map<string, RecapOvertime>> {
  const map = new Map<string, RecapOvertime>();
  for (const row of await totalsRows(employeeIds, from, to, executor)) map.set(key(row.employeeId, row.workDate), overtimeTotals([row]));
  return map;
}

/** Lembur per orang dalam rentang (rekap per periode). */
export async function overtimeTotalsOf(employeeIds: number[], from: IsoDate, to: IsoDate, executor: Executor = db): Promise<Map<number, RecapOvertime>> {
  const grouped = new Map<number, TotalsRow[]>();
  for (const row of await totalsRows(employeeIds, from, to, executor)) grouped.set(row.employeeId, [...(grouped.get(row.employeeId) ?? []), row]);
  return new Map([...grouped].map(([id, rows]) => [id, overtimeTotals(rows)]));
}

// ---- Lembur Saya (KEH-L41) ----

export type OvertimeTab = 'open' | 'waiting' | 'done';

export type OvertimeCard = {
  id: number; dateLabel: string; scheduledEnd: string; outClock: string; hours: number; state: OvertimeState; stateLabel: string;
  choice: OvertimeChoice; left: string; urgency: ReturnType<typeof urgencyOf>; deadline: string;
  approvedHours: number | null; claimedHours: number | null; reductionReason: string | null;
  rejection: { requestId: number; reason: string | null } | null; requestId: number | null; note: string | null;
  action: 'claim' | 'resubmit' | null;
};

type RequestInfo = { requestId: number; status: string; reason: string | null; active: boolean; claimedHours: number; approvedHours: number | null; reductionReason: string | null };

async function claimsByDay(dayIds: number[], executor: Executor = db): Promise<Map<number, RequestInfo[]>> {
  const map = new Map<number, RequestInfo[]>();
  if (!dayIds.length) return map;
  const rows = await executor.execute<{
    overtime_day_id: number; request_id: number; status: string; reason: string | null; active: boolean; claimed_hours: number;
    approved_hours: number | null; reduction_reason: string | null;
  }>(sql`select c.overtime_day_id, c.request_id, r.status::text as status, r.decision_reason as reason, c.active, c.claimed_hours,
           c.approved_hours, c.reduction_reason
         from hris.overtime_claims c join hris.requests r on r.id = c.request_id
         where c.overtime_day_id in (${sql.join(dayIds.map((id) => sql`${id}`), sql`, `)}) order by c.id`);
  for (const row of rows) {
    const list = map.get(Number(row.overtime_day_id)) ?? [];
    list.push({
      requestId: Number(row.request_id), status: row.status, reason: row.reason, active: Boolean(row.active),
      claimedHours: Number(row.claimed_hours), approvedHours: row.approved_hours == null ? null : Number(row.approved_hours),
      reductionReason: row.reduction_reason,
    });
    map.set(Number(row.overtime_day_id), list);
  }
  return map;
}

function bucketOf(row: DayRow, now: Date): OvertimeTab | null {
  if (row.state === 'VOID') return null;
  if (row.state === 'CLAIMED') return 'waiting';
  if (row.state === 'OPEN' && isOpenAt(row.deadlineAt, now)) return 'open';
  return 'done';
}

function toCard(row: DayRow, claims: RequestInfo[] | undefined, now: Date): OvertimeCard {
  const active = claims?.find((c) => c.active) ?? null;
  const last = claims?.at(-1) ?? null;
  const open = row.state === 'OPEN' && isOpenAt(row.deadlineAt, now);
  const expired = row.state === 'EXPIRED' || (row.state === 'OPEN' && !open);
  const rejection = !active && last?.status === 'REJECTED' ? { requestId: last.requestId, reason: last.reason } : null;
  const notOvertime = row.choice === 'NOT_OVERTIME';
  return {
    id: row.id, dateLabel: shortDate(row.workDate), scheduledEnd: dot(row.scheduledEnd), outClock: clock(row.outAt), hours: row.hours,
    state: row.state as OvertimeState,
    stateLabel: expired ? (notOvertime ? 'Tidak diklaim' : 'Hangus') : rejection && open ? 'Ditolak' : notOvertime && open ? 'Dijawab bukan lembur' : OVERTIME_STATE_LABELS[row.state as OvertimeState],
    choice: row.choice as OvertimeChoice,
    left: open ? leftText(row.deadlineAt, now) : '', urgency: open ? urgencyOf(row.deadlineAt, now) : 'over', deadline: deadlineText(row.deadlineAt),
    approvedHours: active?.approvedHours ?? null, claimedHours: active?.claimedHours ?? null, reductionReason: active?.reductionReason ?? null,
    rejection, requestId: active?.requestId ?? last?.requestId ?? null,
    note: expired && !notOvertime ? `Lembur ${row.hours} jam tanggal ${shortDate(row.workDate)} hangus. Bicarakan langsung dengan pemilik.`
      : expired ? 'Dijawab bukan lembur dan tidak diklaim sampai batas.' : row.explainedForgot ? 'Hari lupa absen yang dijelaskan: batas dihitung dari pengesahan penjelasan.' : null,
    action: open ? (rejection ? 'resubmit' : 'claim') : null,
  };
}

/** Menu Lembur Saya hanya untuk yang diabsen QR dan berjabatan "dapat lembur" (KEH-25, H77). */
export async function overtimeMenuVisible(actor: Actor | null, on: IsoDate): Promise<boolean> {
  return actor ? (await eligibility(actor, on)) === null : false;
}

export async function myOvertimeScreen(actor: Actor | null, tab: OvertimeTab, all: boolean, now: Date = new Date()) {
  if (!actor) return null;
  const today = wibDate(now);
  const problem = await eligibility(actor, today);
  if (problem) return { tracked: false as const, problem };
  const from = all ? marksFrom() : [marksFrom(), addDays(today, -LIST_DAYS)].sort().at(-1)!;
  const rows = await dayRowsOf([actor.personId], from, today);
  const claims = await claimsByDay(rows.map((row) => row.id));
  const counts = { open: 0, waiting: 0, done: 0 };
  for (const row of rows) {
    const bucket = bucketOf(row, now);
    if (bucket) counts[bucket] += 1;
  }
  const picked = rows.filter((row) => bucketOf(row, now) === tab);
  picked.sort(tab === 'open' ? (a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime() : (a, b) => (a.workDate < b.workDate ? 1 : -1));
  return { tracked: true as const, tab, all, counts, cards: picked.map((row) => toCard(row, claims.get(row.id), now)) };
}

/** Angka di menu Lembur Saya dan kartu Beranda. */
export async function openOvertimeCount(actor: Actor | null, now: Date = new Date()): Promise<number> {
  if (!actor) return 0;
  const rows = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from hris.overtime_days
    where employee_id = ${actor.personId} and state = 'OPEN' and choice <> 'NOT_OVERTIME' and deadline_at > ${now.toISOString()}::timestamptz`);
  return Number(rows[0]?.n ?? 0);
}

/** Langkah klaim (KEH-L41). */
export async function claimFormScreen(actor: Actor | null, dayId: number, now: Date = new Date()) {
  if (!actor) return null;
  const row = await dayOf(dayId);
  if (!row || row.employeeId !== actor.personId) return { allowed: false as const, problem: 'Lembur tidak ditemukan.' };
  const problem = await eligibility(actor, row.workDate);
  if (problem) return { allowed: false as const, problem };
  if (row.state !== 'OPEN') return { allowed: false as const, problem: 'Lembur ini sudah diklaim atau tidak ada lagi. Lihat Lembur Saya.' };
  if (!isOpenAt(row.deadlineAt, now)) return { allowed: false as const, problem: `Batas klaim sudah lewat. Lembur ${row.hours} jam tanggal ${shortDate(row.workDate)} hangus. Bicarakan langsung dengan pemilik.` };
  return {
    allowed: true as const,
    day: {
      id: row.id, dateLabel: shortDate(row.workDate), scheduledEnd: dot(row.scheduledEnd), outClock: clock(row.outAt), hours: row.hours,
      deadline: deadlineText(row.deadlineAt), left: leftText(row.deadlineAt, now),
    },
    orderers: await orderersOn(wibDate(now), actor.personId),
  };
}

// ---- Lembur Tim (KEH-L42) ----

export type TeamOvertimeTab = 'open' | 'soon' | 'waiting' | 'expired';

export async function teamOvertimeScreen(actor: Actor, input: { tab: TeamOvertimeTab; branchId: number | null; employeeId: number | null }, now: Date = new Date()) {
  const today = wibDate(now);
  const roster = (await rosterOn(today)).filter((person) => can(actor, 'overtime.team.view', targetOf(person)));
  const people = new Map(roster.map((person) => [person.employeeId, person]));
  const org = await getOrgLookup();
  const branchName = (id: number) => org.branches.find((b) => b.id === id)?.name ?? '-';
  const branches = org.branches.filter((b) => b.active && roster.some((p) => p.branchId === b.id)).map(({ id, name }) => ({ id, name }));
  const visible = roster.filter((p) => (input.branchId == null || p.branchId === input.branchId) && (input.employeeId == null || p.employeeId === input.employeeId))
    .map((p) => p.employeeId);
  const from = [marksFrom(), addDays(today, -LIST_DAYS)].sort().at(-1)!;
  const rows = await dayRowsOf(visible, from, today);
  const claims = await claimsByDay(rows.map((row) => row.id));
  const base = {
    tab: input.tab, branchId: input.branchId, employeeId: input.employeeId, branches,
    people: roster.map((p) => ({ id: p.employeeId, name: p.name })),
  };
  const line = (row: DayRow) => {
    const person = people.get(row.employeeId)!;
    const active = claims.get(row.id)?.find((c) => c.active) ?? null;
    return {
      id: row.id, name: person.name, branch: branchName(row.branchId), dateLabel: shortDate(row.workDate), hours: row.hours,
      claimedHours: active?.claimedHours ?? null, approvedHours: active?.approvedHours ?? null,
      left: isOpenAt(row.deadlineAt, now) ? leftText(row.deadlineAt, now) : 'Lewat batas', urgency: urgencyOf(row.deadlineAt, now),
      requestId: active?.requestId ?? null, notOvertime: row.choice === 'NOT_OVERTIME',
      canOpen: can(actor, 'overtime.decide', targetOf(person)),
      waitingDays: 0,
    };
  };
  if (input.tab === 'waiting') {
    const waiting = rows.filter((row) => row.state === 'CLAIMED').map(line);
    const ids = waiting.map((w) => w.requestId).filter((id): id is number => id != null);
    const created = ids.length ? await db.execute<{ id: number; created_at: Date }>(sql`select id, created_at from hris.requests where id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`) : [];
    for (const row of created) {
      const entry = waiting.find((w) => w.requestId === Number(row.id));
      if (entry) entry.waitingDays = Math.floor((now.getTime() - new Date(row.created_at).getTime()) / 86_400_000);
    }
    return { ...base, rows: waiting.sort((a, b) => b.waitingDays - a.waitingDays) };
  }
  if (input.tab === 'expired') {
    return { ...base, rows: rows.filter((row) => row.state === 'EXPIRED' && row.choice !== 'NOT_OVERTIME').reverse().map(line) };
  }
  const open = rows.filter((row) => row.state === 'OPEN' && isOpenAt(row.deadlineAt, now))
    .filter((row) => input.tab !== 'soon' || (daysLeft(row.deadlineAt, now) ?? 99) <= 1)
    .sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime());
  return { ...base, rows: open.map(line) };
}

// ---- Beranda ----

export async function overtimeAttention(actor: Actor | null, now: Date = new Date()): Promise<{ key: string; title: string; detail?: string; href: string }[]> {
  if (!actor) return [];
  const rows = await db.execute<{ n: number; first: Date | null }>(sql`
    select count(*)::int as n, min(deadline_at) as first from hris.overtime_days
    where employee_id = ${actor.personId} and state = 'OPEN' and choice <> 'NOT_OVERTIME' and deadline_at > ${now.toISOString()}::timestamptz`);
  const n = Number(rows[0]?.n ?? 0);
  if (!n) return [];
  const first = rows[0].first ? new Date(rows[0].first) : null;
  return [{ key: 'overtime-mine', title: `${n} lembur belum diklaim`, detail: first ? `Terdekat batas ${deadlineText(first)}` : undefined, href: '/lembur' }];
}

// ---- Mesin harian `overtime-daily` 04.30 WIB (spec L3h §6) ----

async function ownerAccounts(): Promise<number[]> {
  return accountsOf(await listEmployeesWithAnyAction([]));
}

async function noticeOnce(executor: Executor, ref: string): Promise<boolean> {
  const rows = await executor.execute<{ ref: string }>(sql`insert into hris.absence_notices (ref) values (${ref}) on conflict do nothing returning ref`);
  return rows.length > 0;
}

export async function runOvertimeDaily(now: Date = new Date()) {
  try {
    return await overtimeDaily(now);
  } catch (error) {
    await db.transaction(async (tx) => {
      await notify(tx, await ownerAccounts(), {
        kind: 'attendance.overtime', title: 'Mesin penghangus lembur gagal berjalan',
        body: 'Hitung ulang dan penghangus klaim lembur pagi ini gagal. Hari kemarin akan dikejar pada jalan berikutnya.', link: '/kehadiran/lembur',
      }, null);
    }).catch(() => undefined);
    throw error;
  }
}

async function overtimeDaily(now: Date) {
  const today = wibDate(now);
  const yesterday = addDays(today, -1);
  const result = { recomputed: 0, born: 0, expired: 0, reminders: 0 };

  // 1. Hitung ulang hari kemarin dan yang terlewat (koreksi malam hari, Laporan Pulang yang telat dihitung).
  const start = [marksFrom(), addDays(today, -CATCH_UP_DAYS)].sort().at(-1)!;
  for (let date = start; date <= yesterday; date = addDays(date, 1)) {
    const people = await db.execute<{ employee_id: number }>(sql`
      select distinct employee_id from hris.attendance_days where work_date = ${date}::date
      union select employee_id from hris.attendance_corrections where work_date = ${date}::date
      union select employee_id from hris.overtime_days where work_date = ${date}::date`);
    for (const person of people) {
      await db.transaction(async (tx) => {
        await lockPerson(tx, Number(person.employee_id));
        result.born += (await syncOvertimeDays(tx, Number(person.employee_id), [date], now)).length;
      });
      result.recomputed += 1;
    }
  }

  // 2. Hangus: batas lewat tanpa klaim berlaku (KEH-74, 161).
  const expired = await db.update(overtimeDays).set({ state: 'EXPIRED', updatedAt: now })
    .where(and(eq(overtimeDays.state, 'OPEN'), lte(overtimeDays.deadlineAt, now))).returning();
  result.expired = expired.length;
  await db.transaction(async (tx) => {
    for (const row of expired) {
      if (row.choice === 'NOT_OVERTIME' || row.hours < 1) continue;
      if (!(await noticeOnce(tx, `ot:${row.id}:EXPIRED`))) continue;
      await notify(tx, await accountsOf([row.employeeId]), {
        kind: 'attendance.overtime', title: `Lembur ${row.hours} jam ${shortDate(row.workDate)} hangus`,
        body: 'Batas klaim sudah lewat. Bicarakan langsung dengan pemilik.', link: '/lembur?tab=done',
      }, null);
    }
  });

  // 3. Pengingat sekali per tanda: sisa 1 hari dan hari terakhir (spec L3h §9 butir 7).
  const open = await db.select().from(overtimeDays).where(and(eq(overtimeDays.state, 'OPEN'), ne(overtimeDays.choice, 'NOT_OVERTIME')));
  await db.transaction(async (tx) => {
    for (const row of open) {
      const left = daysLeft(row.deadlineAt, now);
      if (left !== 0 && left !== 1) continue;
      if (!(await noticeOnce(tx, `ot:${row.id}:${left === 0 ? 'LAST_DAY' : 'ONE_DAY_LEFT'}`))) continue;
      await notify(tx, await accountsOf([row.employeeId]), {
        kind: 'attendance.overtime',
        title: left === 0 ? `Hari terakhir klaim lembur ${shortDate(row.workDate)}` : `Tinggal 1 hari: klaim lembur ${shortDate(row.workDate)}`,
        body: `Lembur ${row.hours} jam. Lewat batas, lemburnya hangus.`, link: '/lembur',
      }, null);
      result.reminders += 1;
    }
  });
  return result;
}
