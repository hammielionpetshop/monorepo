import { asc, inArray } from 'drizzle-orm';
import { settingValues } from '@petshop/hris-db/schema/settings';
import { db } from '@/lib/db';
import type { Tx } from '@/modules/access';
import { SETTINGS, type SettingKey } from '../rules/registry';
import { resolveSetting, todayWib, type IsoDate, type SettingRow, type SettingTarget } from '../rules/resolve';

type Executor = typeof db | Tx;

export async function loadRows(executor: Executor, keys: readonly SettingKey[]): Promise<SettingRow[]> {
  if (keys.length === 0) return [];
  const rows = await executor
    .select({
      id: settingValues.id, key: settingValues.key, targetKind: settingValues.targetKind, targetId: settingValues.targetId,
      value: settingValues.value, effectiveFrom: settingValues.effectiveFrom, status: settingValues.status,
    })
    .from(settingValues)
    .where(inArray(settingValues.key, [...keys]))
    .orderBy(asc(settingValues.effectiveFrom), asc(settingValues.id));
  return rows;
}

function missing(key: string): never {
  // Isi awal ditanam migrasi; tanpa baris = migrasi belum jalan atau kunci belum didaftarkan (H18).
  throw new Error(`Pengaturan ${key} belum punya isi awal.`);
}

/**
 * Satu-satunya jalan membaca angka aturan (PRD 03 §4). `on` = tanggal kejadian/hitungan, bukan hari ini,
 * supaya hitungan lama memberi hasil sama walau pengaturannya berubah (WAJ-07, W6).
 */
export async function settingOn<T = number | string>(
  key: SettingKey, on: IsoDate, target: SettingTarget = {}, executor: Executor = db,
): Promise<T> {
  const row = resolveSetting(await loadRows(executor, [key]), on, target);
  return (row ? row.value : missing(key)) as T;
}

/** Banyak kunci sekaligus dalam satu kueri (untuk mesin yang butuh banyak angka). */
export async function settingsOn(
  keys: readonly SettingKey[], on: IsoDate, target: SettingTarget = {}, executor: Executor = db,
): Promise<Record<SettingKey, number | string>> {
  const rows = await loadRows(executor, keys);
  const result = {} as Record<SettingKey, number | string>;
  for (const key of keys) {
    const row = resolveSetting(rows.filter((r) => r.key === key), on, target);
    result[key] = (row ? row.value : missing(key)) as number | string;
  }
  return result;
}

/** Riwayat ACTIVE satu kunci untuk sasaran ALL, urut tanggal: untuk aturan yang menimbang perubahan di tengah jalan. */
export async function settingVersions(key: SettingKey, executor: Executor = db): Promise<{ from: IsoDate; value: unknown }[]> {
  return (await loadRows(executor, [key]))
    .filter((r) => r.status === 'ACTIVE' && r.targetKind === 'ALL')
    .map((r) => ({ from: r.effectiveFrom, value: r.value }));
}

/** Angka untuk kerangka aplikasi (jeda tombol, lama tanda Baru) hari ini, dalam satu kueri. */
export async function shellSettingsToday(): Promise<{ today: IsoDate; holdSeconds: number; newBadgeDays: number }> {
  const today = todayWib();
  const values = await settingsOn(['shared.hold_seconds_consequential', 'shared.new_badge_days'], today);
  return { today, holdSeconds: Number(values['shared.hold_seconds_consequential']), newBadgeDays: Number(values['shared.new_badge_days']) };
}

export function definitionOf(key: SettingKey) {
  return SETTINGS[key];
}
