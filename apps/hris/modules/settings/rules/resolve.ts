import { SETTINGS, type SettingDefinition, type SettingKey, type TargetKind } from './registry';

/** Tanggal kalender WIB (YYYY-MM-DD). */
export type IsoDate = string;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** "Hari ini" memakai jam server di WIB (PRI-01). */
export function todayWib(now: Date = new Date()): IsoDate {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export type SettingValue = number | string;

export type SettingRow = {
  id: number;
  key: string;
  targetKind: TargetKind;
  targetId: number | null;
  value: unknown;
  effectiveFrom: IsoDate;
  status: 'PROPOSED' | 'ACTIVE' | 'CANCELLED';
};

/** Sasaran yang dicari: jabatan dan/atau cabang orang itu pada tanggal hitungan. */
export type SettingTarget = { positionId?: number | null; branchId?: number | null };

function latestOn(rows: readonly SettingRow[], on: IsoDate, kind: TargetKind, id: number | null) {
  let best: SettingRow | null = null;
  for (const row of rows) {
    if (row.status !== 'ACTIVE' || row.targetKind !== kind || row.targetId !== id || row.effectiveFrom > on) continue;
    if (!best || row.effectiveFrom > best.effectiveFrom) best = row;
  }
  return best;
}

/**
 * Baris yang berlaku pada tanggal `on` (spec L2e §3.2): ACTIVE terakhir dengan tanggal ≤ `on`.
 * Sasaran jabatan dulu, lalu cabang, lalu ALL. Usulan dan yang dibatalkan tidak pernah dipakai.
 */
export function resolveSetting(rows: readonly SettingRow[], on: IsoDate, target: SettingTarget = {}): SettingRow | null {
  if (target.positionId != null) {
    const row = latestOn(rows, on, 'POSITION', target.positionId);
    if (row) return row;
  }
  if (target.branchId != null) {
    const row = latestOn(rows, on, 'BRANCH', target.branchId);
    if (row) return row;
  }
  return latestOn(rows, on, 'ALL', null);
}

/** Nilai yang akan berlaku sesudah `on` untuk sasaran persis itu (untuk "nilai berikutnya" di BER-L40). */
export function upcomingRows(rows: readonly SettingRow[], on: IsoDate, kind: TargetKind, id: number | null): SettingRow[] {
  return rows
    .filter((r) => r.status === 'ACTIVE' && r.targetKind === kind && r.targetId === id && r.effectiveFrom > on)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
}

/** Periksa bentuk nilai menurut daftar. Mengembalikan pesan galat, atau null bila sah. */
export function valueProblem(definition: SettingDefinition, value: unknown): string | null {
  const type = definition.type;
  if (type.kind === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) return 'Nilai harus bilangan bulat.';
    if (value < type.min || value > type.max) {
      return `Nilai harus antara ${type.min} dan ${type.max}${definition.unit ? ` ${definition.unit}` : ''}.`;
    }
    return null;
  }
  if (type.kind === 'position') return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? null : 'Jabatan tidak dikenal.';
  if (typeof value !== 'string' || !type.options.some((o) => o.value === value)) return 'Pilihan tidak dikenal.';
  return null;
}

export function formatSettingValue(key: SettingKey, value: unknown, positionName?: (id: number) => string | undefined): string {
  const definition: SettingDefinition = SETTINGS[key];
  if (definition.type.kind === 'position') return positionName?.(Number(value)) ?? `Jabatan #${String(value)}`;
  if (definition.type.kind === 'choice') {
    return definition.type.options.find((o) => o.value === value)?.label ?? String(value);
  }
  return `${String(value)}${definition.unit ? ` ${definition.unit}` : ''}`;
}

/**
 * Tanggal berlaku paling cepat (spec L2e §3.2, keputusan owner §8 butir 4): menyangkut uang/hitungan
 * paling cepat besok; lainnya boleh hari ini. Tidak pernah mundur.
 */
export function earliestEffectiveFrom(definition: SettingDefinition, today: IsoDate): IsoDate {
  return definition.affectsMoney ? addDays(today, 1) : today;
}

export function effectiveDateProblem(definition: SettingDefinition, date: unknown, today: IsoDate): string | null {
  if (!isIsoDate(date)) return 'Tanggal berlaku tidak valid.';
  const earliest = earliestEffectiveFrom(definition, today);
  if (date < earliest) {
    return definition.affectsMoney
      ? 'Pengaturan yang menyangkut uang atau hitungan paling cepat berlaku besok, tidak boleh mundur.'
      : 'Tanggal berlaku tidak boleh mundur.';
  }
  if (definition.startDay && Number(date.slice(8, 10)) !== definition.startDay) {
    return `Pengaturan ini hanya boleh berlaku mulai tanggal ${definition.startDay}.`;
  }
  return null;
}

/** Nilai (setelah dirapikan) sama dengan yang berlaku? JSON cukup untuk angka dan teks pilihan. */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
