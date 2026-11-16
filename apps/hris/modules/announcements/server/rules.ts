import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { announcementDrafts, announcementReads, announcements, announcementTargets } from '@petshop/hris-db/schema/announcements';
import { db } from '@/lib/db';
import { can, recordAudit, type Actor, type Tx } from '@/modules/access';
import { todayWib } from '@/modules/employees';
import { cancelSetting, checkReason, settingsOn } from '@/modules/settings';
import { cancelRate } from '@/modules/logistics';
import { emergencyStatus, type EmergencyTarget, type IsoDate } from '../rules/emergency';
import {
  approvalSchedule, earliestEffective, isCurrent, needsApproval, normalizeTarget, ruleStatus, validateRule, withdrawBlock,
  type DraftStatus, type RuleChangeKind, type RuleGaps, type RuleStatus, type ValidRule,
} from '../rules/rule';
import { countRecipients, iso, markEmergencyRead, matchesAnnouncement, readersOf, recipientCount, targetTexts, type ReaderRow } from './emergency';

type Result<T> = { ok: true; value: T } | { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: 400 | 403 | 404 | 409, error: string) => ({ ok: false as const, status, error });

/** Jarak terbit → berlaku dari pengaturan hari ini (spec F3-3 §3.8). */
export async function ruleGaps(): Promise<RuleGaps> {
  const values = await settingsOn(['announcements.rule_gap_unfavorable_days', 'announcements.rule_gap_favorable_days'], todayWib());
  return {
    unfavorable: Number(values['announcements.rule_gap_unfavorable_days']) || 7,
    favorable: Number(values['announcements.rule_gap_favorable_days']) || 1,
  };
}

export function canWriteRules(actor: Actor | null): actor is Actor {
  return !!actor && (can(actor, 'announcement.rule.draft') || can(actor, 'announcement.rule.publish'));
}

function canPublish(actor: Actor | null): actor is Actor {
  return !!actor && can(actor, 'announcement.rule.publish');
}

export function canOpenOffice(actor: Actor | null): actor is Actor {
  return !!actor && (can(actor, 'announcement.view') || can(actor, 'announcement.emergency.send') || canWriteRules(actor));
}

// ---------------------------------------------------------------------------------------------------------------
// Status terhitung (spec F3-3 §3.1). `a` = alias pengumuman.

/** Sudah ada ralat yang terbit dan belum ditarik. */
const correctedSql = sql`exists (select 1 from hris.announcements c where c.corrects_announcement_id = a.id and c.ended_at is null and c.shows_from <= now())`;
const correctedBySql = sql`(select max(c.id) from hris.announcements c where c.corrects_announcement_id = a.id and c.ended_at is null and c.shows_from <= now())`;
/** Tanggal berlaku aturan pengganti yang sudah terbit (aturan lama berlaku sampai sehari sebelumnya). */
const supersededFromSql = sql`(select min(s.effective_on) from hris.announcements s where s.supersedes_announcement_id = a.id and s.ended_at is null and s.shows_from <= now())`;

type RawRule = {
  id: number; title: string; before_text: string; message: string; ask_whom: string; effective_on: string;
  change_kind: RuleChangeKind; affects_money: boolean; target_all: boolean; shows_from: string | Date; ended_at: string | Date | null;
  end_reason: string | null; created_at: string | Date; author_name: string | null; corrected_by: number | null;
  superseded_from: string | null; corrects_announcement_id: number | null; supersedes_announcement_id: number | null;
  read_count: number; recipient_count: number; my_read_at: string | Date | null;
};

export type RuleRow = {
  id: number; title: string; beforeText: string; afterText: string; askWhom: string; effectiveOn: IsoDate;
  changeKind: RuleChangeKind; affectsMoney: boolean; targetText: string; publishesAt: string; authorName: string | null;
  status: RuleStatus; endedAt: string | null; endReason: string | null; correctedById: number | null;
  /** Aturan pengganti mulai berlaku tanggal ini (yang ini berlaku s.d. sehari sebelumnya). */
  supersededFrom: IsoDate | null; correctsId: number | null; supersedesId: number | null;
  readCount: number; recipientCount: number; myReadAt: string | null;
};

const ruleSelect = (personId: number) => sql`
  select a.id, a.title, a.before_text, a.message, a.ask_whom, a.effective_on::text as effective_on, a.change_kind, a.affects_money,
    a.target_all, a.shows_from, a.ended_at, a.end_reason, a.created_at, e.name as author_name,
    ${correctedBySql} as corrected_by, ${supersededFromSql}::text as superseded_from,
    a.corrects_announcement_id, a.supersedes_announcement_id,
    (select count(*)::int from hris.announcement_reads r where r.announcement_id = a.id) as read_count,
    ${recipientCount} as recipient_count,
    (select r.read_at from hris.announcement_reads r where r.announcement_id = a.id and r.employee_id = ${personId}) as my_read_at
  from hris.announcements a left join hris.employees e on e.id = a.created_by_employee_id`;

async function loadRules(where: SQL, personId: number, order: SQL = sql`a.shows_from desc, a.id desc`): Promise<RuleRow[]> {
  const rows = await db.execute<RawRule>(sql`${ruleSelect(personId)} where a.kind = 'RULE' and ${where} order by ${order} limit 300`);
  if (!rows.length) return [];
  const texts = await targetTexts(rows.map((row) => ({ id: Number(row.id), targetAll: row.target_all })));
  const now = new Date();
  const today = todayWib();
  return rows.map((row) => {
    const endedAt = row.ended_at ? new Date(row.ended_at) : null;
    const supersededFrom = row.superseded_from ?? null;
    const status = ruleStatus({
      showsFrom: new Date(row.shows_from), effectiveOn: row.effective_on, endedAt,
      corrected: row.corrected_by != null, superseded: !!supersededFrom && supersededFrom <= today,
    }, now, today);
    return {
      id: Number(row.id), title: row.title, beforeText: row.before_text, afterText: row.message, askWhom: row.ask_whom,
      effectiveOn: row.effective_on, changeKind: row.change_kind, affectsMoney: row.affects_money,
      targetText: texts.get(Number(row.id)) ?? '', publishesAt: iso(row.shows_from), authorName: row.author_name,
      status, endedAt: endedAt ? endedAt.toISOString() : null, endReason: row.end_reason,
      correctedById: row.corrected_by == null ? null : Number(row.corrected_by), supersededFrom,
      correctsId: row.corrects_announcement_id == null ? null : Number(row.corrects_announcement_id),
      supersedesId: row.supersedes_announcement_id == null ? null : Number(row.supersedes_announcement_id),
      readCount: Number(row.read_count), recipientCount: Number(row.recipient_count),
      myReadAt: row.my_read_at ? iso(row.my_read_at) : null,
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Konsep (spec F3-3 §3.1, BER-L23)

export type DraftInput = {
  title: string; beforeText: string; afterText: string; askWhom: string; changeKind: RuleChangeKind; affectsMoney: boolean;
  target: EmergencyTarget; publishesAt: string | null; effectiveOn: string | null; supersedesAnnouncementId: number | null;
};

export type DraftView = DraftInput & {
  id: number; status: DraftStatus; correctsAnnouncementId: number | null; requestId: number | null; announcementId: number | null;
  closeReason: string | null; authorName: string | null; updatedAt: string;
  /** Ralat pengumuman yang lahir dari pengaturan/tarif ritase: tanggal berlaku terkunci (spec F3-3 §4.1). */
  linked: boolean;
};

type DraftRow = typeof announcementDrafts.$inferSelect;

const isLinked = (row: Pick<DraftRow, 'settingValueIds' | 'tripRateId'>) => !!row.settingValueIds?.length || row.tripRateId != null;

function toView(row: DraftRow, authorName: string | null = null): DraftView {
  return {
    id: row.id, title: row.title, beforeText: row.beforeText, afterText: row.afterText, askWhom: row.askWhom,
    changeKind: row.changeKind, affectsMoney: row.affectsMoney, target: row.target as EmergencyTarget,
    publishesAt: row.publishesAt ? row.publishesAt.toISOString() : null, effectiveOn: row.effectiveOn,
    supersedesAnnouncementId: row.supersedesAnnouncementId, status: row.status, correctsAnnouncementId: row.correctsAnnouncementId,
    requestId: row.requestId, announcementId: row.announcementId, closeReason: row.closeReason, authorName,
    updatedAt: row.updatedAt.toISOString(), linked: isLinked(row),
  };
}

function draftValues(input: DraftInput) {
  const publishesAt = input.publishesAt ? new Date(input.publishesAt) : null;
  return {
    title: input.title.trim().slice(0, 200), beforeText: input.beforeText.slice(0, 2000), afterText: input.afterText.slice(0, 2000),
    askWhom: input.askWhom.trim().slice(0, 300), changeKind: input.changeKind, affectsMoney: input.affectsMoney,
    target: normalizeTarget(input.target), publishesAt: publishesAt && !Number.isNaN(publishesAt.getTime()) ? publishesAt : null,
    effectiveOn: input.effectiveOn || null, supersedesAnnouncementId: input.supersedesAnnouncementId,
  };
}

export async function createDraft(actor: Actor | null, input: DraftInput): Promise<Result<{ id: number }>> {
  if (!canWriteRules(actor)) return fail(403, 'Anda tidak berhak menulis perubahan aturan.');
  const [row] = await db.insert(announcementDrafts).values({
    ...draftValues(input), createdByAccountId: actor.accountId, createdByEmployeeId: actor.personId, updatedByAccountId: actor.accountId,
  }).returning({ id: announcementDrafts.id });
  return { ok: true, value: { id: row.id } };
}

export async function updateDraft(actor: Actor | null, id: number, input: DraftInput): Promise<Result<null>> {
  if (!canWriteRules(actor)) return fail(403, 'Anda tidak berhak menulis perubahan aturan.');
  const [current] = await db.select().from(announcementDrafts).where(eq(announcementDrafts.id, id));
  const values = draftValues(input);
  // Ralat pengumuman pengaturan/tarif hanya mengubah tulisan (spec F3-3 §4.1): tanggal berlaku tetap.
  if (current && isLinked(current)) values.effectiveOn = current.effectiveOn;
  const [row] = await db.update(announcementDrafts)
    .set({ ...values, updatedByAccountId: actor.accountId, updatedAt: new Date() })
    .where(and(eq(announcementDrafts.id, id), eq(announcementDrafts.status, 'DRAFT')))
    .returning({ id: announcementDrafts.id });
  if (!row) return fail(409, 'Konsep ini sudah tidak bisa diubah (sudah dikirim, terbit, atau dibuang).');
  return { ok: true, value: null };
}

export async function discardDraft(actor: Actor | null, id: number): Promise<Result<null>> {
  if (!canWriteRules(actor)) return fail(403, 'Anda tidak berhak menulis perubahan aturan.');
  const [row] = await db.update(announcementDrafts)
    .set({ status: 'DISCARDED', updatedByAccountId: actor.accountId, updatedAt: new Date() })
    .where(and(eq(announcementDrafts.id, id), eq(announcementDrafts.status, 'DRAFT')))
    .returning({ id: announcementDrafts.id });
  if (!row) return fail(409, 'Hanya konsep yang belum dikirim yang bisa dibuang. Pengajuan yang menunggu dibatalkan dari Pengajuan Saya.');
  return { ok: true, value: null };
}

export async function getDraft(actor: Actor | null, id: number): Promise<Result<DraftView>> {
  if (!canWriteRules(actor)) return fail(403, 'Anda tidak berhak menulis perubahan aturan.');
  const [row] = await db.select().from(announcementDrafts).where(eq(announcementDrafts.id, id));
  if (!row) return fail(404, 'Konsep tidak ditemukan.');
  return { ok: true, value: toView(row) };
}

/** Salin pengumuman/konsep jadi konsep baru (Ralat, atau "Salin jadi konsep baru" sesudah ditolak). */
export async function copyRejectedDraft(actor: Actor | null, id: number): Promise<Result<{ id: number }>> {
  if (!canWriteRules(actor)) return fail(403, 'Anda tidak berhak menulis perubahan aturan.');
  const [row] = await db.select().from(announcementDrafts).where(eq(announcementDrafts.id, id));
  if (!row || (row.status !== 'REJECTED' && row.status !== 'DISCARDED')) return fail(404, 'Konsep tidak ditemukan.');
  const [created] = await db.insert(announcementDrafts).values({
    title: row.title, beforeText: row.beforeText, afterText: row.afterText, askWhom: row.askWhom, changeKind: row.changeKind,
    affectsMoney: row.affectsMoney, target: row.target, publishesAt: null, effectiveOn: null,
    correctsAnnouncementId: row.correctsAnnouncementId, supersedesAnnouncementId: row.supersedesAnnouncementId,
    settingValueIds: row.settingValueIds, tripRateId: row.tripRateId,
    createdByAccountId: actor.accountId, createdByEmployeeId: actor.personId, updatedByAccountId: actor.accountId,
  }).returning({ id: announcementDrafts.id });
  return { ok: true, value: { id: created.id } };
}

/** Isian konsep → isian aturan untuk diperiksa. */
function ruleInputOf(row: DraftRow) {
  return {
    title: row.title, beforeText: row.beforeText, afterText: row.afterText, askWhom: row.askWhom, changeKind: row.changeKind,
    affectsMoney: row.affectsMoney, target: row.target as EmergencyTarget, publishesAt: row.publishesAt, effectiveOn: row.effectiveOn,
  };
}

/**
 * Pemeriksaan kaitan: ralat hanya untuk pengumuman aturan yang terbit, belum ditarik, dan belum diralat; aturan
 * yang digantikan harus aturan yang masih berlaku dan tanggal berlakunya lebih awal.
 */
async function linkProblem(executor: typeof db | Tx, row: Pick<DraftRow, 'correctsAnnouncementId' | 'supersedesAnnouncementId'>, effectiveOn: IsoDate): Promise<string | null> {
  if (row.correctsAnnouncementId) {
    const [old] = await executor.execute<{ ok: boolean }>(sql`
      select (a.kind = 'RULE' and a.ended_at is null and a.shows_from <= now() and not ${correctedSql}) as ok
      from hris.announcements a where a.id = ${row.correctsAnnouncementId} for update`);
    if (!old?.ok) return 'Pengumuman yang diralat sudah ditarik atau sudah diralat lebih dulu. Muat ulang halaman.';
  }
  if (row.supersedesAnnouncementId) {
    const [old] = await executor.execute<{ ok: boolean; effective_on: string }>(sql`
      select (a.kind = 'RULE' and a.ended_at is null and not ${correctedSql}) as ok, a.effective_on::text as effective_on
      from hris.announcements a where a.id = ${row.supersedesAnnouncementId}`);
    if (!old?.ok) return 'Aturan lama yang dipilih untuk digantikan sudah tidak berlaku. Pilih lagi.';
    if (old.effective_on >= effectiveOn) return 'Tanggal berlaku harus sesudah tanggal berlaku aturan lama yang digantikan.';
  }
  return null;
}

/** Tulis baris pengumuman aturan + sasarannya (tidak diubah sesudahnya). */
export async function insertRule(tx: Tx, value: ValidRule, meta: {
  createdByAccountId: number; createdByEmployeeId: number; correctsId: number | null; supersedesId: number | null;
  approvedByAccountId: number | null; requestId: number | null;
  /** Kaitan wajib umumkan (spec F3-3 §4.2). */
  settingValueIds?: number[] | null; tripRateId?: number | null;
}): Promise<number> {
  const [row] = await tx.insert(announcements).values({
    kind: 'RULE', title: value.title, message: value.afterText, beforeText: value.beforeText, askWhom: value.askWhom,
    effectiveOn: value.effectiveOn, changeKind: value.changeKind, affectsMoney: value.affectsMoney, targetAll: value.target.all,
    showsFrom: value.publishesAt, showsUntil: null, createdByAccountId: meta.createdByAccountId, createdByEmployeeId: meta.createdByEmployeeId,
    correctsAnnouncementId: meta.correctsId, supersedesAnnouncementId: meta.supersedesId,
    approvedByAccountId: meta.approvedByAccountId, requestId: meta.requestId,
    settingValueIds: meta.settingValueIds?.length ? meta.settingValueIds : null, tripRateId: meta.tripRateId ?? null,
  }).returning({ id: announcements.id });
  if (!value.target.all) {
    const rows = [
      ...value.target.branchIds.map((branchId) => ({ announcementId: row.id, branchId, positionId: null })),
      ...value.target.positionIds.map((positionId) => ({ announcementId: row.id, branchId: null, positionId })),
    ];
    if (rows.length) await tx.insert(announcementTargets).values(rows);
  }
  return row.id;
}

/**
 * Terbitkan sekarang atau jadwalkan (tanpa persetujuan). Pengumuman uang oleh selain Pemilik/GM harus lewat
 * "Kirim untuk disetujui" (pengajuan `rule_announcement`).
 */
export async function publishDraft(actor: Actor | null, id: number, mode: 'now' | 'schedule'): Promise<Result<{ announcementId: number; recipients: number }>> {
  if (!canPublish(actor)) return fail(403, 'Anda tidak berhak menerbitkan perubahan aturan.');
  const gaps = await ruleGaps();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(announcementDrafts).where(eq(announcementDrafts.id, id)).for('update');
    if (!row) return fail(404, 'Konsep tidak ditemukan.');
    if (row.status !== 'DRAFT') return fail(409, 'Konsep ini sudah dikirim, terbit, atau dibuang.');
    if (needsApproval(row.affectsMoney, actor.fullAccess)) return fail(400, 'Perubahan yang menyangkut uang harus dikirim untuk disetujui Pemilik atau GM.');
    const now = new Date();
    const input = ruleInputOf(row);
    if (mode === 'now') input.publishesAt = null;
    else if (!input.publishesAt || input.publishesAt.getTime() <= now.getTime()) return fail(400, 'Pilih jadwal terbit yang akan datang, atau Terbitkan sekarang.');
    const checked = validateRule(input, gaps, now);
    if (!checked.ok) return fail(400, checked.error);
    const problem = await linkProblem(tx, row, checked.value.effectiveOn);
    if (problem) return fail(409, problem);
    const recipients = await countRecipients(checked.value.target);
    if (!recipients) return fail(400, 'Tidak ada karyawan aktif pada sasaran ini.');
    const announcementId = await insertRule(tx, checked.value, {
      createdByAccountId: actor.accountId, createdByEmployeeId: actor.personId, correctsId: row.correctsAnnouncementId,
      supersedesId: row.supersedesAnnouncementId, approvedByAccountId: null, requestId: null,
      settingValueIds: row.settingValueIds, tripRateId: row.tripRateId,
    });
    await tx.update(announcementDrafts).set({
      status: 'PUBLISHED', announcementId, submittedByAccountId: actor.accountId, submittedByEmployeeId: actor.personId,
      updatedByAccountId: actor.accountId, updatedAt: now,
    }).where(eq(announcementDrafts.id, id));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'announcement', entityId: announcementId, action: row.correctsAnnouncementId ? 'rule.correct' : 'rule.publish',
      after: { ...checked.value, publishesAt: checked.value.publishesAt.toISOString(), draftId: id, correctsId: row.correctsAnnouncementId, supersedesId: row.supersedesAnnouncementId, recipients },
    });
    return { ok: true as const, value: { announcementId, recipients } };
  });
}

/** Pemeriksaan sebelum "Kirim untuk disetujui" (dipakai handler pengajuan). */
export async function prepareRuleSubmit(tx: Tx, actor: Actor, draftId: number): Promise<Result<{ draft: DraftRow; value: ValidRule }>> {
  const [row] = await tx.select().from(announcementDrafts).where(eq(announcementDrafts.id, draftId)).for('update');
  if (!row) return fail(404, 'Konsep tidak ditemukan.');
  if (row.status !== 'DRAFT') return fail(409, 'Konsep ini sudah dikirim, terbit, atau dibuang.');
  if (!needsApproval(row.affectsMoney, actor.fullAccess)) return fail(400, 'Perubahan ini tidak perlu persetujuan; terbitkan atau jadwalkan langsung.');
  const checked = validateRule(ruleInputOf(row), await ruleGaps(), new Date());
  if (!checked.ok) return fail(400, checked.error);
  const problem = await linkProblem(tx, row, checked.value.effectiveOn);
  if (problem) return fail(409, problem);
  if (!(await countRecipients(checked.value.target))) return fail(400, 'Tidak ada karyawan aktif pada sasaran ini.');
  return { ok: true, value: { draft: row, value: checked.value } };
}

export async function markDraftSubmitted(tx: Tx, actor: Actor, draftId: number, requestId: number): Promise<void> {
  await tx.update(announcementDrafts).set({
    status: 'SUBMITTED', requestId, submittedByAccountId: actor.accountId, submittedByEmployeeId: actor.personId,
    updatedByAccountId: actor.accountId, updatedAt: new Date(),
  }).where(eq(announcementDrafts.id, draftId));
}

export async function draftByRequest(executor: typeof db | Tx, requestId: number): Promise<DraftRow | null> {
  const [row] = await executor.select().from(announcementDrafts).where(eq(announcementDrafts.requestId, requestId));
  return row ?? null;
}

/** Jadwal bila disetujui sekarang (bergeser bila jadwal terbitnya sudah lewat, v3 kejadian 19). */
export async function scheduleIfApprovedNow(row: DraftRow) {
  return approvalSchedule({ publishesAt: row.publishesAt, effectiveOn: row.effectiveOn ?? todayWib(), changeKind: row.changeKind }, await ruleGaps(), new Date());
}

/** Pengumuman uang disetujui: terbit (atau terjadwal) dengan tanggal yang mungkin bergeser. */
export async function publishApproved(tx: Tx, actorAccountId: number, requestId: number): Promise<Result<{ announcementId: number; text: string }>> {
  const [row] = await tx.select().from(announcementDrafts).where(eq(announcementDrafts.requestId, requestId)).for('update');
  if (!row || row.status !== 'SUBMITTED' || !row.effectiveOn) return fail(409, 'Konsep pengumuman ini sudah tidak menunggu persetujuan.');
  const schedule = await scheduleIfApprovedNow(row);
  if (isLinked(row) && schedule.shifted) {
    return fail(409, 'Ralat ini terkait pengaturan atau tarif yang tanggal berlakunya terkunci, dan jaraknya sudah tidak cukup. Tolak pengajuan ini.');
  }
  const checked = validateRule({ ...ruleInputOf(row), publishesAt: schedule.publishesAt, effectiveOn: schedule.effectiveOn }, await ruleGaps(), new Date());
  if (!checked.ok) return fail(400, checked.error);
  const problem = await linkProblem(tx, row, checked.value.effectiveOn);
  if (problem) return fail(409, problem);
  const announcementId = await insertRule(tx, checked.value, {
    createdByAccountId: row.submittedByAccountId ?? row.createdByAccountId, createdByEmployeeId: row.submittedByEmployeeId ?? row.createdByEmployeeId,
    correctsId: row.correctsAnnouncementId, supersedesId: row.supersedesAnnouncementId, approvedByAccountId: actorAccountId, requestId,
    settingValueIds: row.settingValueIds, tripRateId: row.tripRateId,
  });
  await tx.update(announcementDrafts).set({ status: 'PUBLISHED', announcementId, updatedByAccountId: actorAccountId, updatedAt: new Date() })
    .where(eq(announcementDrafts.id, row.id));
  await recordAudit(tx, {
    actorAccountId, entity: 'announcement', entityId: announcementId, action: row.correctsAnnouncementId ? 'rule.correct' : 'rule.publish',
    after: { ...checked.value, publishesAt: checked.value.publishesAt.toISOString(), draftId: row.id, requestId, shifted: schedule.shifted },
  });
  return { ok: true, value: { announcementId, text: scheduleText(checked.value.publishesAt, checked.value.effectiveOn, schedule.shifted) } };
}

export function scheduleText(publishesAt: Date, effectiveOn: IsoDate, shifted: boolean): string {
  const when = publishesAt.getTime() <= Date.now() + 60_000 ? 'terbit sekarang'
    : `terbit ${publishesAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })}`;
  return `Pengumuman ${when} dan berlaku mulai ${effectiveOn}${shifted ? ' (tanggal berlaku bergeser karena jadwal terbitnya sudah lewat)' : ''}.`;
}

/** Pengajuan ditolak atau dibatalkan: konsepnya ditutup. */
export async function closeSubmitted(tx: Tx, actorAccountId: number, requestId: number, reason: string): Promise<void> {
  await tx.update(announcementDrafts).set({ status: 'REJECTED', closeReason: reason, updatedByAccountId: actorAccountId, updatedAt: new Date() })
    .where(and(eq(announcementDrafts.requestId, requestId), eq(announcementDrafts.status, 'SUBMITTED')));
}

// ---------------------------------------------------------------------------------------------------------------
// Ralat dan Tarik

export async function startCorrection(actor: Actor | null, id: number): Promise<Result<{ draftId: number }>> {
  if (!canPublish(actor)) return fail(403, 'Anda tidak berhak meralat perubahan aturan.');
  const [rule] = await loadRules(sql`a.id = ${id}`, actor.personId);
  if (!rule) return fail(404, 'Pengumuman tidak ditemukan.');
  if (rule.status === 'SCHEDULED') return fail(409, 'Pengumuman ini belum terbit. Tarik lalu tulis ulang.');
  if (rule.status === 'WITHDRAWN' || rule.status === 'CORRECTED') return fail(409, 'Pengumuman ini sudah ditarik atau sudah diralat.');
  const [open] = await db.select({ id: announcementDrafts.id }).from(announcementDrafts)
    .where(and(eq(announcementDrafts.correctsAnnouncementId, id), inArray(announcementDrafts.status, ['DRAFT', 'SUBMITTED'])));
  if (open) return { ok: true, value: { draftId: open.id } };
  const targets = await db.select().from(announcementTargets).where(eq(announcementTargets.announcementId, id));
  const [first] = await db.select({ targetAll: announcements.targetAll, settingValueIds: announcements.settingValueIds, tripRateId: announcements.tripRateId })
    .from(announcements).where(eq(announcements.id, id));
  const target: EmergencyTarget = first?.targetAll ? { all: true } : {
    all: false,
    branchIds: targets.filter((t) => t.branchId != null).map((t) => t.branchId!),
    positionIds: targets.filter((t) => t.positionId != null).map((t) => t.positionId!),
  };
  const [created] = await db.insert(announcementDrafts).values({
    title: rule.title, beforeText: rule.beforeText, afterText: rule.afterText, askWhom: rule.askWhom, changeKind: rule.changeKind,
    affectsMoney: rule.affectsMoney, target, publishesAt: null, effectiveOn: rule.effectiveOn, correctsAnnouncementId: id,
    supersedesAnnouncementId: rule.supersedesId, createdByAccountId: actor.accountId, createdByEmployeeId: actor.personId,
    settingValueIds: first?.settingValueIds ?? null, tripRateId: first?.tripRateId ?? null,
    updatedByAccountId: actor.accountId,
  }).returning({ id: announcementDrafts.id });
  return { ok: true, value: { draftId: created.id } };
}

/**
 * Tarik pengumuman yang lahir dari pengaturan/tarif ritase (spec F3-3 §4.1): nilainya ikut batal lewat layanan
 * pemiliknya, yang sekaligus menarik semua pengumuman terkait (termasuk ralatnya).
 */
async function withdrawLinked(actor: Actor, id: number, reason: string, link: { settingValueIds: number[] | null; tripRateId: number | null }): Promise<Result<null>> {
  if (link.tripRateId != null) {
    const result = await cancelRate(actor, link.tripRateId, reason);
    if (!result.ok) return fail(result.status === 403 ? 403 : 409, result.status === 403 ? 'Pengumuman ini terkait tarif ritase; hanya Pemilik/GM yang bisa menariknya.' : result.error);
  } else {
    // Satu nilai cukup: cancelSetting ikut membatalkan nilai lain yang diumumkan bersamanya.
    const result = await cancelSetting(actor, (link.settingValueIds ?? [])[0], reason);
    if (!result.ok) {
      return fail(result.status === 403 ? 403 : 409, result.status === 403
        ? 'Pengumuman ini terkait pengaturan; hanya yang berhak mengubah pengaturan itu yang bisa menariknya.' : result.error);
    }
  }
  const [row] = await db.select({ endedAt: announcements.endedAt }).from(announcements).where(eq(announcements.id, id));
  if (!row?.endedAt) return fail(409, 'Pengumuman belum tertarik. Muat ulang halaman lalu ulangi.');
  return { ok: true, value: null };
}

export async function withdrawRule(actor: Actor | null, id: number, reasonInput: string): Promise<Result<null>> {
  if (!canPublish(actor)) return fail(403, 'Anda tidak berhak menarik perubahan aturan.');
  const reason = await checkReason(reasonInput, 'Alasan menarik');
  if (!reason.ok) return fail(400, reason.error);
  const [link] = await db.select({ settingValueIds: announcements.settingValueIds, tripRateId: announcements.tripRateId, kind: announcements.kind })
    .from(announcements).where(eq(announcements.id, id));
  if (link?.kind === 'RULE' && (link.settingValueIds?.length || link.tripRateId != null)) {
    const [rule] = await loadRules(sql`a.id = ${id}`, actor.personId);
    const block = rule && withdrawBlock({ effectiveOn: rule.effectiveOn, endedAt: rule.endedAt ? new Date(rule.endedAt) : null, corrected: rule.status === 'CORRECTED' }, todayWib());
    if (!rule) return fail(404, 'Pengumuman tidak ditemukan.');
    if (block) return fail(409, block);
    return withdrawLinked(actor, id, reason.reason, link);
  }
  return db.transaction(async (tx) => {
    const [row] = await tx.execute<{ kind: string; effective_on: string; ended_at: string | null; corrected: boolean }>(sql`
      select a.kind, a.effective_on::text as effective_on, a.ended_at, ${correctedSql} as corrected
      from hris.announcements a where a.id = ${id} for update`);
    if (!row || row.kind !== 'RULE') return fail(404, 'Pengumuman tidak ditemukan.');
    const block = withdrawBlock({ effectiveOn: row.effective_on, endedAt: row.ended_at ? new Date(row.ended_at) : null, corrected: row.corrected }, todayWib());
    if (block) return fail(409, block);
    await tx.update(announcements).set({ endedAt: sql`now()`, endedByAccountId: actor.accountId, endReason: reason.reason })
      .where(eq(announcements.id, id));
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'announcement', entityId: id, action: 'rule.withdraw', reason: reason.reason });
    return { ok: true as const, value: null };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Kantor › Pengumuman (BER-L22) dan Siapa sudah baca (BER-L25)

export type RuleOfficeTab = 'drafts' | 'waiting' | 'scheduled' | 'published' | 'withdrawn';

export type DraftListRow = {
  id: number; title: string; status: DraftStatus; affectsMoney: boolean; effectiveOn: string | null; authorName: string | null;
  updatedAt: string; requestId: number | null; closeReason: string | null; correctsId: number | null;
};

export async function listRuleOffice(actor: Actor | null): Promise<Result<{
  rules: RuleRow[]; drafts: DraftListRow[]; canDraft: boolean; canPublish: boolean;
}>> {
  if (!canOpenOffice(actor)) return fail(403, 'Anda tidak berhak membuka Pengumuman.');
  const [rules, drafts] = await Promise.all([
    loadRules(sql`true`, actor.personId),
    db.execute<{
      id: number; title: string; status: DraftStatus; affects_money: boolean; effective_on: string | null; author_name: string | null;
      updated_at: string | Date; request_id: number | null; close_reason: string | null; corrects_announcement_id: number | null;
    }>(sql`
      select d.id, d.title, d.status, d.affects_money, d.effective_on::text as effective_on, e.name as author_name, d.updated_at,
        d.request_id, d.close_reason, d.corrects_announcement_id
      from hris.announcement_drafts d left join hris.employees e on e.id = d.created_by_employee_id
      where d.status in ('DRAFT', 'SUBMITTED', 'REJECTED') order by d.updated_at desc limit 200`),
  ]);
  return {
    ok: true,
    value: {
      rules,
      drafts: drafts.map((d) => ({
        id: Number(d.id), title: d.title, status: d.status, affectsMoney: d.affects_money, effectiveOn: d.effective_on,
        authorName: d.author_name, updatedAt: iso(d.updated_at), requestId: d.request_id == null ? null : Number(d.request_id),
        closeReason: d.close_reason, correctsId: d.corrects_announcement_id == null ? null : Number(d.corrects_announcement_id),
      })),
      canDraft: canWriteRules(actor),
      canPublish: canPublish(actor),
    },
  };
}

export async function announcementKindOf(id: number): Promise<'EMERGENCY' | 'RULE' | null> {
  const [row] = await db.select({ kind: announcements.kind }).from(announcements).where(eq(announcements.id, id));
  return row?.kind ?? null;
}

export async function ruleReaders(actor: Actor | null, id: number): Promise<Result<{
  rule: RuleRow; readers: ReaderRow[]; canWithdraw: boolean; canCorrect: boolean;
}>> {
  if (!canOpenOffice(actor)) return fail(403, 'Anda tidak berhak melihat siapa sudah membaca.');
  const [rule] = await loadRules(sql`a.id = ${id}`, actor.personId);
  if (!rule) return fail(404, 'Pengumuman tidak ditemukan.');
  const publishable = canPublish(actor);
  return {
    ok: true,
    value: {
      rule, readers: await readersOf(id),
      canWithdraw: publishable && !withdrawBlock({ effectiveOn: rule.effectiveOn, endedAt: rule.endedAt ? new Date(rule.endedAt) : null, corrected: rule.status === 'CORRECTED' }, todayWib()),
      canCorrect: publishable && isCurrent(rule.status),
    },
  };
}

/** Pratinjau langkah 2–3: jumlah penerima dan tanggal berlaku paling cepat. */
export async function previewRule(actor: Actor | null, input: { target: EmergencyTarget; publishesAt: string | null; changeKind: RuleChangeKind })
  : Promise<Result<{ recipients: number; earliestEffective: IsoDate }>> {
  if (!canWriteRules(actor)) return fail(403, 'Anda tidak berhak menulis perubahan aturan.');
  const at = input.publishesAt ? new Date(input.publishesAt) : new Date();
  const publishesAt = Number.isNaN(at.getTime()) || at.getTime() < Date.now() ? new Date() : at;
  return {
    ok: true,
    value: { recipients: await countRecipients(normalizeTarget(input.target)), earliestEffective: earliestEffective(publishesAt, input.changeKind, await ruleGaps()) },
  };
}

/** Aturan yang masih berlaku untuk pilihan "menggantikan aturan lama". */
export async function supersedeOptions(actor: Actor | null): Promise<{ id: number; title: string; effectiveOn: string }[]> {
  if (!canWriteRules(actor)) return [];
  const rows = await loadRules(sql`a.ended_at is null`, actor.personId);
  return rows.filter((row) => isCurrent(row.status) || row.status === 'SCHEDULED').map((row) => ({ id: row.id, title: row.title, effectiveOn: row.effectiveOn }));
}

// ---------------------------------------------------------------------------------------------------------------
// Papan untuk karyawan (BER-L08, BER-L09)

/** Penempatan orang ini cocok sasaran, atau ia pernah membaca (tetap terlihat walau sudah pindah, spec F3-3 §2 butir 4). */
const visibleTo = (personId: number) => sql`(
  exists (select 1 from hris.current_placements cp where cp.employee_id = ${personId} and cp.active
    and ${matchesAnnouncement(sql`cp.branch_id`, sql`cp.position_id`)})
  or exists (select 1 from hris.announcement_reads r where r.announcement_id = a.id and r.employee_id = ${personId}))`;

const targetedNow = (personId: number) => sql`exists (select 1 from hris.current_placements cp where cp.employee_id = ${personId} and cp.active
  and ${matchesAnnouncement(sql`cp.branch_id`, sql`cp.position_id`)})`;

export type BoardEmergency = { id: number; title: string; message: string; createdAt: string; showing: boolean; readAt: string | null; senderName: string | null };

export type BoardView = { rules: RuleRow[]; emergencies: BoardEmergency[] };

export async function ruleBoard(actor: Actor | null, tab: 'current' | 'history'): Promise<Result<BoardView>> {
  if (!actor || actor.limited) return fail(403, 'Papan Perubahan Aturan tidak tersedia untuk akun ini.');
  const rules = (await loadRules(sql`a.shows_from <= now() and ${visibleTo(actor.personId)}`, actor.personId))
    // Yang ditarik sebelum sempat terbit tidak pernah dilihat karyawan.
    .filter((row) => row.status !== 'WITHDRAWN' || row.endedAt! > row.publishesAt)
    .filter((row) => (tab === 'current' ? isCurrent(row.status) : !isCurrent(row.status)))
    .sort((a, b) => (tab === 'current' ? Number(!!a.myReadAt) - Number(!!b.myReadAt) : 0) || b.publishesAt.localeCompare(a.publishesAt));
  const raw = await db.execute<{ id: number; title: string; message: string; created_at: string | Date; shows_until: string | Date; ended_at: string | Date | null; read_at: string | Date | null; sender_name: string | null }>(sql`
    select a.id, a.title, a.message, a.created_at, a.shows_until, a.ended_at, r.read_at, e.name as sender_name
    from hris.announcements a
    left join hris.announcement_reads r on r.announcement_id = a.id and r.employee_id = ${actor.personId}
    left join hris.employees e on e.id = a.created_by_employee_id
    where a.kind = 'EMERGENCY' and a.shows_from <= now() and ${visibleTo(actor.personId)}
    order by a.created_at desc limit 100`);
  const emergencies = raw.map((row) => ({
    id: Number(row.id), title: row.title, message: row.message, createdAt: iso(row.created_at), senderName: row.sender_name,
    showing: emergencyStatus({ showsUntil: new Date(row.shows_until), endedAt: row.ended_at ? new Date(row.ended_at) : null }) === 'SHOWING',
    readAt: row.read_at ? iso(row.read_at) : null,
  }))
    // Riwayat darurat hanya yang pernah dibaca (darurat yang lewat tanpa dibaca tidak perlu dibuka ulang).
    .filter((row) => (tab === 'current' ? row.showing : !row.showing && !!row.readAt));
  return { ok: true, value: { rules, emergencies } };
}

export async function ruleDetail(actor: Actor | null, id: number): Promise<Result<{ rule: RuleRow; canRead: boolean }>> {
  if (!actor || actor.limited) return fail(403, 'Papan Perubahan Aturan tidak tersedia untuk akun ini.');
  const [rule] = await loadRules(sql`a.id = ${id} and a.shows_from <= now() and ${visibleTo(actor.personId)}`, actor.personId);
  if (!rule) return fail(404, 'Pengumuman tidak ditemukan.');
  return { ok: true, value: { rule, canRead: !rule.myReadAt && isCurrent(rule.status) } };
}

/** "Sudah saya baca" untuk aturan (sekali, tercatat kapan) dan darurat (F3-2). */
export async function markAnnouncementRead(actor: Actor | null, id: number): Promise<Result<null>> {
  const kind = await announcementKindOf(id);
  if (kind === 'EMERGENCY') return markEmergencyRead(actor, id) as Promise<Result<null>>;
  if (!actor || actor.limited) return fail(403, 'Anda tidak berhak.');
  if (kind !== 'RULE') return fail(404, 'Pengumuman tidak ditemukan.');
  const [already] = await db.select({ id: announcementReads.id }).from(announcementReads)
    .where(and(eq(announcementReads.announcementId, id), eq(announcementReads.employeeId, actor.personId)));
  if (already) return { ok: true, value: null };
  const [rule] = await loadRules(sql`a.id = ${id} and a.shows_from <= now() and ${targetedNow(actor.personId)}`, actor.personId);
  if (!rule || !isCurrent(rule.status)) return fail(409, 'Pengumuman ini sudah tidak berlaku untuk Anda.');
  await db.insert(announcementReads).values({ announcementId: id, employeeId: actor.personId, accountId: actor.accountId }).onConflictDoNothing();
  return { ok: true, value: null };
}

export type UnreadItem = { id: number; kind: 'RULE' | 'EMERGENCY'; title: string; effectiveOn: string | null; publishedAt: string };

/**
 * Pengumuman yang belum dibaca orang ini (kartu Beranda "Pengumuman belum dibaca" + butir antrean RULE).
 * Aturan: terbit, belum ditarik/diralat/digantikan, mengenai dirinya sekarang. Darurat: masih tayang.
 */
export async function unreadAnnouncements(actor: Actor | null): Promise<UnreadItem[]> {
  if (!actor || actor.limited) return [];
  const today = todayWib();
  const rows = await db.execute<{ id: number; kind: 'RULE' | 'EMERGENCY'; title: string; effective_on: string | null; shows_from: string | Date }>(sql`
    select a.id, a.kind, a.title, a.effective_on::text as effective_on, a.shows_from
    from hris.announcements a
    where a.ended_at is null and a.shows_from <= now()
      and (a.kind = 'RULE' and not ${correctedSql}
            and not exists (select 1 from hris.announcements s where s.supersedes_announcement_id = a.id and s.ended_at is null
              and s.shows_from <= now() and s.effective_on <= ${today})
        or a.kind = 'EMERGENCY' and a.shows_until > now())
      and ${targetedNow(actor.personId)}
      and not exists (select 1 from hris.announcement_reads r where r.announcement_id = a.id and r.employee_id = ${actor.personId})
    order by a.kind = 'EMERGENCY' desc, a.shows_from asc, a.id asc`);
  return rows.map((row) => ({ id: Number(row.id), kind: row.kind, title: row.title, effectiveOn: row.effective_on, publishedAt: iso(row.shows_from) }));
}
