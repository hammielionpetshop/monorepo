import { inArray, sql } from 'drizzle-orm';
import { settingValues } from '@petshop/hris-db/schema/settings';
import { db } from '@/lib/db';
import { can, listPositionsWithHolders, type Actor } from '@/modules/access';
import {
  MODULE_LABELS, POSITION_SETTING_KEYS, SETTINGS, SETTING_KEYS, type SettingDefinition, type SettingKey, type TargetKind,
} from '../rules/registry';
import { earliestEffectiveFrom, formatSettingValue, resolveSetting, todayWib, upcomingRows, type IsoDate } from '../rules/resolve';

export type SettingHistoryEntry = {
  id: number;
  value: string;
  effectiveFrom: IsoDate;
  until: IsoDate | null;
  status: 'PROPOSED' | 'ACTIVE' | 'CANCELLED';
  reason: string;
  by: string;
  cancelReason: string | null;
  cancelledBy: string | null;
  cancellable: boolean;
};

export type SettingCell = {
  key: SettingKey;
  targetKind: TargetKind;
  targetId: number | null;
  rawValue: unknown;
  value: string;
  since: IsoDate | null;
  /** true bila nilai datang dari "semua jabatan" (jabatan ini belum punya nilai sendiri). */
  inherited: boolean;
  upcoming: { id: number; value: string; effectiveFrom: IsoDate }[];
  latestId: number | null;
  history: SettingHistoryEntry[];
};

export type SettingMeta = {
  key: SettingKey;
  label: string;
  module: string;
  moduleLabel: string;
  explain: string;
  unit: string | null;
  type: SettingDefinition['type'];
  affectsMoney: boolean;
  mustAnnounce: boolean;
  earliest: IsoDate;
  canEdit: boolean;
};

function meta(actor: Actor | null, key: SettingKey, today: IsoDate): SettingMeta {
  const d: SettingDefinition = SETTINGS[key];
  return {
    key, label: d.label, module: d.module, moduleLabel: MODULE_LABELS[d.module] ?? d.module, explain: d.explain,
    unit: d.unit ?? null, type: d.type, affectsMoney: d.affectsMoney, mustAnnounce: d.mustAnnounce,
    earliest: earliestEffectiveFrom(d, today), canEdit: can(actor, d.editAction),
  };
}

function canView(actor: Actor | null, key: SettingKey): boolean {
  const d: SettingDefinition = SETTINGS[key];
  return can(actor, d.viewAction) || can(actor, d.editAction);
}

type FullRow = typeof settingValues.$inferSelect;

/** Nama orang di balik akun pusat, lewat tautan HRIS (akun tanpa karyawan = "akun #id"). */
async function accountNames(ids: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db.execute<{ account_id: number; name: string }>(sql`
    select l.account_id, e.name from auth.account_links l join hris.employees e on e.id = l.local_user_id
    where l.app_code = 'hris' and l.account_id in ${sql.raw(`(${unique.map(Number).join(',')})`)}`);
  return new Map(rows.map((r) => [Number(r.account_id), r.name]));
}

function cellOf(key: SettingKey, rows: FullRow[], names: Map<number, string>, today: IsoDate, kind: TargetKind, id: number | null): SettingCell {
  const own = rows.filter((r) => r.targetKind === kind && r.targetId === id);
  const target = kind === 'POSITION' ? { positionId: id } : kind === 'BRANCH' ? { branchId: id } : {};
  const current = resolveSetting(rows, today, target);
  const active = own.filter((r) => r.status === 'ACTIVE').sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
  const who = (accountId: number | null) => (accountId == null ? 'Sistem' : names.get(accountId) ?? `Akun #${accountId}`);
  const history: SettingHistoryEntry[] = [...own]
    .sort((a, b) => (a.effectiveFrom === b.effectiveFrom ? b.id - a.id : a.effectiveFrom < b.effectiveFrom ? 1 : -1))
    .map((r) => {
      const next = r.status === 'ACTIVE' ? active.find((a) => a.effectiveFrom > r.effectiveFrom) : undefined;
      return {
        id: r.id, value: formatSettingValue(key, r.value), effectiveFrom: r.effectiveFrom, until: next?.effectiveFrom ?? null,
        status: r.status, reason: r.reason, by: who(r.createdByAccountId), cancelReason: r.cancelReason,
        cancelledBy: r.cancelledByAccountId == null ? null : who(r.cancelledByAccountId),
        cancellable: r.status === 'ACTIVE' && r.effectiveFrom > today,
      };
    });
  return {
    key, targetKind: kind, targetId: id,
    rawValue: current?.value ?? null,
    value: current ? formatSettingValue(key, current.value) : '—',
    since: current?.effectiveFrom ?? null,
    inherited: kind !== 'ALL' && current?.targetKind === 'ALL',
    upcoming: upcomingRows(own, today, kind, id).map((r) => ({ id: r.id, value: formatSettingValue(key, r.value), effectiveFrom: r.effectiveFrom })),
    latestId: own.reduce<number | null>((max, r) => (max === null || r.id > max ? r.id : max), null),
    history,
  };
}

async function loadFull(keys: SettingKey[]) {
  if (keys.length === 0) return { rows: [] as FullRow[], names: new Map<number, string>() };
  const rows = await db.select().from(settingValues).where(inArray(settingValues.key, keys));
  const names = await accountNames(rows.flatMap((r) => [r.createdByAccountId, r.cancelledByAccountId]).filter((v): v is number => v != null));
  return { rows, names };
}

async function activeEmployeeCount(): Promise<number> {
  const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from hris.current_placements where active`);
  return Number(row?.n ?? 0);
}

export type SettingsScreenData = {
  today: IsoDate;
  activeEmployees: number;
  items: { meta: SettingMeta; cell: SettingCell }[];
};

/** BER-L40: pengaturan umum (sasaran ALL) yang boleh dilihat pelaku, dikelompokkan per modul di layar. */
export async function getSettingsScreen(actor: Actor | null): Promise<SettingsScreenData> {
  const today = todayWib();
  const keys = SETTING_KEYS.filter((k) => !POSITION_SETTING_KEYS.includes(k) && canView(actor, k));
  const { rows, names } = await loadFull(keys);
  return {
    today,
    activeEmployees: await activeEmployeeCount(),
    items: keys.map((key) => ({ meta: meta(actor, key, today), cell: cellOf(key, rows.filter((r) => r.key === key), names, today, 'ALL', null) })),
  };
}

export type PositionSettingsScreenData = {
  today: IsoDate;
  settings: SettingMeta[];
  positions: { id: number; name: string; holders: number; cells: Record<string, SettingCell> }[];
  defaults: Record<string, SettingCell>;
};

/** KAR-L31: baris = jabatan aktif, kolom = tanda; tiap sel punya nilai, riwayat, dan nilai berikutnya. */
export async function getPositionSettingsScreen(actor: Actor | null): Promise<PositionSettingsScreenData | null> {
  const keys = POSITION_SETTING_KEYS.filter((k) => canView(actor, k));
  if (keys.length === 0) return null;
  const today = todayWib();
  const [{ rows, names }, positions] = await Promise.all([loadFull(keys), listPositionsWithHolders()]);
  const byKey = (key: SettingKey) => rows.filter((r) => r.key === key);
  return {
    today,
    settings: keys.map((k) => meta(actor, k, today)),
    defaults: Object.fromEntries(keys.map((k) => [k, cellOf(k, byKey(k), names, today, 'ALL', null)])),
    positions: positions.filter((p) => p.active).map((p) => ({
      id: p.id, name: p.name, holders: p.holders,
      cells: Object.fromEntries(keys.map((k) => [k, cellOf(k, byKey(k), names, today, 'POSITION', p.id)])),
    })),
  };
}
