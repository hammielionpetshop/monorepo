import { eq, sql } from 'drizzle-orm';
import { settingValues } from '@petshop/hris-db/schema/settings';
import { db } from '@/lib/db';
import { can, getOrgLookup, recordAudit, type Actor, type ServiceResult } from '@/modules/access';
import { SETTINGS, isSettingKey, type SettingDefinition, type SettingKey, type TargetKind } from '../rules/registry';
import {
  effectiveDateProblem, resolveSetting, sameValue, todayWib, valueProblem, type IsoDate,
} from '../rules/resolve';
import { loadRows, settingOn } from './read';

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

export type SetSettingInput = {
  key: string;
  targetKind: TargetKind;
  targetId: number | null;
  value: unknown;
  effectiveFrom: string;
  reason: string;
  /** Id baris terakhir sasaran ini yang dilihat layar; null bila belum ada baris. */
  expectedLatestId: number | null;
};

/**
 * Ubah satu pengaturan (BER-L41). Pemilik/GM: langsung berlaku (KAR-73). Usulan HR menyusul di L2f, jadi
 * di sini hanya pemegang `editAction` yang bisa menyimpan.
 */
export async function setSetting(actor: Actor | null, input: SetSettingInput): Promise<ServiceResult<{ id: number }>> {
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
  const today = todayWib();
  const dateProblem = effectiveDateProblem(definition, input.effectiveFrom, today);
  if (dateProblem) return fail(400, dateProblem);
  const effectiveFrom: IsoDate = input.effectiveFrom;
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`setting:${key}:${input.targetKind}:${targetId ?? 0}`}))`);
      const rows = await loadRows(tx, [key]);
      const own = rows.filter((r) => r.targetKind === input.targetKind && r.targetId === targetId);
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
        after: { key, targetKind: input.targetKind, targetId, value: input.value, effectiveFrom },
        reason: reason.reason,
      });
      return { ok: true as const, data: { id: row.id } };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fail(409, 'Sudah ada nilai yang berlaku di tanggal itu.');
    throw error;
  }
}

/** Batalkan nilai yang belum berlaku (BER-L41 jalan keluar). Yang sudah berlaku hanya diganti nilai baru. */
export async function cancelSetting(actor: Actor | null, id: number, reasonInput: string): Promise<ServiceResult<object>> {
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
    return { ok: true as const, data: {} };
  });
}
