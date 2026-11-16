import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { announcementDrafts } from '@petshop/hris-db/schema/announcements';
import { db } from '@/lib/db';
import { getOrgLookup, recordAudit, type Tx } from '@/modules/access';
import {
  MUST_ANNOUNCE_MISSING, checkReason, type AnnounceChoice, type AnnounceFail, type AnnounceSubject, type MustAnnounceHook,
  type MustAnnounceInfo, type ProposalAnnouncer,
} from '@/modules/settings';
import type { EmergencyTarget } from '../rules/emergency';
import { earliestEffective, gapFor, validateRule, type RuleChangeKind, type ValidRule } from '../rules/rule';
import { countRecipients } from './emergency';
import { insertRule, ruleGaps, scheduleText } from './rules';
import { emergencyTargetSchema } from './schemas';
import { targetLine } from './rule-request';

/**
 * Wajib umumkan (spec F3-3 §4): pengumuman yang lahir dari menyimpan pengaturan bertanda `mustAnnounce` atau tarif
 * ritase. Tanggal berlaku = tanggal berlaku nilainya (terkunci); tarik pengumuman = batal nilainya, dan sebaliknya.
 */

const fail = (status: AnnounceFail['status'], error: string): AnnounceFail => ({ ok: false, status, error });

/** Isian langkah Pengumuman di pintu API: umumkan, atau tidak perlu diumumkan dengan alasan. */
export const announcementChoiceSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('announce'),
    title: z.string().max(500),
    beforeText: z.string().max(5000),
    afterText: z.string().max(5000),
    askWhom: z.string().max(500),
    changeKind: z.enum(['UNFAVORABLE', 'FAVORABLE']),
    target: emergencyTargetSchema,
    publishesAt: z.string().max(40).nullable(),
  }),
  z.object({ mode: z.literal('skip'), reason: z.string().max(500) }),
]);

export type AnnouncementInput = z.infer<typeof announcementChoiceSchema>;
type AnnounceFields = Extract<AnnouncementInput, { mode: 'announce' }>;

function parseChoice(raw: unknown): AnnouncementInput | null {
  const parsed = announcementChoiceSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const DATE_TOO_CLOSE = (earliest: string, kind: RuleChangeKind, days: number) =>
  `Tanggal berlaku terlalu dekat untuk diumumkan: perubahan ${kind === 'FAVORABLE' ? 'yang menguntungkan' : 'yang merugikan atau mengubah cara hitung'} `
  + `paling cepat berlaku ${days} hari sesudah terbit. Pilih tanggal berlaku paling cepat ${earliest}, atau pilih "Tidak perlu diumumkan" dengan alasan.`;

/** Periksa isian pengumuman terhadap tanggal berlaku nilai yang terkunci (tanpa menulis). */
async function checkFields(fields: AnnounceFields, info: Pick<MustAnnounceInfo, 'effectiveFrom' | 'affectsMoney' | 'changeKind'>, now: Date)
  : Promise<{ ok: true; value: ValidRule } | AnnounceFail> {
  const gaps = await ruleGaps();
  const changeKind = info.changeKind ?? fields.changeKind;
  const publishesAt = fields.publishesAt ? new Date(fields.publishesAt) : null;
  if (publishesAt && Number.isNaN(publishesAt.getTime())) return fail(400, 'Jadwal terbit tidak valid.');
  const earliest = earliestEffective(publishesAt && publishesAt > now ? publishesAt : now, changeKind, gaps);
  if (info.effectiveFrom < earliest) return fail(400, DATE_TOO_CLOSE(earliest, changeKind, gapFor(changeKind, gaps)));
  const checked = validateRule({
    title: fields.title, beforeText: fields.beforeText, afterText: fields.afterText, askWhom: fields.askWhom, changeKind,
    affectsMoney: info.affectsMoney, target: fields.target as EmergencyTarget, publishesAt, effectiveOn: info.effectiveFrom,
  }, gaps, now);
  if (!checked.ok) return fail(400, checked.error);
  if (!(await countRecipients(checked.value.target))) return fail(400, 'Tidak ada karyawan aktif pada sasaran pengumuman ini.');
  return checked;
}

const correctedSql = sql`exists (select 1 from hris.announcements c where c.corrects_announcement_id = a.id and c.ended_at is null and c.shows_from <= now())`;

/**
 * Pengumuman sebelumnya untuk kunci + sasaran yang sama (atau pasangan tarif yang sama) yang digantikan pengumuman ini
 * (spec F3-3 §4.1). Hanya yang seluruh isinya tercakup perubahan baru, dan berlaku lebih awal.
 */
async function previousFor(tx: Tx, subject: AnnounceSubject, effectiveFrom: string): Promise<number | null> {
  if (subject.kind === 'trip_rate') {
    const [row] = await tx.execute<{ id: number }>(sql`
      select a.id from hris.announcements a join logistics.trip_rates r on r.id = a.trip_rate_id
      where a.kind = 'RULE' and a.ended_at is null and not ${correctedSql} and a.effective_on < ${effectiveFrom}
        and r.vehicle_id = ${subject.vehicleId} and r.route_id = ${subject.routeId}
      order by a.effective_on desc, a.id desc limit 1`);
    return row ? Number(row.id) : null;
  }
  const wanted = new Set(subject.items.map((i) => `${i.key}|${i.targetKind}|${i.targetId ?? 0}`));
  const rows = await tx.execute<{ id: number; keys: string[] }>(sql`
    select a.id, array_agg(v.key || '|' || v.target_kind::text || '|' || coalesce(v.target_id, 0)) as keys
    from hris.announcements a join hris.setting_values v on v.id = any(a.setting_value_ids)
    where a.kind = 'RULE' and a.ended_at is null and not ${correctedSql} and a.effective_on < ${effectiveFrom}
      and exists (select 1 from hris.setting_values w where w.id = any(a.setting_value_ids)
        and w.key in (${sql.join([...new Set(subject.items.map((i) => i.key))].map((k) => sql`${k}`), sql`, `)}))
    group by a.id, a.effective_on order by a.effective_on desc, a.id desc limit 50`);
  const hit = rows.find((row) => row.keys.length > 0 && row.keys.every((k) => wanted.has(k)));
  return hit ? Number(hit.id) : null;
}

async function subjectOfValues(executor: Tx | typeof db, ids: number[]): Promise<AnnounceSubject> {
  const rows = await executor.execute<{ key: string; target_kind: 'ALL' | 'POSITION' | 'BRANCH'; target_id: number | null }>(sql`
    select key, target_kind::text as target_kind, target_id from hris.setting_values
    where id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
  return { kind: 'setting', items: rows.map((r) => ({ key: r.key, targetKind: r.target_kind, targetId: r.target_id == null ? null : Number(r.target_id) })) };
}

/** Pemilik/GM (atau pemegang hak ubah) menyimpan langsung: pengumuman terbit/terjadwal di transaksi yang sama. */
function announceHook(fields: AnnounceFields): MustAnnounceHook {
  return async (tx, actor, info) => {
    const now = new Date();
    const checked = await checkFields(fields, info, now);
    if (!checked.ok) return checked;
    const supersedesId = await previousFor(tx, info.subject, info.effectiveFrom);
    const announcementId = await insertRule(tx, checked.value, {
      createdByAccountId: actor.accountId, createdByEmployeeId: actor.personId, correctsId: null, supersedesId,
      approvedByAccountId: null, requestId: null,
      settingValueIds: info.settingValueIds.length ? info.settingValueIds : null, tripRateId: info.tripRateId,
    });
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'announcement', entityId: announcementId, action: 'rule.publish',
      after: {
        ...checked.value, publishesAt: checked.value.publishesAt.toISOString(), source: info.subject.kind,
        settingValueIds: info.settingValueIds, tripRateId: info.tripRateId, supersedesId,
      },
    });
    return { ok: true };
  };
}

/** Isian API → pilihan untuk layanan settings/logistics. Kosong = belum memilih (layanan menolak bila wajib). */
export function toAnnounceChoice(raw: unknown): AnnounceChoice | undefined {
  const parsed = parseChoice(raw);
  if (!parsed) return undefined;
  return parsed.mode === 'skip' ? { skipReason: parsed.reason } : { announce: announceHook(parsed) };
}

/**
 * Usulan HR untuk pengaturan jabatan wajib umumkan (spec F3-3 §4.1): konsep pengumuman ikut pengajuan; disetujui =
 * pengaturan aktif dan pengumuman terbit. Jarak yang sudah tidak cukup saat disetujui = persetujuan ditolak sistem.
 */
export function proposalAnnouncer(): ProposalAnnouncer {
  const linkedDraft = async (executor: Tx | typeof db, requestId: number) => {
    const [row] = await executor.select().from(announcementDrafts)
      .where(and(eq(announcementDrafts.requestId, requestId), sql`${announcementDrafts.settingValueIds} is not null`));
    return row ?? null;
  };
  return {
    async check(raw, info) {
      const parsed = parseChoice(raw);
      if (!parsed) return fail(400, MUST_ANNOUNCE_MISSING);
      if (parsed.mode === 'skip') {
        const reason = await checkReason(parsed.reason, 'Alasan tidak perlu diumumkan');
        return reason.ok ? { ok: true, skipReason: reason.reason } : fail(400, reason.error);
      }
      const checked = await checkFields(parsed, info, new Date());
      return checked.ok ? { ok: true, skipReason: null } : checked;
    },

    async save(tx, actor, requestId, raw, info) {
      const parsed = parseChoice(raw);
      if (!parsed || parsed.mode !== 'announce') return;
      await tx.insert(announcementDrafts).values({
        title: parsed.title.trim(), beforeText: parsed.beforeText.trim(), afterText: parsed.afterText.trim(), askWhom: parsed.askWhom.trim(),
        changeKind: info.changeKind ?? parsed.changeKind, affectsMoney: info.affectsMoney, target: parsed.target,
        publishesAt: parsed.publishesAt ? new Date(parsed.publishesAt) : null, effectiveOn: info.effectiveFrom,
        settingValueIds: info.settingValueIds, status: 'SUBMITTED', requestId,
        createdByAccountId: actor.accountId, createdByEmployeeId: actor.personId,
        submittedByAccountId: actor.accountId, submittedByEmployeeId: actor.personId, updatedByAccountId: actor.accountId,
      });
    },

    async publish(tx, actorAccountId, requestId) {
      const row = await linkedDraft(tx, requestId);
      if (!row) return { ok: true, text: null };
      if (row.status !== 'SUBMITTED' || !row.effectiveOn || !row.settingValueIds?.length) return fail(409, 'Konsep pengumuman usulan ini sudah tidak menunggu.');
      const now = new Date();
      const checked = await checkFields({
        mode: 'announce', title: row.title, beforeText: row.beforeText, afterText: row.afterText, askWhom: row.askWhom,
        changeKind: row.changeKind, target: row.target as AnnounceFields['target'],
        publishesAt: row.publishesAt && row.publishesAt > now ? row.publishesAt.toISOString() : null,
      }, { effectiveFrom: row.effectiveOn, affectsMoney: row.affectsMoney, changeKind: row.changeKind }, now);
      // Tanggal berlaku pengaturan tidak digeser diam-diam (spec F3-3 §9 butir 6).
      if (!checked.ok) return fail(409, `Pengumuman usulan ini tidak bisa terbit: ${checked.error}`);
      const subject = await subjectOfValues(tx, row.settingValueIds);
      const supersedesId = await previousFor(tx, subject, row.effectiveOn);
      const announcementId = await insertRule(tx, checked.value, {
        createdByAccountId: row.submittedByAccountId ?? row.createdByAccountId, createdByEmployeeId: row.submittedByEmployeeId ?? row.createdByEmployeeId,
        correctsId: null, supersedesId, approvedByAccountId: actorAccountId, requestId, settingValueIds: row.settingValueIds, tripRateId: null,
      });
      await tx.update(announcementDrafts).set({ status: 'PUBLISHED', announcementId, updatedByAccountId: actorAccountId, updatedAt: now })
        .where(eq(announcementDrafts.id, row.id));
      await recordAudit(tx, {
        actorAccountId, entity: 'announcement', entityId: announcementId, action: 'rule.publish',
        after: { ...checked.value, publishesAt: checked.value.publishesAt.toISOString(), draftId: row.id, requestId, source: 'setting', settingValueIds: row.settingValueIds, supersedesId },
      });
      return { ok: true, text: scheduleText(checked.value.publishesAt, checked.value.effectiveOn, false) };
    },

    async close(tx, actorAccountId, requestId, reason) {
      await tx.update(announcementDrafts).set({ status: 'REJECTED', closeReason: reason, updatedByAccountId: actorAccountId, updatedAt: new Date() })
        .where(and(eq(announcementDrafts.requestId, requestId), eq(announcementDrafts.status, 'SUBMITTED'), sql`${announcementDrafts.settingValueIds} is not null`));
    },

    async describe(requestId) {
      const row = await linkedDraft(db, requestId);
      if (!row) return [];
      const org = await getOrgLookup();
      const names = { branches: new Map(org.branches.map((b) => [b.id, b.name])), positions: new Map(org.positions.map((p) => [p.id, p.name])) };
      return [
        { label: 'Pengumuman: judul', before: null, after: row.title },
        { label: 'Pengumuman: aturan', before: row.beforeText, after: row.afterText },
        { label: 'Pengumuman: tanya ke', before: null, after: row.askWhom },
        { label: 'Pengumuman: sasaran', before: null, after: targetLine(row.target as EmergencyTarget, names) },
      ];
    },

    async resubmit(requestId) {
      const row = await linkedDraft(db, requestId);
      if (!row) return null;
      return {
        mode: 'announce', title: row.title, beforeText: row.beforeText, afterText: row.afterText, askWhom: row.askWhom,
        changeKind: row.changeKind, target: row.target, publishesAt: null,
      };
    },
  };
}

/** Pilihan sasaran di langkah Pengumuman (cabang dan jabatan aktif). */
export async function announceOptions(): Promise<{ branches: { id: number; name: string }[]; positions: { id: number; name: string }[] }> {
  const org = await getOrgLookup();
  return {
    branches: org.branches.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name })),
    positions: org.positions.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name })),
  };
}
