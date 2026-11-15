import { addDays, type IsoDate } from './dates';

// Aturan riwayat penempatan dan status (KAR-07, 22, 55, 56). Murni; dipakai server dan tes.
// View DB hris.current_placements memakai aturan yang sama untuk "hari ini".

export const WORK_STATUSES = ['TRAINING', 'EMPLOYEE'] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];
export const WORK_STATUS_LABELS: Record<WorkStatus, string> = { TRAINING: 'Training', EMPLOYEE: 'Karyawan' };

export const CHANGE_KINDS = ['BRANCH', 'POSITION', 'WORK_STATUS'] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];
export type PlacementKind = 'INITIAL' | ChangeKind;
export const PLACEMENT_KIND_LABELS: Record<PlacementKind, string> = {
  INITIAL: 'Penempatan awal', BRANCH: 'Pindah cabang', POSITION: 'Ganti jabatan', WORK_STATUS: 'Ganti status kerja',
};

export type PlacementRecord = {
  id: number;
  kind: PlacementKind;
  branchId: number;
  positionId: number;
  workStatus: WorkStatus;
  effectiveFrom: IsoDate;
  cancelledAt: Date | string | null;
};

export type PlacementValues = Pick<PlacementRecord, 'branchId' | 'positionId' | 'workStatus'>;

function newestFirst(a: PlacementRecord, b: PlacementRecord): number {
  return a.effectiveFrom === b.effectiveFrom ? b.id - a.id : a.effectiveFrom < b.effectiveFrom ? 1 : -1;
}

/** Penempatan pada tanggal itu: catatan tak dibatalkan terbaru yang sudah berlaku (sama tanggal → id terbesar). */
export function placementOn<T extends PlacementRecord>(records: readonly T[], date: IsoDate): T | null {
  return [...records].filter((r) => !r.cancelledAt && r.effectiveFrom <= date).sort(newestFirst)[0] ?? null;
}

const FIELD_BY_KIND: Record<ChangeKind, keyof PlacementValues> = {
  BRANCH: 'branchId', POSITION: 'positionId', WORK_STATUS: 'workStatus',
};

export type ChangeCheck =
  | { ok: true; values: PlacementValues; base: PlacementRecord }
  | { ok: false; error: string };

/**
 * Catatan perubahan baru berisi penempatan lengkap = penempatan pada tanggal berlaku + satu kolom yang
 * diganti. Catatan sesudah tanggal itu menyimpan penempatan lengkapnya sendiri, jadi harus sudah memuat
 * nilai yang sama; kalau tidak, nilai lama akan "kembali" di tanggalnya.
 */
export function checkPlacementChange(input: {
  records: readonly PlacementRecord[];
  kind: ChangeKind;
  effectiveFrom: IsoDate;
  value: number | WorkStatus;
  viaPromotion?: boolean;
}): ChangeCheck {
  const base = placementOn(input.records, input.effectiveFrom);
  if (!base) return { ok: false, error: 'Tanggal berlaku tidak boleh sebelum penempatan awal (tanggal bergabung).' };
  const field = FIELD_BY_KIND[input.kind];
  if (base[field] === input.value) return { ok: false, error: 'Nilai baru sama dengan penempatan pada tanggal itu.' };
  if (input.kind === 'WORK_STATUS' && base.workStatus === 'TRAINING' && input.value === 'EMPLOYEE' && !input.viaPromotion) {
    return { ok: false, error: 'Training menjadi Karyawan diputuskan lewat Promosi Training.' };
  }
  const later = input.records.filter((r) => !r.cancelledAt && r.effectiveFrom > input.effectiveFrom);
  if (later.some((r) => r[field] !== input.value)) {
    return {
      ok: false,
      error: 'Ada catatan penempatan sesudah tanggal itu dengan nilai lain. Batalkan catatan itu bila belum berlaku, atau catat perubahan sesudahnya.',
    };
  }
  return { ok: true, base, values: { branchId: base.branchId, positionId: base.positionId, workStatus: base.workStatus, [field]: input.value } };
}

/** Catatan boleh dibatalkan hanya bila bukan penempatan awal dan belum berlaku (KAR-56). */
export function canCancelPlacement(record: PlacementRecord, today: IsoDate): boolean {
  return record.kind !== 'INITIAL' && !record.cancelledAt && record.effectiveFrom > today;
}

export type EmploymentEventRecord = { id: number; kind: 'DEACTIVATE' | 'REACTIVATE'; effectiveOn: IsoDate };

function latest(events: readonly EmploymentEventRecord[], date?: IsoDate): EmploymentEventRecord | null {
  return [...events]
    .filter((e) => date == null || e.effectiveOn <= date)
    .sort((a, b) => (a.effectiveOn === b.effectiveOn ? b.id - a.id : a.effectiveOn < b.effectiveOn ? 1 : -1))[0] ?? null;
}

/** Aktif pada tanggal itu: kejadian terakhir yang sudah berlaku bukan nonaktif. Tanpa kejadian = aktif. */
export function activeOn(events: readonly EmploymentEventRecord[], date: IsoDate): boolean {
  return latest(events, date)?.kind !== 'DEACTIVATE';
}

/** Kejadian terakhir yang tercatat (termasuk bertanggal depan): menentukan tombol berikutnya. */
export function lastEvent(events: readonly EmploymentEventRecord[]): EmploymentEventRecord | null {
  return latest(events);
}

/** Nonaktif berlaku sehari sesudah tanggal terakhir bekerja. */
export function deactivationEffectiveOn(lastWorkingDay: IsoDate): IsoDate {
  return addDays(lastWorkingDay, 1);
}

export function checkEmploymentEvent(input: {
  events: readonly EmploymentEventRecord[];
  kind: 'DEACTIVATE' | 'REACTIVATE';
  effectiveOn: IsoDate;
  joinedOn: IsoDate;
}): { ok: true } | { ok: false; error: string } {
  const last = lastEvent(input.events);
  if (input.kind === 'DEACTIVATE') {
    if (last?.kind === 'DEACTIVATE') return { ok: false, error: 'Orang ini sudah dicatat nonaktif.' };
    if (input.effectiveOn <= input.joinedOn) return { ok: false, error: 'Tanggal terakhir bekerja tidak boleh sebelum tanggal bergabung.' };
    if (last && input.effectiveOn <= last.effectiveOn) {
      return { ok: false, error: 'Tanggal terakhir bekerja harus sesudah tanggal aktif kembali yang terakhir.' };
    }
    return { ok: true };
  }
  if (last?.kind !== 'DEACTIVATE') return { ok: false, error: 'Orang ini tidak sedang nonaktif.' };
  if (input.effectiveOn < last.effectiveOn) {
    return { ok: false, error: 'Tanggal mulai aktif lagi tidak boleh sebelum tanggal nonaktifnya.' };
  }
  return { ok: true };
}
