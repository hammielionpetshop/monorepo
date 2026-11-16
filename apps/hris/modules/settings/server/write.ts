import { eq, sql } from 'drizzle-orm';
import { settingValues } from '@petshop/hris-db/schema/settings';
import { db } from '@/lib/db';
import { can, getOrgLookup, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult } from '@/modules/access';
import { SETTINGS, isSettingKey, type SettingDefinition, type SettingKey, type TargetKind } from '../rules/registry';
import {
  effectiveDateProblem, formatSettingValue, resolveSetting, sameValue, todayWib, valueProblem, type IsoDate,
} from '../rules/resolve';
import { loadRows, settingOn } from './read';
import {
  AnnounceAborted, MUST_ANNOUNCE_MISSING, endLinkedAnnouncements, suggestedTarget, cancelLinkedSettings,
  type AnnounceChoice, type AnnounceLine, type AnnouncePreview,
} from './announce';

const fail = (status: 400 | 403 | 404 | 409, error: string) => ({ ok: false as const, status, error });

/**
 * Alasan dirapikan dan diperiksa panjangnya menurut pengaturan "Panjang alasan paling sedikit" hari ini
 * (PRI-44 butir 2). Dipakai semua modul lewat pintu `@/modules/settings`.
 */
export async function checkReason(value: unknown, label = 'Alasan'): Promise<{ ok: true; reason: string } | { ok: false; error: string }> {
  const reason = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  const min = Number(await settingOn('shared.reason_min_length', todayWib()));
  if (reason.length < min) {
    return { ok: false, error: reason ? `${label} paling sedikit ${min} huruf.` : `${label} wajib diisi (paling sedikit ${min} huruf).` };
  }
  return { ok: true, reason: reason.slice(0, 500) };
}

function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  return (cause as { code?: string })?.code === '23505';
}

function canEdit(actor: Actor | null, definition: SettingDefinition): boolean {
  return can(actor, definition.editAction);
}

/**
 * Pengaturan wajib umumkan (spec F3-3 §4.1): tanpa pengumuman dan tanpa alasan "tidak perlu diumumkan" ditolak.
 * Hasil `skipReason` = alasan yang sudah dirapikan (masuk audit `setting.set`), null bila diumumkan.
 */
export async function checkAnnounceChoice(choice: AnnounceChoice | undefined): Promise<{ ok: true; skipReason: string | null } | { ok: false; error: string }> {
  if (!choice) return { ok: false, error: MUST_ANNOUNCE_MISSING };
  if ('announce' in choice) return { ok: true, skipReason: null };
  const reason = await checkReason(choice.skipReason, 'Alasan tidak perlu diumumkan');
  return reason.ok ? { ok: true, skipReason: reason.reason } : reason;
}

function aborted(error: unknown) {
  return error instanceof AnnounceAborted ? error.result : null;
}

export type SetSettingInput = {
  key: string;
  targetKind: TargetKind;
  targetId: number | null;
  value: unknown;
  effectiveFrom: string;
  reason: string;
  /** Id baris terakhir sasaran ini yang dilihat layar; null bila belum ada baris. */
  /**
   * Isi pertama sasaran cabang yang belum pernah punya nilai sendiri (spec L4c §3.1): boleh berlaku mulai tanggal 26
   * periode berjalan, karena tidak ada nilai lama yang tertimpa. Hanya untuk kunci di FIRST_FILL_KEYS.
   */
  firstFill?: boolean;
  expectedLatestId: number | null;
};

/** Kunci yang boleh diisi pertama kali mulai awal periode berjalan (spec L4c §3.1). */
export const FIRST_FILL_KEYS: readonly SettingKey[] = ['payroll.loss_office_percent'];

function currentPeriodStart(today: IsoDate): IsoDate {
  const [y, m, d] = today.split('-').map(Number);
  const start = d >= 26 ? new Date(Date.UTC(y, m - 1, 26)) : new Date(Date.UTC(y, m - 2, 26));
  return start.toISOString().slice(0, 10);
}

/**
 * Ubah satu pengaturan (BER-L41). Pemilik/GM: langsung berlaku dan pemilik lain diberi tahu (KAR-73). Usulan HR
 * lewat Mesin Pengajuan (`proposals.ts`), jadi di sini hanya pemegang `editAction` yang bisa menyimpan.
 */
export async function setSetting(
  actor: Actor | null, input: SetSettingInput, announce?: ChangeAnnounce, announcement?: AnnounceChoice,
): Promise<ServiceResult<{ id: number }>> {
  if (!isSettingKey(input.key)) return fail(400, 'Pengaturan tidak dikenal.');
  const key: SettingKey = input.key;
  const definition: SettingDefinition = SETTINGS[key];
  if (!actor || !canEdit(actor, definition)) return fail(403, 'Anda tidak berhak mengubah pengaturan ini.');
  if (!definition.targets.includes(input.targetKind)) return fail(400, 'Sasaran pengaturan tidak valid.');
  const targetId = input.targetKind === 'ALL' ? null : input.targetId;
  if (input.targetKind !== 'ALL') {
    if (!targetId) return fail(400, 'Sasaran pengaturan tidak valid.');
    const org = await getOrgLookup();
    const list = input.targetKind === 'POSITION' ? org.positions : org.branches;
    if (!list.some((item) => item.id === targetId && item.active)) {
      return fail(400, input.targetKind === 'POSITION' ? 'Jabatan tidak ditemukan atau nonaktif.' : 'Cabang tidak ditemukan atau nonaktif.');
    }
  }
  const problem = valueProblem(definition, input.value);
  if (problem) return fail(400, problem);
  const org = definition.type.kind === 'position' || definition.type.kind === 'branch' || input.targetKind === 'POSITION' ? await getOrgLookup() : null;
  if (definition.type.kind === 'position' && !org?.positions.some((p) => p.id === Number(input.value) && p.active)) {
    return fail(400, 'Jabatan tidak ditemukan atau nonaktif.');
  }
  if (definition.type.kind === 'branch' && !org?.branches.some((b) => b.id === Number(input.value) && b.active)) {
    return fail(400, 'Cabang tidak ditemukan atau nonaktif.');
  }
  const today = todayWib();
  const firstFill = input.firstFill === true;
  if (firstFill && (!FIRST_FILL_KEYS.includes(key) || input.targetKind !== 'BRANCH' || input.effectiveFrom !== currentPeriodStart(today))) {
    return fail(400, 'Isi pertama hanya untuk persen kantor cabang, berlaku mulai awal periode berjalan.');
  }
  const dateProblem = firstFill ? null : effectiveDateProblem(definition, input.effectiveFrom, today);
  if (dateProblem) return fail(400, dateProblem);
  const effectiveFrom: IsoDate = input.effectiveFrom;
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);
  const choice = definition.mustAnnounce ? await checkAnnounceChoice(announcement) : null;
  if (choice && !choice.ok) return fail(400, choice.error);

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`setting:${key}:${input.targetKind}:${targetId ?? 0}`}))`);
      const rows = await loadRows(tx, [key]);
      const own = rows.filter((r) => r.targetKind === input.targetKind && r.targetId === targetId);
      if (firstFill && own.some((r) => r.status === 'ACTIVE')) return fail(409, 'Cabang ini sudah punya nilai; perubahan berlaku mulai tanggal 26 berikutnya.');
      const latestId = own.reduce<number | null>((max, r) => (max === null || r.id > max ? r.id : max), null);
      if (latestId !== input.expectedLatestId) return fail(409, 'Pengaturan ini baru diubah orang lain. Muat ulang halaman lalu ulangi.');
      if (own.some((r) => r.status === 'ACTIVE' && r.effectiveFrom === effectiveFrom)) {
        return fail(409, 'Sudah ada nilai yang berlaku di tanggal itu. Batalkan dulu nilai itu (bila belum berlaku) atau pilih tanggal lain.');
      }
      const target = input.targetKind === 'POSITION' ? { positionId: targetId } : input.targetKind === 'BRANCH' ? { branchId: targetId } : {};
      const current = resolveSetting(rows, effectiveFrom, target);
      if (current && sameValue(current.value, input.value)) return fail(400, 'Nilainya sama dengan yang berlaku pada tanggal itu; tidak ada yang berubah.');

      const now = new Date();
      const [row] = await tx.insert(settingValues).values({
        key, targetKind: input.targetKind, targetId, value: input.value, effectiveFrom, status: 'ACTIVE',
        reason: reason.reason, createdByAccountId: actor.accountId, approvedByAccountId: actor.accountId, approvedAt: now,
      }).returning({ id: settingValues.id });
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'setting', entityId: row.id, action: 'setting.set',
        before: current ? { value: current.value, effectiveFrom: current.effectiveFrom, targetKind: current.targetKind, targetId: current.targetId } : null,
        after: { key, targetKind: input.targetKind, targetId, value: input.value, effectiveFrom, ...(choice?.skipReason ? { noAnnounceReason: choice.skipReason } : {}) },
        reason: reason.reason,
      });
      if (announcement && 'announce' in announcement && definition.mustAnnounce) {
        const published = await announcement.announce(tx, actor, {
          subject: { kind: 'setting', items: [{ key, targetKind: input.targetKind, targetId }] }, settingValueIds: [row.id], tripRateId: null,
          effectiveFrom, affectsMoney: definition.affectsMoney, changeKind: null,
        });
        if (!published.ok) throw new AnnounceAborted(published);
      }
      const positionName = (id: number) => org?.positions.find((p) => p.id === id)?.name;
      const branchName = (id: number) => org?.branches.find((b) => b.id === id)?.name;
      const targetText = input.targetKind === 'POSITION' ? ` jabatan ${positionName(targetId as number) ?? ''}` : '';
      await announce?.(tx, actor.accountId, {
        what: `mengubah ${definition.label}${targetText}: ${current ? formatSettingValue(key, current.value, positionName, branchName) : 'belum ada'} → ${formatSettingValue(key, input.value, positionName, branchName)}, mulai ${effectiveFrom}`,
        link: definition.module === 'position' ? '/settings/positions' : '/settings/general', entity: 'setting', entityId: row.id,
      });
      return { ok: true as const, data: { id: row.id } };
    });
  } catch (error) {
    const announceFail = aborted(error);
    if (announceFail) return announceFail;
    if (isUniqueViolation(error)) return fail(409, 'Sudah ada nilai yang berlaku di tanggal itu.');
    throw error;
  }
}

/** Batalkan nilai yang belum berlaku (BER-L41 jalan keluar). Yang sudah berlaku hanya diganti nilai baru. */
export async function cancelSetting(actor: Actor | null, id: number, reasonInput: string, announce?: ChangeAnnounce): Promise<ServiceResult<object>> {
  const reason = await checkReason(reasonInput, 'Alasan pembatalan');
  if (!reason.ok) return fail(400, reason.error);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(settingValues).where(eq(settingValues.id, id)).for('update');
    if (!row || !isSettingKey(row.key)) return fail(404, 'Nilai pengaturan tidak ditemukan.');
    const definition: SettingDefinition = SETTINGS[row.key];
    if (!actor || !canEdit(actor, definition)) return fail(403, 'Anda tidak berhak mengubah pengaturan ini.');
    if (row.status !== 'ACTIVE') return fail(409, 'Nilai ini sudah dibatalkan.');
    if (row.effectiveFrom <= todayWib()) return fail(409, 'Nilai yang sudah berlaku tidak bisa dibatalkan; ganti dengan nilai baru bertanggal.');
    await tx.update(settingValues).set({
      status: 'CANCELLED', cancelledByAccountId: actor.accountId, cancelledAt: new Date(), cancelReason: reason.reason,
    }).where(eq(settingValues.id, id));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'setting', entityId: id, action: 'setting.cancel',
      before: { key: row.key, targetKind: row.targetKind, targetId: row.targetId, value: row.value, effectiveFrom: row.effectiveFrom, status: 'ACTIVE' },
      after: { status: 'CANCELLED' },
      reason: reason.reason,
    });
    // Nilai yang sudah diumumkan: pengumumannya ikut ditarik, dan nilai lain yang diumumkan bersamanya ikut batal
    // (spec F3-3 §4.1), supaya tidak ada nilai yang berlaku tanpa pengumuman.
    const linked = await endLinkedAnnouncements(tx, actor.accountId, { settingValueIds: [id] }, `Nilai pengaturan dibatalkan: ${reason.reason}`);
    const siblings = linked.settingValueIds.filter((other) => other !== id);
    if (siblings.length) {
      const cancelled = await cancelLinkedSettings(tx, actor, siblings, reason.reason);
      if (!cancelled.ok) throw new AnnounceAborted(cancelled);
    }
    await announce?.(tx, actor.accountId, {
      what: `membatalkan nilai ${definition.label} yang akan berlaku ${row.effectiveFrom}`,
      link: definition.module === 'position' ? '/settings/positions' : '/settings/general', entity: 'setting', entityId: id,
    });
    return { ok: true as const, data: {} };
  }).catch((error: unknown) => {
    const announceFail = aborted(error);
    if (announceFail) return announceFail;
    throw error;
  });
}

export type SetSettingsBatchInput = {
  /** Nilai baru per kunci (sasaran ALL). Kunci yang nilainya sama dengan yang berlaku di tanggal itu dilewati. */
  values: Record<string, unknown>;
  effectiveFrom: string;
  reason: string;
};

/**
 * Simpan beberapa pengaturan umum sekaligus dengan satu tanggal berlaku dan satu alasan dalam satu transaksi
 * (layar Potongan & Lembur, spec L4b §3.1). Aturan tiap kunci sama dengan `setSetting`.
 */
export async function setSettingsBatch(
  actor: Actor | null, input: SetSettingsBatchInput, announce?: ChangeAnnounce, announcement?: AnnounceChoice,
): Promise<ServiceResult<{ changed: SettingKey[] }>> {
  const entries = Object.entries(input.values ?? {});
  if (!entries.length) return fail(400, 'Tidak ada yang diubah.');
  const today = todayWib();
  const keys: SettingKey[] = [];
  for (const [key, value] of entries) {
    if (!isSettingKey(key)) return fail(400, 'Pengaturan tidak dikenal.');
    const definition: SettingDefinition = SETTINGS[key];
    if (!actor || !canEdit(actor, definition)) return fail(403, 'Anda tidak berhak mengubah pengaturan ini.');
    if (!definition.targets.includes('ALL')) return fail(400, 'Sasaran pengaturan tidak valid.');
    const problem = valueProblem(definition, value);
    if (problem) return fail(400, `${definition.label}: ${problem}`);
    const dateProblem = effectiveDateProblem(definition, input.effectiveFrom, today);
    if (dateProblem) return fail(400, dateProblem);
    keys.push(key);
  }
  if (!actor) return fail(403, 'Anda tidak berhak mengubah pengaturan ini.');
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);
  const effectiveFrom: IsoDate = input.effectiveFrom;
  // Diperiksa di depan bila ada kunci wajib umumkan; yang benar-benar berubah baru diketahui di dalam transaksi.
  const choice = keys.some((key) => SETTINGS[key].mustAnnounce) && announcement ? await checkAnnounceChoice(announcement) : null;
  if (choice && !choice.ok) return fail(400, choice.error);
  try {
    return await db.transaction(async (tx) => {
      for (const key of [...keys].sort()) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`setting:${key}:ALL:0`}))`);
      const rows = await loadRows(tx, keys);
      const changed: SettingKey[] = [];
      const announced: { key: SettingKey; id: number }[] = [];
      const parts: string[] = [];
      const now = new Date();
      for (const key of keys) {
        const own = rows.filter((r) => r.key === key && r.targetKind === 'ALL');
        if (own.some((r) => r.status === 'ACTIVE' && r.effectiveFrom === effectiveFrom)) {
          return fail(409, `${SETTINGS[key].label} sudah punya nilai yang berlaku di tanggal itu. Batalkan dulu nilai terjadwal itu.`);
        }
        const current = resolveSetting(own, effectiveFrom);
        if (current && sameValue(current.value, input.values[key])) continue;
        const [row] = await tx.insert(settingValues).values({
          key, targetKind: 'ALL', targetId: null, value: input.values[key], effectiveFrom, status: 'ACTIVE',
          reason: reason.reason, createdByAccountId: actor.accountId, approvedByAccountId: actor.accountId, approvedAt: now,
        }).returning({ id: settingValues.id });
        await recordAudit(tx, {
          actorAccountId: actor.accountId, entity: 'setting', entityId: row.id, action: 'setting.set',
          before: current ? { value: current.value, effectiveFrom: current.effectiveFrom, targetKind: 'ALL', targetId: null } : null,
          after: {
            key, targetKind: 'ALL', targetId: null, value: input.values[key], effectiveFrom,
            ...(SETTINGS[key].mustAnnounce && choice?.ok && choice.skipReason ? { noAnnounceReason: choice.skipReason } : {}),
          },
          reason: reason.reason,
        });
        if (SETTINGS[key].mustAnnounce) announced.push({ key, id: row.id });
        changed.push(key);
        parts.push(`${SETTINGS[key].label} ${current ? formatSettingValue(key, current.value) : 'belum ada'} → ${formatSettingValue(key, input.values[key])}`);
      }
      if (!changed.length) return fail(400, 'Semua angka sama dengan yang berlaku pada tanggal itu; tidak ada yang berubah.');
      if (announced.length) {
        if (!announcement) throw new AnnounceAborted(fail(400, MUST_ANNOUNCE_MISSING));
        if ('announce' in announcement) {
          const published = await announcement.announce(tx, actor, {
            subject: { kind: 'setting', items: announced.map((a) => ({ key: a.key, targetKind: 'ALL' as const, targetId: null })) },
            settingValueIds: announced.map((a) => a.id), tripRateId: null, effectiveFrom,
            affectsMoney: announced.some((a) => SETTINGS[a.key].affectsMoney), changeKind: null,
          });
          if (!published.ok) throw new AnnounceAborted(published);
        }
      }
      await announce?.(tx, actor.accountId, {
        what: `mengubah Potongan & Lembur mulai ${effectiveFrom}: ${parts.join('; ')}`,
        link: '/settings/deductions-overtime', entity: 'setting', entityId: 0,
      });
      return { ok: true as const, data: { changed } };
    });
  } catch (error) {
    const announceFail = aborted(error);
    if (announceFail) return announceFail;
    if (isUniqueViolation(error)) return fail(409, 'Sudah ada nilai yang berlaku di tanggal itu.');
    throw error;
  }
}

/**
 * Isi awal langkah Pengumuman (spec F3-3 §4.1) untuk satu pengaturan atau beberapa sekaligus (sasaran sama).
 * `required` false = tidak ada kunci wajib umumkan yang berubah; layar langsung menyimpan.
 */
export async function settingAnnouncePreview(actor: Actor | null, input: {
  values: Record<string, unknown>; targetKind: TargetKind; targetId: number | null; effectiveFrom: string; title?: string;
}): Promise<ServiceResult<AnnouncePreview>> {
  if (!actor) return fail(403, 'Anda tidak berhak.');
  const keys = Object.keys(input.values ?? {});
  if (!keys.length || !keys.every(isSettingKey)) return fail(400, 'Pengaturan tidak dikenal.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) return fail(400, 'Pilih tanggal mulai berlaku.');
  const targetId = input.targetKind === 'ALL' ? null : input.targetId;
  const org = await getOrgLookup();
  const positionName = (id: number) => org.positions.find((p) => p.id === id)?.name;
  const branchName = (id: number) => org.branches.find((b) => b.id === id)?.name;
  const target = input.targetKind === 'POSITION' ? { positionId: targetId } : input.targetKind === 'BRANCH' ? { branchId: targetId } : {};
  const rows = await loadRows(db, keys as SettingKey[]);
  const lines: AnnounceLine[] = [];
  let affectsMoney = false;
  for (const key of keys as SettingKey[]) {
    const definition: SettingDefinition = SETTINGS[key];
    if (!can(actor, definition.viewAction)) return fail(403, 'Anda tidak berhak melihat pengaturan ini.');
    if (!definition.mustAnnounce) continue;
    const own = rows.filter((r) => r.key === key);
    const current = resolveSetting(own, input.effectiveFrom, target);
    if (current && sameValue(current.value, input.values[key])) continue;
    affectsMoney ||= definition.affectsMoney;
    lines.push({
      label: definition.label,
      before: current ? formatSettingValue(key, current.value, positionName, branchName) : 'belum ada',
      after: formatSettingValue(key, input.values[key], positionName, branchName),
    });
  }
  const targetText = input.targetKind === 'POSITION' ? ` — jabatan ${positionName(targetId as number) ?? ''}`
    : input.targetKind === 'BRANCH' ? ` — cabang ${branchName(targetId as number) ?? ''}` : '';
  const title = (lines.length === 1 ? lines[0].label : input.title ?? 'Perubahan pengaturan') + targetText;
  return {
    ok: true,
    data: {
      required: lines.length > 0, title, lines, effectiveFrom: input.effectiveFrom, affectsMoney, changeKind: null,
      target: suggestedTarget(input.targetKind, targetId),
    },
  };
}
