import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import {
  attendanceDays, attendanceRecords, endOfDayReports, handoverReads, handoverRecipients, problemReportEvents, problemReports,
  relocationPrompts, reportNotes,
} from '@petshop/hris-db/schema/attendance';
import { db } from '@/lib/db';
import { can, getOrgLookup, listEmployeesWithAnyAction, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { moveBranchFromRequest } from '@/modules/employees';
import { saveUpload } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import { wibClock, wibDate, wibInstant } from '../rules/attendance';
import {
  OFFICE_DEPARTMENT, PROBLEM_STATUS_LABELS, cleanText, handoverProblem, namesInText, noteProblem, problemBodyProblem, relocationBranch,
  reportState, responseProblem, teamRecipients, type ProblemStatus, type ReportState,
} from '../rules/end-of-day';
import { addDays, type IsoDate } from '../rules/schedule';
import { rosterOn, type Executor, type RosterPerson } from './read';

const fail = (status: 400 | 403 | 404 | 409, error: string) => ({ ok: false as const, status, error });
type Fail = ReturnType<typeof fail>;
const FORBIDDEN = 'Anda tidak berhak melakukan tindakan ini.';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

type Report = typeof endOfDayReports.$inferSelect;
type Problem = typeof problemReports.$inferSelect;

const ids = (values: number[]) => sql.join([...new Set(values)].map((id) => sql`${id}`), sql`, `);

async function peopleNames(employeeIds: number[], executor: Executor = db): Promise<Map<number, string>> {
  if (!employeeIds.length) return new Map();
  const rows = await executor.execute<{ id: number; name: string }>(sql`select id, name from hris.employees where id in (${ids(employeeIds)})`);
  return new Map(rows.map((row) => [Number(row.id), row.name]));
}

async function branchLabel() {
  const org = await getOrgLookup();
  return {
    branches: org.branches.filter((branch) => branch.active).map(({ id, name }) => ({ id, name })),
    label: (id: number | null) => (id == null ? '-' : org.branches.find((branch) => branch.id === id)?.name ?? '-'),
  };
}

function formatAt(at: Date) {
  return `${wibDate(at).split('-').reverse().join('/')} ${wibClock(at)}`;
}

/** Yang absen QR hari itu (pintu yang sama dengan Absen, KEH-10). */
async function qrPersonOn(actor: Actor, on: IsoDate, executor: Executor = db): Promise<RosterPerson | null> {
  if (!can(actor, 'attendance.self.check', { personId: actor.personId })) return null;
  const me = (await rosterOn(on, executor)).find((person) => person.employeeId === actor.personId);
  return me?.mode === 'QR' ? me : null;
}

/** Pemilik (bukan GM): yang boleh membaca laporan "menyangkut GM" (KEH-128). */
async function isOwnerPosition(positionId: number | null): Promise<boolean> {
  if (positionId == null) return false;
  const rows = await db.execute<{ owner: boolean }>(sql`
    select (full_access and lower(name) = 'pemilik') as owner from hris.positions where id = ${positionId}`);
  return Boolean(rows[0]?.owner);
}

/** Akun Pemilik/GM aktif; `ownerOnly` = hanya Pemilik. */
async function ownerAccounts(ownerOnly: boolean): Promise<number[]> {
  const employeeIds = await listEmployeesWithAnyAction([]);
  let wanted = employeeIds;
  if (ownerOnly && employeeIds.length) {
    const rows = await db.execute<{ employee_id: number }>(sql`
      select cp.employee_id from hris.current_placements cp join hris.positions p on p.id = cp.position_id
      where cp.active and p.full_access and lower(p.name) = 'pemilik' and cp.employee_id in (${ids(employeeIds)})`);
    wanted = rows.map((row) => Number(row.employee_id));
  }
  return [...(await activeHrisAccounts(wanted)).values()];
}

async function lockPerson(tx: Tx, employeeId: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('attendance.person'), ${employeeId})`);
}

function isFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File && value.size > 0;
}

async function uploadOptional(actor: Actor, file: File | null): Promise<ServiceResult<{ id: string | null }>> {
  if (!isFile(file)) return { ok: true, data: { id: null } };
  const saved = await saveUpload(actor, file);
  return saved.ok ? { ok: true, data: { id: saved.data.id } } : saved;
}

// ---- Laporan Pulang (KEH-L20) ----

type DayWithOut = { day: typeof attendanceDays.$inferSelect; outId: number; outAt: Date };

/** Hari kerja orang itu yang sudah berfoto Pulang, terbaru dulu (dua hari terakhir cukup untuk batas 04.00). */
async function daysWithOut(employeeId: number, executor: Executor = db): Promise<DayWithOut[]> {
  const rows = await executor.select({ day: attendanceDays, outId: attendanceRecords.id, outAt: attendanceRecords.recordedAt })
    .from(attendanceDays)
    .innerJoin(attendanceRecords, and(eq(attendanceRecords.dayId, attendanceDays.id), eq(attendanceRecords.kind, 'OUT')))
    .where(eq(attendanceDays.employeeId, employeeId)).orderBy(desc(attendanceDays.workDate)).limit(2);
  return rows;
}

async function reportsOfDays(dayIds: number[], executor: Executor = db): Promise<Map<number, Report>> {
  if (!dayIds.length) return new Map();
  const rows = await executor.select().from(endOfDayReports).where(inArray(endOfDayReports.dayId, dayIds));
  return new Map(rows.map((row) => [row.dayId, row]));
}

/** Keadaan laporan per hari (dipakai Catatan Hari Kerja dan rekap): hanya hari yang berfoto Pulang. */
export async function reportStates(days: { dayId: number; workDate: IsoDate; hasOut: boolean }[], now: Date = new Date(), executor: Executor = db) {
  const reports = await reportsOfDays(days.filter((day) => day.hasOut).map((day) => day.dayId), executor);
  const result = new Map<number, ReportState>();
  for (const day of days) {
    if (!day.hasOut) continue;
    const cutoff = await settingOn<number>('attendance.out_cutoff_hour', day.workDate, {}, executor);
    result.set(day.dayId, reportState({ hasOut: true, reported: reports.has(day.dayId), workDate: day.workDate, now, cutoffHour: cutoff }));
  }
  return result;
}

/** Penerima "Tim saya" pada tanggal itu (KEH-90). */
async function teamOf(person: { employeeId: number; departmentId: number }, branchId: number, workDate: IsoDate, executor: Executor = db) {
  const roster = await rosterOn(workDate, executor);
  const department = await executor.execute<{ name: string }>(sql`select name from hris.departments where id = ${person.departmentId}`);
  const office = (department[0]?.name ?? '').trim().toLowerCase() === OFFICE_DEPARTMENT;
  const present = await executor.select({ employeeId: attendanceDays.employeeId }).from(attendanceDays)
    .where(and(eq(attendanceDays.branchId, branchId), eq(attendanceDays.workDate, workDate)));
  return teamRecipients({
    selfId: person.employeeId, office, departmentId: person.departmentId, branchId,
    people: roster.map(({ employeeId, branchId: home, departmentId }) => ({ employeeId, branchId: home, departmentId })),
    presentIds: present.map((row) => row.employeeId),
  });
}

export type PendingReport = {
  dayId: number; workDate: IsoDate; branchName: string; until: string; minLength: number;
  team: string[]; people: { id: number; name: string }[];
};

/** Laporan Pulang yang menunggu: sudah foto Pulang, belum berlaporan, belum lewat batas (KEH-91). */
async function pendingReport(actor: Actor, now: Date): Promise<PendingReport | null> {
  const days = await daysWithOut(actor.personId);
  const reports = await reportsOfDays(days.map((row) => row.day.id));
  for (const row of days) {
    if (reports.has(row.day.id)) continue;
    const cutoff = await settingOn<number>('attendance.out_cutoff_hour', row.day.workDate);
    if (reportState({ hasOut: true, reported: false, workDate: row.day.workDate, now, cutoffHour: cutoff }) !== 'PENDING') continue;
    const person = await qrPersonOn(actor, row.day.workDate);
    if (!person) return null;
    const { label } = await branchLabel();
    const team = await teamOf(person, row.day.branchId, row.day.workDate);
    const roster = await rosterOn(row.day.workDate);
    const names = new Map(roster.map((item) => [item.employeeId, item.name]));
    return {
      dayId: row.day.id, workDate: row.day.workDate, branchName: label(row.day.branchId),
      until: wibClock(wibInstant(addDays(row.day.workDate, 1), `${String(cutoff).padStart(2, '0')}:00`)),
      minLength: await settingOn<number>('attendance.handover_min_length', row.day.workDate),
      team: team.map((id) => names.get(id) ?? '-'),
      people: roster.filter((item) => item.employeeId !== actor.personId).map((item) => ({ id: item.employeeId, name: item.name })),
    };
  }
  return null;
}

export type EndOfDayInput = {
  dayId: number;
  handover: string;
  recipientMode: 'TEAM' | 'PEOPLE';
  recipientIds: number[];
  handoverPhoto: File | null;
  problem: { body: string; photo: File | null; concernsGm: boolean } | null;
};

const SENT = 'Laporan Pulang terkirim. Sampai besok.';

/**
 * Kirim Laporan Pulang (KEH-89, 90, 125, 127). Tekan dua kali tercatat sekali (unik per hari kerja). Penerima dibekukan
 * saat terkirim. Langkah 2 (masalah) ikut tersimpan di transaksi yang sama.
 */
export async function submitEndOfDay(actor: Actor, input: EndOfDayInput, now: Date = new Date())
  : Promise<ServiceResult<{ message: string; reportId: number; relocation: RelocationPrompt | null }>> {
  const [day] = await db.select().from(attendanceDays).where(and(eq(attendanceDays.id, input.dayId), eq(attendanceDays.employeeId, actor.personId)));
  if (!day) return fail(404, 'Hari kerja tidak ditemukan.');
  const person = await qrPersonOn(actor, day.workDate);
  if (!person) return fail(403, FORBIDDEN);
  const [out] = await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.dayId, day.id), eq(attendanceRecords.kind, 'OUT')));
  if (!out) return fail(409, 'Absen Pulang dulu, lalu isi Laporan Pulang.');
  const existing = (await reportsOfDays([day.id])).get(day.id);
  if (existing) return { ok: true, data: { message: SENT, reportId: existing.id, relocation: await relocationPromptFor(actor, now) } };
  const cutoff = await settingOn<number>('attendance.out_cutoff_hour', day.workDate);
  if (reportState({ hasOut: true, reported: false, workDate: day.workDate, now, cutoffHour: cutoff }) !== 'PENDING') {
    return fail(409, `Batas Laporan Pulang sudah lewat (pukul ${String(cutoff).padStart(2, '0')}.00). Hubungi HR.`);
  }
  const problemText = handoverProblem(input.handover, await settingOn<number>('attendance.handover_min_length', day.workDate));
  if (problemText) return fail(400, problemText);
  if (input.problem) {
    const bad = problemBodyProblem(input.problem.body);
    if (bad) return fail(400, bad);
  }

  let recipients: number[];
  if (input.recipientMode === 'TEAM') {
    recipients = await teamOf(person, day.branchId, day.workDate);
  } else {
    const chosen = [...new Set(input.recipientIds)].filter((id) => id !== actor.personId);
    if (!chosen.length) return fail(400, 'Pilih paling sedikit satu penerima, atau pilih Tim saya.');
    if (chosen.length > 50) return fail(400, 'Penerima paling banyak 50 orang.');
    // Yang sudah berhenti dilewati; bila semuanya, laporan tetap terkirim tanpa penerima (KEH-127).
    const active = new Set((await rosterOn(wibDate(now))).map((item) => item.employeeId));
    recipients = chosen.filter((id) => active.has(id));
  }

  const handoverPhoto = await uploadOptional(actor, input.handoverPhoto);
  if (!handoverPhoto.ok) return handoverPhoto;
  const problemPhoto = await uploadOptional(actor, input.problem?.photo ?? null);
  if (!problemPhoto.ok) return problemPhoto;

  const saved = await db.transaction(async (tx) => {
    await lockPerson(tx, actor.personId);
    const [again] = await tx.select().from(endOfDayReports).where(eq(endOfDayReports.dayId, day.id));
    if (again) return { report: again, problemId: null as number | null, fresh: false };
    const [report] = await tx.insert(endOfDayReports).values({
      dayId: day.id, outRecordId: out.id, employeeId: actor.personId, branchId: day.branchId, handover: cleanText(input.handover),
      recipientMode: input.recipientMode, photoFileId: handoverPhoto.data.id, submittedAt: now,
    }).returning();
    if (recipients.length) await tx.insert(handoverRecipients).values(recipients.map((employeeId) => ({ reportId: report.id, employeeId })));
    let problemId: number | null = null;
    if (input.problem) {
      const [problem] = await tx.insert(problemReports).values({
        reporterEmployeeId: actor.personId, body: cleanText(input.problem.body), photoFileId: problemPhoto.data.id,
        concernsGm: input.problem.concernsGm, origin: 'END_OF_DAY', endOfDayReportId: report.id, submittedAt: now,
      }).returning();
      await tx.insert(problemReportEvents).values({ reportId: problem.id, status: 'RECEIVED', byAccountId: actor.accountId });
      problemId = problem.id;
    }
    return { report, problemId, fresh: true };
  });
  if (saved.fresh) {
    const accounts = await activeHrisAccounts(recipients);
    await db.transaction(async (tx) => {
      await notify(tx, [...accounts.values()], {
        kind: 'attendance.handover', title: `Serah terima dari ${person.name}`, body: cleanText(input.handover).slice(0, 200),
        link: '/serah-terima', entity: 'end_of_day_report', entityId: saved.report.id,
      }, actor.accountId);
      if (saved.problemId) await notifyProblemReaders(tx, saved.problemId, input.problem!.concernsGm, actor.accountId);
    });
  }
  return { ok: true, data: { message: SENT, reportId: saved.report.id, relocation: await relocationPromptFor(actor, now) } };
}

async function notifyProblemReaders(tx: Tx, problemId: number, concernsGm: boolean, actorAccountId: number) {
  // Nama pelapor tidak ditulis di kabar; dibaca di layar yang dijaga hak (KEH-93).
  await notify(tx, await ownerAccounts(concernsGm), {
    kind: 'attendance.problem', title: 'Laporan masalah baru', body: concernsGm ? 'Menyangkut GM. Hanya Pemilik yang bisa membaca.' : null,
    link: `/kehadiran/laporan-masalah?id=${problemId}`, entity: 'problem_report', entityId: problemId,
  }, actorAccountId);
}

// ---- Layar Absen: laporan menunggu, jendela serah terima, Sudah Pindah Cabang ----

export type HandoverCard = {
  id: number; from: string; branch: string; sentAt: string; text: string; hasPhoto: boolean; notes: { text: string; at: string }[];
  noRecipients: boolean;
};

async function notesOf(kind: 'HANDOVER' | 'PROBLEM', reportIds: number[]) {
  const map = new Map<number, { text: string; at: string }[]>();
  if (!reportIds.length) return map;
  const rows = await db.select().from(reportNotes).where(and(eq(reportNotes.kind, kind), inArray(reportNotes.reportId, reportIds))).orderBy(asc(reportNotes.id));
  for (const row of rows) {
    const list = map.get(row.reportId) ?? [];
    list.push({ text: row.body, at: formatAt(row.createdAt) });
    map.set(row.reportId, list);
  }
  return map;
}

async function toHandoverCards(reports: Report[]): Promise<HandoverCard[]> {
  const names = await peopleNames(reports.map((row) => row.employeeId));
  const { label } = await branchLabel();
  const notes = await notesOf('HANDOVER', reports.map((row) => row.id));
  const counts = reports.length ? await db.select({ reportId: handoverRecipients.reportId, n: sql<number>`count(*)` }).from(handoverRecipients)
    .where(inArray(handoverRecipients.reportId, reports.map((row) => row.id))).groupBy(handoverRecipients.reportId) : [];
  const withRecipients = new Set(counts.filter((row) => Number(row.n) > 0).map((row) => row.reportId));
  return reports.map((row) => ({
    id: row.id, from: names.get(row.employeeId) ?? '-', branch: label(row.branchId), sentAt: formatAt(row.submittedAt), text: row.handover,
    hasPhoto: Boolean(row.photoFileId), notes: notes.get(row.id) ?? [], noRecipients: !withRecipients.has(row.id),
  }));
}

/** Jendela baca sesudah Masuk (KEH-92, 126): belum dibaca, `handover_popup_days` terakhir, paling lama dulu. */
async function unreadHandovers(actor: Actor, now: Date): Promise<HandoverCard[]> {
  const days = await settingOn<number>('attendance.handover_popup_days', wibDate(now));
  const since = new Date(now.getTime() - days * 86_400_000);
  const rows = await db.select({ report: endOfDayReports }).from(handoverRecipients)
    .innerJoin(endOfDayReports, eq(endOfDayReports.id, handoverRecipients.reportId))
    .where(and(
      eq(handoverRecipients.employeeId, actor.personId), gte(endOfDayReports.submittedAt, since),
      sql`not exists (select 1 from hris.handover_reads r where r.report_id = ${endOfDayReports.id} and r.employee_id = ${actor.personId})`,
    )).orderBy(asc(endOfDayReports.submittedAt)).limit(20);
  return toHandoverCards(rows.map((row) => row.report));
}

export type RelocationPrompt = { workDate: IsoDate; branchName: string; homeName: string; workdays: number };

/** Sudah Pindah Cabang? sesudah Laporan Pulang terkirim (KEH-27, KEH-L10). Null bila tidak perlu ditanya. */
export async function relocationPromptFor(actor: Actor, now: Date = new Date(), executor: Executor = db): Promise<RelocationPrompt | null> {
  const candidate = await relocationCandidate(actor.personId, now, executor);
  if (!candidate) return null;
  const { label } = await branchLabel();
  return { workDate: candidate.workDate, branchName: label(candidate.branchId), homeName: label(candidate.homeBranchId), workdays: candidate.workdays };
}

async function relocationCandidate(employeeId: number, now: Date, executor: Executor) {
  const today = wibDate(now);
  const needed = await settingOn<number>('attendance.relocation_prompt_workdays', today, {}, executor);
  const days = await executor.select({ id: attendanceDays.id, workDate: attendanceDays.workDate, branchId: attendanceDays.branchId })
    .from(attendanceDays).where(eq(attendanceDays.employeeId, employeeId)).orderBy(desc(attendanceDays.workDate)).limit(Math.max(1, needed));
  const latest = days[0];
  if (!latest || latest.workDate < addDays(today, -1)) return null;
  // Hanya sesudah laporan hari terakhir terkirim.
  const [report] = await executor.select({ id: endOfDayReports.id }).from(endOfDayReports).where(eq(endOfDayReports.dayId, latest.id));
  if (!report) return null;
  const me = (await rosterOn(today, executor)).find((person) => person.employeeId === employeeId);
  if (!me) return null;
  const branchId = relocationBranch(days, me.branchId, needed);
  if (!branchId) return null;
  const [answered] = await executor.select({ id: relocationPrompts.id }).from(relocationPrompts)
    .where(and(eq(relocationPrompts.employeeId, employeeId), eq(relocationPrompts.workDate, latest.workDate)));
  if (answered) return null;
  const open = await executor.execute<{ id: number }>(sql`
    select r.id from hris.requests r where r.type_key = 'relocation' and r.subject_employee_id = ${employeeId}
      and r.status in ('PENDING', 'REVIEWED') limit 1`);
  if (open.length) return null;
  return { workDate: latest.workDate, branchId, homeBranchId: me.branchId, workdays: needed };
}

/** Jawaban Belum: pertanyaan muncul lagi di pulang berikutnya (KEH-27). */
export async function answerRelocationNotYet(actor: Actor, workDate: string, now: Date = new Date()): Promise<ServiceResult<{ message: string }>> {
  const candidate = await relocationCandidate(actor.personId, now, db);
  if (!candidate || candidate.workDate !== workDate) return { ok: true, data: { message: 'Tercatat.' } };
  await db.insert(relocationPrompts).values({
    employeeId: actor.personId, workDate, fromBranchId: candidate.homeBranchId, branchId: candidate.branchId, answer: 'NOT_YET',
  }).onConflictDoNothing();
  return { ok: true, data: { message: 'Baik. Pertanyaan ini muncul lagi di pulang berikutnya.' } };
}

/** Isi layar Absen milik L3d. */
export async function endOfDayScreen(actor: Actor, now: Date = new Date()) {
  const pending = await pendingReport(actor, now);
  const [handovers, relocation] = await Promise.all([
    pending ? Promise.resolve([] as HandoverCard[]) : unreadHandovers(actor, now),
    pending ? Promise.resolve(null) : relocationPromptFor(actor, now),
  ]);
  return { pending, handovers, relocation };
}

export async function markHandoverRead(actor: Actor, reportId: number): Promise<ServiceResult<Record<string, never>>> {
  const [row] = await db.select().from(handoverRecipients)
    .where(and(eq(handoverRecipients.reportId, reportId), eq(handoverRecipients.employeeId, actor.personId)));
  if (!row) return fail(404, 'Serah terima tidak ditemukan.');
  await db.insert(handoverReads).values({ reportId, employeeId: actor.personId }).onConflictDoNothing();
  return { ok: true, data: {} };
}

// ---- Serah Terima Saya (KEH-L21) ----

export async function myHandoversScreen(actor: Actor, tab: 'received' | 'sent') {
  if (tab === 'sent') {
    const reports = await db.select().from(endOfDayReports).where(eq(endOfDayReports.employeeId, actor.personId))
      .orderBy(desc(endOfDayReports.submittedAt)).limit(60);
    const cards = await toHandoverCards(reports);
    const reportIds = reports.map((row) => row.id);
    const [recipients, reads] = reportIds.length ? await Promise.all([
      db.select().from(handoverRecipients).where(inArray(handoverRecipients.reportId, reportIds)),
      db.select().from(handoverReads).where(inArray(handoverReads.reportId, reportIds)),
    ]) : [[], []];
    const names = await peopleNames(recipients.map((row) => row.employeeId));
    return {
      tab,
      cards: cards.map((card) => ({
        ...card, canAddNote: true, read: true,
        readers: recipients.filter((row) => row.reportId === card.id).map((row) => {
          const read = reads.find((item) => item.reportId === card.id && item.employeeId === row.employeeId);
          return { name: names.get(row.employeeId) ?? '-', readAt: read ? formatAt(read.readAt) : null };
        }),
      })),
    };
  }
  const rows = await db.select({ report: endOfDayReports }).from(handoverRecipients)
    .innerJoin(endOfDayReports, eq(endOfDayReports.id, handoverRecipients.reportId))
    .where(eq(handoverRecipients.employeeId, actor.personId)).orderBy(desc(endOfDayReports.submittedAt)).limit(60);
  const reports = rows.map((row) => row.report);
  const cards = await toHandoverCards(reports);
  const reads = reports.length ? await db.select().from(handoverReads)
    .where(and(eq(handoverReads.employeeId, actor.personId), inArray(handoverReads.reportId, reports.map((row) => row.id)))) : [];
  const readIds = new Set(reads.map((row) => row.reportId));
  return { tab, cards: cards.map((card) => ({ ...card, canAddNote: false, read: readIds.has(card.id), readers: [] as { name: string; readAt: string | null }[] })) };
}

// ---- Serah Terima Tim (KEH-L22) ----

export type TeamHandoverFilter = { branchId: number | null; from: string | null; to: string | null; unread: boolean; photo: boolean; q: string };

export async function teamHandoversScreen(actor: Actor, filter: TeamHandoverFilter, now: Date = new Date()) {
  const today = wibDate(now);
  const to = filter.to && ISO.test(filter.to) && filter.to <= today ? filter.to : today;
  const from = filter.from && ISO.test(filter.from) && filter.from <= to ? filter.from : addDays(to, -6);
  const rows = await db.select().from(endOfDayReports).where(and(
    gte(endOfDayReports.submittedAt, wibInstant(from, '00:00')), lte(endOfDayReports.submittedAt, wibInstant(addDays(to, 1), '00:00')),
    filter.branchId ? eq(endOfDayReports.branchId, filter.branchId) : undefined,
    filter.photo ? sql`${endOfDayReports.photoFileId} is not null` : undefined,
  )).orderBy(desc(endOfDayReports.submittedAt)).limit(500);
  const departments = await db.execute<{ employee_id: number; department_id: number }>(rows.length
    ? sql`select e.id as employee_id, p.department_id from hris.employees e
          left join hris.current_placements cp on cp.employee_id = e.id left join hris.positions p on p.id = cp.position_id
          where e.id in (${ids(rows.map((row) => row.employeeId))})`
    : sql`select null::int as employee_id, null::int as department_id where false`);
  const departmentOf = new Map(departments.map((row) => [Number(row.employee_id), row.department_id == null ? null : Number(row.department_id)]));
  const allowed = rows.filter((row) => can(actor, 'attendance.handover.view', { branchId: row.branchId, departmentId: departmentOf.get(row.employeeId) ?? null }));
  const reportIds = allowed.map((row) => row.id);
  const [recipients, reads] = reportIds.length ? await Promise.all([
    db.select().from(handoverRecipients).where(inArray(handoverRecipients.reportId, reportIds)),
    db.select().from(handoverReads).where(inArray(handoverReads.reportId, reportIds)),
  ]) : [[], []];
  const names = await peopleNames([...allowed.map((row) => row.employeeId), ...recipients.map((row) => row.employeeId)]);
  const cards = (await toHandoverCards(allowed)).map((card) => {
    const list = recipients.filter((row) => row.reportId === card.id);
    const readers = list.map((row) => ({
      name: names.get(row.employeeId) ?? '-',
      readAt: (() => { const read = reads.find((item) => item.reportId === card.id && item.employeeId === row.employeeId); return read ? formatAt(read.readAt) : null; })(),
    }));
    return { ...card, readers, unread: readers.filter((reader) => !reader.readAt).length };
  });
  const q = cleanText(filter.q).toLowerCase();
  const filtered = cards.filter((card) => (!filter.unread || card.unread > 0)
    && (!q || card.text.toLowerCase().includes(q) || card.from.toLowerCase().includes(q)));
  const { branches } = await branchLabel();
  return { from, to, today, branchId: filter.branchId, unread: filter.unread, photo: filter.photo, q: filter.q, branches, cards: filtered };
}

/** Foto serah terima: pengirim, penerima, dan pemegang Serah Terima Tim. Tidak dicatat (spec §9 butir 5). */
export async function openHandoverPhoto(actor: Actor, reportId: number): Promise<string | null> {
  const [row] = await db.select().from(endOfDayReports).where(eq(endOfDayReports.id, reportId));
  if (!row?.photoFileId) return null;
  if (row.employeeId === actor.personId) return row.photoFileId;
  const [recipient] = await db.select().from(handoverRecipients)
    .where(and(eq(handoverRecipients.reportId, reportId), eq(handoverRecipients.employeeId, actor.personId)));
  if (recipient) return row.photoFileId;
  const department = await db.execute<{ department_id: number | null }>(sql`
    select p.department_id from hris.current_placements cp join hris.positions p on p.id = cp.position_id where cp.employee_id = ${row.employeeId}`);
  const departmentId = department[0]?.department_id == null ? null : Number(department[0].department_id);
  return can(actor, 'attendance.handover.view', { branchId: row.branchId, departmentId }) ? row.photoFileId : null;
}

// ---- Tambah keterangan (KEH-95) ----

export async function addReportNote(actor: Actor, input: { kind: 'HANDOVER' | 'PROBLEM'; reportId: number; body: string })
  : Promise<ServiceResult<{ message: string }>> {
  const bad = noteProblem(input.body);
  if (bad) return fail(400, bad);
  const owner = input.kind === 'HANDOVER'
    ? (await db.select({ by: endOfDayReports.employeeId }).from(endOfDayReports).where(eq(endOfDayReports.id, input.reportId)))[0]?.by
    : (await db.select({ by: problemReports.reporterEmployeeId }).from(problemReports).where(eq(problemReports.id, input.reportId)))[0]?.by;
  if (owner == null) return fail(404, 'Laporan tidak ditemukan.');
  if (owner !== actor.personId) return fail(403, 'Hanya pengirimnya yang bisa menambah keterangan.');
  await db.insert(reportNotes).values({ kind: input.kind, reportId: input.reportId, body: cleanText(input.body), byEmployeeId: actor.personId });
  return { ok: true, data: { message: 'Keterangan ditambahkan. Isi lama tetap.' } };
}

// ---- Lapor Masalah (KEH-L23) dan Laporan Masalah (KEH-L24) ----

export async function submitProblem(actor: Actor, input: { body: string; photo: File | null; concernsGm: boolean }, now: Date = new Date())
  : Promise<ServiceResult<{ message: string; id: number }>> {
  if (!(await qrPersonOn(actor, wibDate(now)))) return fail(403, FORBIDDEN);
  const bad = problemBodyProblem(input.body);
  if (bad) return fail(400, bad);
  const photo = await uploadOptional(actor, input.photo);
  if (!photo.ok) return photo;
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(problemReports).values({
      reporterEmployeeId: actor.personId, body: cleanText(input.body), photoFileId: photo.data.id, concernsGm: input.concernsGm, origin: 'MENU', submittedAt: now,
    }).returning();
    await tx.insert(problemReportEvents).values({ reportId: row.id, status: 'RECEIVED', byAccountId: actor.accountId });
    await notifyProblemReaders(tx, row.id, input.concernsGm, actor.accountId);
    return row.id;
  });
  return { ok: true, data: { id, message: 'Laporan masalah terkirim. Hanya Pemilik dan GM yang membaca.' } };
}

async function latestEvents(reportIds: number[]) {
  const map = new Map<number, { status: ProblemStatus; response: string | null; at: Date }>();
  if (!reportIds.length) return map;
  const rows = await db.select().from(problemReportEvents).where(inArray(problemReportEvents.reportId, reportIds)).orderBy(asc(problemReportEvents.id));
  const responses = new Map<number, string>();
  for (const row of rows) {
    if (row.response) responses.set(row.reportId, row.response);
    map.set(row.reportId, { status: row.status as ProblemStatus, response: responses.get(row.reportId) ?? null, at: row.createdAt });
  }
  return map;
}

export async function myProblemsScreen(actor: Actor, now: Date = new Date()) {
  const allowed = Boolean(await qrPersonOn(actor, wibDate(now)));
  const rows = await db.select().from(problemReports).where(eq(problemReports.reporterEmployeeId, actor.personId))
    .orderBy(desc(problemReports.submittedAt)).limit(50);
  const events = await latestEvents(rows.map((row) => row.id));
  const notes = await notesOf('PROBLEM', rows.map((row) => row.id));
  return {
    allowed,
    rows: rows.map((row) => {
      const event = events.get(row.id);
      const status = event?.status ?? 'RECEIVED';
      return {
        id: row.id, body: row.body, sentAt: formatAt(row.submittedAt), concernsGm: row.concernsGm, hasPhoto: Boolean(row.photoFileId),
        status, statusLabel: PROBLEM_STATUS_LABELS[status], response: event?.response ?? null, notes: notes.get(row.id) ?? [],
      };
    }),
  };
}

/** Siapa boleh membaca laporan ini (KEH-93, 128). GM tidak melihat yang menyangkut GM, termasuk lewat buka langsung. */
async function canReadProblem(actor: Actor, row: Pick<Problem, 'concernsGm'>, ownerKnown?: boolean): Promise<boolean> {
  if (!can(actor, 'attendance.problem.read')) return false;
  if (!row.concernsGm) return true;
  return ownerKnown ?? (await isOwnerPosition(actor.positionId));
}

export async function problemListScreen(actor: Actor, input: { status: string | null; id: number | null }) {
  if (!can(actor, 'attendance.problem.read')) return null;
  const owner = await isOwnerPosition(actor.positionId);
  const rows = await db.select().from(problemReports)
    .where(owner ? undefined : eq(problemReports.concernsGm, false))
    .orderBy(desc(problemReports.submittedAt)).limit(300);
  const events = await latestEvents(rows.map((row) => row.id));
  const names = await peopleNames(rows.map((row) => row.reporterEmployeeId));
  const notes = await notesOf('PROBLEM', rows.map((row) => row.id));
  const cards = rows.map((row) => {
    const event = events.get(row.id);
    const status = event?.status ?? 'RECEIVED';
    return {
      id: row.id, reporter: names.get(row.reporterEmployeeId) ?? '-', body: row.body, sentAt: formatAt(row.submittedAt),
      concernsGm: row.concernsGm, origin: row.origin, hasPhoto: Boolean(row.photoFileId), status, statusLabel: PROBLEM_STATUS_LABELS[status],
      response: event?.response ?? null, notes: notes.get(row.id) ?? [],
    };
  });
  const status = input.status && Object.hasOwn(PROBLEM_STATUS_LABELS, input.status) ? input.status as ProblemStatus : null;
  return {
    status, selectedId: input.id && cards.some((card) => card.id === input.id) ? input.id : null,
    counts: Object.fromEntries((Object.keys(PROBLEM_STATUS_LABELS) as ProblemStatus[]).map((key) => [key, cards.filter((card) => card.status === key).length])),
    cards: status ? cards.filter((card) => card.status === status) : cards,
  };
}

/** Banyak laporan yang belum ditangani, untuk menu/Beranda. Laporan menyangkut GM tidak dihitung untuk GM. */
export async function openProblemCount(actor: Actor | null): Promise<number> {
  if (!actor || !can(actor, 'attendance.problem.read')) return 0;
  const owner = await isOwnerPosition(actor.positionId);
  const rows = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from hris.problem_reports p
    where (${owner} or not p.concerns_gm)
      and (select e.status from hris.problem_report_events e where e.report_id = p.id order by e.id desc limit 1) = 'RECEIVED'`);
  return Number(rows[0]?.n ?? 0);
}

export async function updateProblem(actor: Actor, input: { id: number; status: ProblemStatus; response: string; confirmNames: boolean })
  : Promise<ServiceResult<{ message: string; warning?: string }>> {
  const [row] = await db.select().from(problemReports).where(eq(problemReports.id, input.id));
  if (!row || !(await canReadProblem(actor, row))) return fail(404, 'Laporan tidak ditemukan.');
  if (!Object.hasOwn(PROBLEM_STATUS_LABELS, input.status)) return fail(400, 'Status tidak valid.');
  const response = cleanText(input.response);
  const bad = responseProblem(response);
  if (bad) return fail(400, bad);
  if (response && !input.confirmNames) {
    const names = namesInText(response, (await rosterOn(wibDate(new Date()))).map((person) => person.name));
    if (names.length) {
      return { ok: true, data: { message: '', warning: `Tanggapan memuat nama ${names.join(', ')}. Tanggapan tampil ke pelapor. Tetap simpan?` } };
    }
  }
  const current = (await latestEvents([row.id])).get(row.id);
  if (current && current.status === input.status && !response) return fail(400, 'Tidak ada yang berubah.');
  const accounts = await activeHrisAccounts([row.reporterEmployeeId]);
  await db.transaction(async (tx) => {
    await tx.insert(problemReportEvents).values({ reportId: row.id, status: input.status, response: response || null, byAccountId: actor.accountId });
    await notify(tx, [...accounts.values()], {
      kind: 'attendance.problem_update', title: `Laporan masalah Anda: ${PROBLEM_STATUS_LABELS[input.status]}`, body: response || null,
      link: '/lapor-masalah', entity: 'problem_report', entityId: row.id,
    }, actor.accountId);
  });
  return { ok: true, data: { message: 'Tersimpan. Pelapor diberi tahu.' } };
}

/** Foto laporan masalah hanya untuk pembacanya (spec §9 butir 5). */
export async function openProblemPhoto(actor: Actor, id: number): Promise<string | null> {
  const [row] = await db.select().from(problemReports).where(eq(problemReports.id, id));
  if (!row?.photoFileId || !(await canReadProblem(actor, row))) return null;
  return row.photoFileId;
}

// ---- Usulan pindah cabang: isi khas pengajuan (spec L3d §3, KAR-56) ----

async function promptOfRequest(executor: Executor, requestId: number) {
  const [row] = await executor.select().from(relocationPrompts).where(eq(relocationPrompts.requestId, requestId));
  return row ?? null;
}

async function deciderFullAccess(tx: Tx, accountId: number): Promise<boolean> {
  const rows = await tx.execute<{ full: boolean }>(sql`
    select p.full_access as full from auth.account_links l
    join hris.current_placements cp on cp.employee_id = l.local_user_id and cp.active
    join hris.positions p on p.id = cp.position_id
    where l.app_code = 'hris' and l.account_id = ${accountId} limit 1`);
  return Boolean(rows[0]?.full);
}

/** Bentuknya mengikuti `RequestHandler`; dirangkai di `lib/request-handlers.ts`. */
export const relocationHandler = {
  async prepare(tx: Tx, actor: Actor, input: Record<string, unknown>) {
    const workDate = typeof input.workDate === 'string' ? input.workDate : '';
    const candidate = await relocationCandidate(actor.personId, new Date(), tx);
    if (!candidate || candidate.workDate !== workDate) return fail(409, 'Pertanyaan pindah cabang ini sudah tidak berlaku. Muat ulang.');
    const { label } = await branchLabel();
    return {
      ok: true as const,
      data: {
        subjectEmployeeId: actor.personId,
        summary: `Pindah ke ${label(candidate.branchId)} (dari ${label(candidate.homeBranchId)}), ${candidate.workdays} hari kerja berturut-turut di sana`,
        dedupeKey: `relocation:${actor.personId}`,
        requiredAttachment: null,
        save: async (inner: Tx, requestId: number) => {
          await inner.insert(relocationPrompts).values({
            employeeId: actor.personId, workDate, fromBranchId: candidate.homeBranchId, branchId: candidate.branchId, answer: 'YES', requestId,
          });
        },
      },
    };
  },

  /** Disetujui: cabang pindah mulai tanggal disetujui, jabatan tetap (spec §9 butir 7). */
  async apply(tx: Tx, actorAccountId: number, requestId: number): Promise<{ ok: true; effect: string } | Fail> {
    const prompt = await promptOfRequest(tx, requestId);
    if (!prompt) return fail(404, 'Isi pengajuan tidak ditemukan.');
    const today = wibDate(new Date());
    const moved = await moveBranchFromRequest(tx, {
      actorAccountId, deciderFullAccess: await deciderFullAccess(tx, actorAccountId), employeeId: prompt.employeeId,
      branchId: prompt.branchId, effectiveFrom: today, reason: `Pengajuan PJ-${requestId}: sudah pindah cabang`,
    });
    if (!moved.ok) return moved;
    const { label } = await branchLabel();
    return { ok: true, effect: `Cabang penempatan pindah ke ${label(prompt.branchId)} mulai ${today.split('-').reverse().join('/')}.` };
  },

  async effectPreview(requestId: number) {
    const prompt = await promptOfRequest(db, requestId);
    if (!prompt) return '';
    const { label } = await branchLabel();
    return `Cabang penempatan langsung pindah ke ${label(prompt.branchId)} mulai hari ini. Jabatan tetap; hari lampau tidak berubah.`;
  },

  async describe(requestId: number) {
    const prompt = await promptOfRequest(db, requestId);
    if (!prompt) return [];
    const { label } = await branchLabel();
    return [
      { label: 'Cabang penempatan', before: label(prompt.fromBranchId), after: label(prompt.branchId) },
      { label: 'Ditanyakan sesudah pulang', before: null, after: prompt.workDate.split('-').reverse().join('/') },
    ];
  },

  async resubmitValues() {
    return null;
  },
};
