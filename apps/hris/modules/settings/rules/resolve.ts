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

/** Pengali: 0 s.d. 5, paling banyak 2 angka di belakang koma (spec L4b §3.1). */
export function multiplierProblem(value: unknown, label: string, max = 5, min = 0): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return `${label} harus angka.`;
  if (value < min || value > max) return `${label} harus antara ${min} dan ${max}.`;
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-9) return `${label} paling banyak 2 angka di belakang koma.`;
  return null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Tampilan pengali Indonesia: 1,25×. */
export const multiplierText = (value: number) => `${String(Math.round(value * 100) / 100).replace('.', ',')}×`;

/** Periksa bentuk nilai menurut daftar. Mengembalikan pesan galat, atau null bila sah. */
export function valueProblem(definition: SettingDefinition, value: unknown): string | null {
  const type = definition.type;
  if (type.kind === 'decimal') return multiplierProblem(value, 'Pengali', type.max, type.min);
  if (type.kind === 'escalation') {
    if (!isRecord(value)) return 'Isi hari ke-1, naik tiap hari, dan mentok di.';
    const problem = multiplierProblem(value.start, 'Hari ke-1') ?? multiplierProblem(value.step, 'Naik tiap hari') ?? multiplierProblem(value.max, 'Mentok di');
    if (problem) return problem;
    if ((value.start as number) > (value.max as number)) return 'Hari ke-1 tidak boleh lebih besar dari "mentok di".';
    return Object.keys(value).length === 3 ? null : 'Isi hari ke-1, naik tiap hari, dan mentok di.';
  }
  if (type.kind === 'sickLetter') {
    if (!isRecord(value)) return 'Isi pengali hari ke-1, hari ke-2 dan ke-3, dan hari ke-4 dst.';
    const problem = multiplierProblem(value.day1, 'Hari ke-1') ?? multiplierProblem(value.day2to3, 'Hari ke-2 dan ke-3') ?? multiplierProblem(value.day4plus, 'Hari ke-4 dst');
    if (problem) return problem;
    return Object.keys(value).length === 3 ? null : 'Isi pengali hari ke-1, hari ke-2 dan ke-3, dan hari ke-4 dst.';
  }
  if (type.kind === 'textList') {
    if (!Array.isArray(value) || !value.length || value.length > type.max) return `Isi 1 sampai ${type.max} pilihan.`;
    if (value.some((v) => typeof v !== 'string' || !v.trim() || v.trim().length > 30 || v !== v.trim())) return 'Tiap pilihan berisi 1 sampai 30 huruf.';
    if (new Set(value.map((v) => String(v).toLowerCase())).size !== value.length) return 'Ada pilihan yang sama.';
    return null;
  }
  if (type.kind === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) return 'Nilai harus bilangan bulat.';
    if (value < type.min || value > type.max) {
      return `Nilai harus antara ${type.min} dan ${type.max}${definition.unit ? ` ${definition.unit}` : ''}.`;
    }
    return null;
  }
  if (type.kind === 'position') return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? null : 'Jabatan tidak dikenal.';
  if (type.kind === 'branch') return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? null : 'Cabang tidak dikenal.';
  if (typeof value !== 'string' || !type.options.some((o) => o.value === value)) return 'Pilihan tidak dikenal.';
  return null;
}

export function formatSettingValue(
  key: SettingKey, value: unknown, positionName?: (id: number) => string | undefined, branchName?: (id: number) => string | undefined,
): string {
  const definition: SettingDefinition = SETTINGS[key];
  if (definition.type.kind === 'position') return positionName?.(Number(value)) ?? `Jabatan #${String(value)}`;
  if (definition.type.kind === 'branch') return branchName?.(Number(value)) ?? `Cabang #${String(value)}`;
  if (definition.type.kind === 'choice') {
    return definition.type.options.find((o) => o.value === value)?.label ?? String(value);
  }
  if (definition.type.kind === 'decimal') return typeof value === 'number' ? multiplierText(value) : String(value);
  if (definition.type.kind === 'escalation' && isRecord(value)) {
    const { start, step, max } = value as { start: number; step: number; max: number };
    return step > 0 && start < max ? `${multiplierText(start)}, naik ${multiplierText(step)} tiap hari, mentok ${multiplierText(max)}` : `${multiplierText(start)} tiap hari (tidak naik)`;
  }
  if (definition.type.kind === 'sickLetter' && isRecord(value)) {
    const { day1, day2to3, day4plus } = value as { day1: number; day2to3: number; day4plus: number };
    return `hari ke-1 ${multiplierText(day1)} · ke-2 & 3 ${multiplierText(day2to3)} · ke-4 dst ${multiplierText(day4plus)}`;
  }
  if (definition.type.kind === 'textList' && Array.isArray(value)) return value.join(', ');
  if (definition.unit === 'rupiah' && typeof value === 'number') return `Rp${value.toLocaleString('id-ID')}`;
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
