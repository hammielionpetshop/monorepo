import { addDays, type IsoDate } from './salary';

// Aturan murni denda driver & kenek (spec L7 §3.6, L7c; DRV-29, 30; S1 s.d. S3).

export type FineStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN' | 'CANCELLED' | 'WAIVED';

export const FINE_STATUS_LABELS: Record<FineStatus, string> = {
  PENDING: 'Menunggu pengesahan', ACTIVE: 'Berlaku', REJECTED: 'Ditolak', WITHDRAWN: 'Ditarik', CANCELLED: 'Dibatalkan', WAIVED: 'Ditiadakan',
};

/** Tab layar Denda Driver & Kenek. */
export type FineTab = 'PENDING' | 'ACTIVE' | 'DONE';
export const FINE_TAB_LABELS: Record<FineTab, string> = { PENDING: 'Menunggu', ACTIVE: 'Berlaku', DONE: 'Selesai' };

/** Uraian kejadian paling sedikit sekian huruf (spec L7 §3.6). */
export const MIN_DESCRIPTION = 15;
/** Jenis baru, naik, atau aktif lagi berlaku paling cepat 7 hari lagi; turun atau nonaktif 1 hari (spec L7 §3.6). */
export const RAISE_LEAD_DAYS = 7;
export const LOWER_LEAD_DAYS = 1;

/** Kalimat di layar Ajukan Denda (spec L7 §3.6): yang bukan denda. */
export const NOT_A_FINE_NOTE = 'Bukan denda: uang setoran atau kembalian kurang, dan barang rusak atau hilang. Itu dicatat sebagai Potongan Lain sebesar kerugiannya.';

export type KindVersion = { id: number; effectiveOn: IsoDate; amount: number; active: boolean; cancelled: boolean };

/** Versi jenis yang berlaku pada tanggal itu: tanggal berlaku terbaru ≤ tanggal, yang tidak dibatalkan. */
export function versionOn<T extends KindVersion>(versions: readonly T[], on: IsoDate): T | null {
  let found: T | null = null;
  for (const v of versions) {
    if (v.cancelled || v.effectiveOn > on) continue;
    if (!found || v.effectiveOn > found.effectiveOn || (v.effectiveOn === found.effectiveOn && v.id > found.id)) found = v;
  }
  return found;
}

/** Nominal denda jenis itu pada tanggal kejadian; null = jenis belum ada atau nonaktif pada tanggal itu. */
export function fineAmountOn(versions: readonly KindVersion[], on: IsoDate): number | null {
  const v = versionOn(versions, on);
  return v && v.active ? v.amount : null;
}

/**
 * Tanggal berlaku paling cepat untuk perubahan jenis: dibanding versi yang berlaku tepat sebelum tanggal itu.
 * Lebih berat bagi orang (jenis baru, naik, aktif lagi) = 7 hari; lebih ringan (turun, nonaktif) atau sama = 1 hari.
 */
export function earliestKindChange(before: { amount: number; active: boolean } | null, next: { amount: number; active: boolean }, today: IsoDate): IsoDate {
  const heavier = !before || (next.active && !before.active) || (next.active && next.amount > before.amount);
  return addDays(today, heavier ? RAISE_LEAD_DAYS : LOWER_LEAD_DAYS);
}

/** Masalah isian perubahan jenis (null = sah). */
export function kindChangeProblem(input: { amount: number; active: boolean; effectiveOn: IsoDate; reason: string }, earliest: IsoDate): string | null {
  if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > 10_000_000) return 'Nominal harus rupiah bulat lebih dari 0.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveOn)) return 'Tanggal berlaku tidak sah.';
  if (input.effectiveOn < earliest) return `Perubahan ini paling cepat berlaku ${earliest}.`;
  if (input.reason.trim().length < 15) return 'Alasan paling sedikit 15 huruf.';
  return null;
}

/** Tanggal kejadian sah: hari ini sampai `backdateDays` hari ke belakang (S3). */
export function occurredOnProblem(occurredOn: IsoDate, today: IsoDate, backdateDays: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) return 'Tanggal kejadian tidak sah.';
  if (occurredOn > today) return 'Tanggal kejadian tidak boleh sesudah hari ini.';
  if (occurredOn < addDays(today, -backdateDays)) return `Tanggal kejadian paling lama ${backdateDays} hari ke belakang.`;
  return null;
}

export type FineTarget = { id: number; weekly: boolean; onTrip: boolean; ownerOrGm: boolean };

/** Sasaran sah: orang Mingguan atau awak trip pada tanggal itu; bukan diri sendiri, Pemilik, atau GM (spec L7 §3.6). */
export function targetProblem(target: FineTarget | null, actorPersonId: number): string | null {
  if (!target) return 'Orang ini tidak aktif pada tanggal kejadian.';
  if (target.id === actorPersonId) return 'Denda untuk diri sendiri tidak bisa diajukan.';
  if (target.ownerOrGm) return 'Pemilik dan GM tidak dikenai denda.';
  if (!target.weekly && !target.onTrip) return 'Denda hanya untuk orang bergaji Mingguan atau awak trip pada tanggal kejadian.';
  return null;
}

/** Tab tiap status: Menunggu = usulan; Berlaku = sah (terpotong atau belum); sisanya Selesai. */
export function tabOf(status: FineStatus): FineTab {
  if (status === 'PENDING') return 'PENDING';
  if (status === 'ACTIVE') return 'ACTIVE';
  return 'DONE';
}

/** Batalkan (belum terpotong) atau Tiadakan (sudah terpotong di slip yang ditutup). */
export function endKind(slipped: boolean): 'CANCELLED' | 'WAIVED' {
  return slipped ? 'WAIVED' : 'CANCELLED';
}
