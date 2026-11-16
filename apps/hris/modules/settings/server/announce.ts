import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { settingValues } from '@petshop/hris-db/schema/settings';
import { can, recordAudit, type Actor, type Tx } from '@/modules/access';
import { SETTINGS, isSettingKey, type SettingDefinition, type TargetKind } from '../rules/registry';
import { todayWib, type IsoDate } from '../rules/resolve';

/**
 * Wajib umumkan (spec F3-3 §4). Modul settings dan logistics hanya menetapkan bentuk kaitannya; pengumumannya
 * ditulis modul announcements lewat `MustAnnounceHook` yang dirangkai di pintu API (announcements mengimpor
 * settings, jadi arah sebaliknya tidak boleh).
 */

export type AnnounceFail = { ok: false; status: 400 | 403 | 404 | 409; error: string };

/** Yang diumumkan: kunci pengaturan + sasarannya, atau pasangan tarif ritase (dasar "menggantikan pengumuman sebelumnya"). */
export type AnnounceSubject =
  | { kind: 'setting'; items: { key: string; targetKind: TargetKind; targetId: number | null }[] }
  | { kind: 'trip_rate'; vehicleId: number; routeId: number };

export type MustAnnounceInfo = {
  subject: AnnounceSubject;
  settingValueIds: number[];
  tripRateId: number | null;
  effectiveFrom: IsoDate;
  affectsMoney: boolean;
  /** Jenis perubahan ditetapkan sistem (tarif turun = merugikan); null = pilihan penulis. */
  changeKind: 'UNFAVORABLE' | 'FAVORABLE' | null;
};

export type MustAnnounceHook = (tx: Tx, actor: Actor, info: MustAnnounceInfo) => Promise<{ ok: true } | AnnounceFail>;

/** Pilihan penulis saat menyimpan pengaturan wajib umumkan: umumkan, atau tidak perlu diumumkan dengan alasan. */
export type AnnounceChoice = { announce: MustAnnounceHook } | { skipReason: string };

/** Pengumuman ditolak sesudah nilai ditulis: dilempar supaya transaksi batal seluruhnya. */
export class AnnounceAborted extends Error {
  constructor(readonly result: AnnounceFail) {
    super(result.error);
  }
}

export const MUST_ANNOUNCE_MISSING =
  'Perubahan ini wajib diumumkan di Papan Perubahan Aturan. Isi pengumumannya, atau pilih "Tidak perlu diumumkan" dengan alasan.';

/** Satu baris "sebelumnya → sekarang" untuk isi awal langkah Pengumuman. */
export type AnnounceLine = { label: string; before: string; after: string };

/** Isi awal langkah Pengumuman di layar (spec F3-3 §4.1). */
export type AnnouncePreview = {
  required: boolean;
  title: string;
  lines: AnnounceLine[];
  effectiveFrom: IsoDate;
  affectsMoney: boolean;
  changeKind: 'UNFAVORABLE' | 'FAVORABLE' | null;
  /** Sasaran usulan: ALL → semua; POSITION → jabatan itu; BRANCH → cabang itu. */
  target: { all: true } | { all: false; branchIds: number[]; positionIds: number[] };
};

export function suggestedTarget(targetKind: TargetKind, targetId: number | null): AnnouncePreview['target'] {
  if (targetKind === 'POSITION' && targetId) return { all: false, branchIds: [], positionIds: [targetId] };
  if (targetKind === 'BRANCH' && targetId) return { all: false, branchIds: [targetId], positionIds: [] };
  return { all: true };
}

/**
 * Akhiri (tarik) semua pengumuman aturan yang masih terkait nilai pengaturan atau tarif ritase ini. Ditulis
 * dengan SQL langsung ke `hris.announcements` (pemicu DB hanya mengizinkan mengisi `ended_*` sekali) supaya
 * modul settings/logistics tidak mengimpor modul announcements.
 */
export async function endLinkedAnnouncements(
  tx: Tx, actorAccountId: number, link: { settingValueIds?: number[]; tripRateId?: number }, reason: string,
): Promise<{ ids: number[]; settingValueIds: number[] }> {
  const where = link.tripRateId != null
    ? sql`a.trip_rate_id = ${link.tripRateId}`
    : sql`a.setting_value_ids && ${sql.raw(`ARRAY[${(link.settingValueIds ?? []).map(Number).join(',') || 'NULL'}]::integer[]`)}`;
  const rows = await tx.execute<{ id: number; setting_value_ids: number[] | null }>(sql`
    select a.id, a.setting_value_ids from hris.announcements a
    where a.kind = 'RULE' and a.ended_at is null and ${where} for update`);
  const ids = rows.map((r) => Number(r.id));
  for (const id of ids) {
    await tx.execute(sql`update hris.announcements set ended_at = now(), ended_by_account_id = ${actorAccountId}, end_reason = ${reason}
      where id = ${id} and ended_at is null`);
    await recordAudit(tx, { actorAccountId, entity: 'announcement', entityId: id, action: 'rule.withdraw', reason });
  }
  const linkedValues = [...new Set(rows.flatMap((r) => (r.setting_value_ids ?? []).map(Number)))];
  return { ids, settingValueIds: linkedValues };
}

/**
 * Batalkan nilai pengaturan yang belum berlaku karena pengumumannya ditarik, atau karena nilai lain yang
 * diumumkan bersamanya dibatalkan (spec F3-3 §4.1). Pelaku harus berhak mengubah tiap pengaturan itu.
 */
export async function cancelLinkedSettings(tx: Tx, actor: Actor, ids: number[], reason: string): Promise<{ ok: true; count: number } | AnnounceFail> {
  if (!ids.length) return { ok: true, count: 0 };
  const today = todayWib();
  const rows = await tx.select().from(settingValues).where(inArray(settingValues.id, ids)).for('update');
  for (const row of rows) {
    if (row.status !== 'ACTIVE') continue;
    if (!isSettingKey(row.key)) return { ok: false, status: 404, error: 'Nilai pengaturan tidak ditemukan.' };
    const definition: SettingDefinition = SETTINGS[row.key];
    if (!can(actor, definition.editAction)) {
      return { ok: false, status: 403, error: `Pengumuman ini terkait pengaturan ${definition.label}; hanya yang berhak mengubah pengaturan itu yang bisa menariknya.` };
    }
    if (row.effectiveFrom <= today) {
      return { ok: false, status: 409, error: `${definition.label} sudah berlaku dan tidak bisa dibatalkan; ganti dengan nilai baru bertanggal.` };
    }
  }
  let count = 0;
  for (const row of rows) {
    if (row.status !== 'ACTIVE') continue;
    const [done] = await tx.update(settingValues).set({
      status: 'CANCELLED', cancelledByAccountId: actor.accountId, cancelledAt: new Date(), cancelReason: reason,
    }).where(and(eq(settingValues.id, row.id), eq(settingValues.status, 'ACTIVE'), gt(settingValues.effectiveFrom, today)))
      .returning({ id: settingValues.id });
    if (!done) continue;
    count += 1;
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'setting', entityId: row.id, action: 'setting.cancel',
      before: { key: row.key, targetKind: row.targetKind, targetId: row.targetId, value: row.value, effectiveFrom: row.effectiveFrom, status: 'ACTIVE' },
      after: { status: 'CANCELLED', withAnnouncement: true },
      reason,
    });
  }
  return { ok: true, count };
}
