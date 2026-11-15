/**
 * Aturan Papan Perubahan Aturan tanpa DB (spec F3-3 §3.2, PRD Fase 3 `03-papan-perubahan-aturan.md`).
 * Dua tanggal wajib: jadwal terbit dan tanggal berlaku, dengan jarak paling sedikit dari pengaturan.
 */
import { EMERGENCY_TITLE_MAX, letterCount, type EmergencyTarget, type IsoDate } from './emergency';

export const RULE_TITLE_MAX = EMERGENCY_TITLE_MAX;
export const RULE_TEXT_MAX = 500;
export const RULE_ASK_MAX = 120;

export type RuleChangeKind = 'UNFAVORABLE' | 'FAVORABLE';

export const CHANGE_KIND_LABELS: Record<RuleChangeKind, string> = {
  UNFAVORABLE: 'Merugikan atau mengubah cara hitung',
  FAVORABLE: 'Murni menguntungkan karyawan',
};

export type RuleGaps = { unfavorable: number; favorable: number };

export type RuleInput = {
  title: string; beforeText: string; afterText: string; askWhom: string;
  changeKind: RuleChangeKind; affectsMoney: boolean; target: EmergencyTarget;
  /** null = terbit sekarang. */
  publishesAt: Date | null;
  effectiveOn: IsoDate | null;
};

export type ValidRule = Omit<RuleInput, 'publishesAt' | 'effectiveOn'> & { publishesAt: Date; effectiveOn: IsoDate };

/** Status pengumuman aturan, dihitung (tidak disimpan). */
export type RuleStatus = 'SCHEDULED' | 'PUBLISHED' | 'EFFECTIVE' | 'CORRECTED' | 'SUPERSEDED' | 'WITHDRAWN';

export const RULE_STATUS_LABELS: Record<RuleStatus, string> = {
  SCHEDULED: 'Terjadwal',
  PUBLISHED: 'Terbit, akan berlaku',
  EFFECTIVE: 'Berlaku',
  CORRECTED: 'Diralat',
  SUPERSEDED: 'Digantikan',
  WITHDRAWN: 'Ditarik',
};

export type DraftStatus = 'DRAFT' | 'SUBMITTED' | 'PUBLISHED' | 'REJECTED' | 'DISCARDED';

/** Tanggal WIB (YYYY-MM-DD) dari satu waktu. */
export function dateWib(at: Date): IsoDate {
  return new Date(at.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Jarak hari untuk jenis perubahan ini; paling sedikit 1 supaya tidak pernah berlaku di hari terbit. */
export function gapFor(kind: RuleChangeKind, gaps: RuleGaps): number {
  return Math.max(1, kind === 'FAVORABLE' ? gaps.favorable : gaps.unfavorable);
}

/** Tanggal berlaku paling cepat bila terbit pada waktu `publishesAt`. */
export function earliestEffective(publishesAt: Date, kind: RuleChangeKind, gaps: RuleGaps): IsoDate {
  return addDays(dateWib(publishesAt), gapFor(kind, gaps));
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function normalizeTarget(target: EmergencyTarget): EmergencyTarget {
  if (target.all) return { all: true };
  const unique = (ids: number[]) => [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
  return { all: false, branchIds: unique(target.branchIds), positionIds: unique(target.positionIds) };
}

const clean = (text: string) => text.trim();

/**
 * Periksa isian sebelum terbit/jadwal/kirim persetujuan. `now` = waktu tombol ditekan. Jadwal terbit tidak boleh
 * lampau; tanggal berlaku ≥ tanggal terbit (WIB) + jarak.
 */
export function validateRule(input: RuleInput, gaps: RuleGaps, now: Date): { ok: true; value: ValidRule } | { ok: false; error: string } {
  const title = clean(input.title);
  const beforeText = clean(input.beforeText);
  const afterText = clean(input.afterText);
  const askWhom = clean(input.askWhom);
  if (!title) return { ok: false, error: 'Judul wajib diisi.' };
  if (letterCount(title) > RULE_TITLE_MAX) return { ok: false, error: `Judul paling banyak ${RULE_TITLE_MAX} huruf.` };
  if (!beforeText) return { ok: false, error: '"Sebelumnya" wajib diisi.' };
  if (!afterText) return { ok: false, error: '"Sekarang" wajib diisi.' };
  if (letterCount(beforeText) > RULE_TEXT_MAX || letterCount(afterText) > RULE_TEXT_MAX) {
    return { ok: false, error: `"Sebelumnya" dan "Sekarang" masing-masing paling banyak ${RULE_TEXT_MAX} huruf.` };
  }
  if (!askWhom) return { ok: false, error: '"Kalau ada pertanyaan, tanya ke" wajib diisi.' };
  if (letterCount(askWhom) > RULE_ASK_MAX) return { ok: false, error: `"Tanya ke" paling banyak ${RULE_ASK_MAX} huruf.` };
  if (input.changeKind !== 'UNFAVORABLE' && input.changeKind !== 'FAVORABLE') return { ok: false, error: 'Pilih jenis perubahan.' };
  const target = normalizeTarget(input.target);
  if (!target.all && !target.branchIds.length && !target.positionIds.length) {
    return { ok: false, error: 'Pilih Semua orang, atau minimal satu cabang atau jabatan.' };
  }
  const publishesAt = input.publishesAt ?? now;
  // Toleransi satu menit untuk jadwal yang dipilih tepat "sekarang".
  if (publishesAt.getTime() < now.getTime() - 60_000) return { ok: false, error: 'Jadwal terbit tidak boleh lewat dari sekarang.' };
  if (!input.effectiveOn || !isIsoDate(input.effectiveOn)) return { ok: false, error: 'Tanggal berlaku wajib diisi.' };
  const earliest = earliestEffective(publishesAt, input.changeKind, gaps);
  if (input.effectiveOn < earliest) {
    const days = gapFor(input.changeKind, gaps);
    return {
      ok: false,
      error: `Perubahan ${input.changeKind === 'FAVORABLE' ? 'yang menguntungkan' : 'yang merugikan atau mengubah cara hitung'} paling cepat berlaku ${days} hari sesudah terbit (${earliest}).`,
    };
  }
  return {
    ok: true,
    value: { title, beforeText, afterText, askWhom, changeKind: input.changeKind, affectsMoney: input.affectsMoney, target, publishesAt, effectiveOn: input.effectiveOn },
  };
}

/**
 * Pengumuman uang yang baru disetujui sesudah jadwal terbitnya lewat (v3 kejadian 19): terbit saat disetujui,
 * dan tanggal berlaku bergeser bila jaraknya tidak lagi cukup.
 */
export function approvalSchedule(planned: { publishesAt: Date | null; effectiveOn: IsoDate; changeKind: RuleChangeKind }, gaps: RuleGaps, now: Date)
  : { publishesAt: Date; effectiveOn: IsoDate; shifted: boolean } {
  const publishesAt = planned.publishesAt && planned.publishesAt.getTime() > now.getTime() ? planned.publishesAt : now;
  const earliest = earliestEffective(publishesAt, planned.changeKind, gaps);
  const effectiveOn = planned.effectiveOn < earliest ? earliest : planned.effectiveOn;
  return { publishesAt, effectiveOn, shifted: effectiveOn !== planned.effectiveOn };
}

/** Tulisan perlu persetujuan Pemilik/GM? Uang oleh selain Pemilik/GM (spec F3-3 §3.2, keputusan §9 butir 2). */
export function needsApproval(affectsMoney: boolean, fullAccess: boolean): boolean {
  return affectsMoney && !fullAccess;
}

export function ruleStatus(row: {
  showsFrom: Date; effectiveOn: IsoDate; endedAt: Date | null; corrected: boolean; superseded: boolean;
}, now: Date, today: IsoDate): RuleStatus {
  if (row.endedAt) return 'WITHDRAWN';
  if (row.corrected) return 'CORRECTED';
  if (row.superseded) return 'SUPERSEDED';
  if (row.showsFrom.getTime() > now.getTime()) return 'SCHEDULED';
  return row.effectiveOn <= today ? 'EFFECTIVE' : 'PUBLISHED';
}

/** Masih di tab Berlaku Papan (bukan Riwayat). */
export function isCurrent(status: RuleStatus): boolean {
  return status === 'PUBLISHED' || status === 'EFFECTIVE';
}

/** Tarik hanya sebelum tanggal berlaku (PRD §2). */
export function withdrawBlock(row: { effectiveOn: IsoDate; endedAt: Date | null; corrected: boolean }, today: IsoDate): string | null {
  if (row.endedAt) return 'Pengumuman ini sudah ditarik.';
  if (row.corrected) return 'Pengumuman ini sudah diralat; tarik yang terbaru.';
  if (row.effectiveOn <= today) return 'Aturan ini sudah berlaku dan tidak bisa ditarik. Buat perubahan aturan baru.';
  return null;
}
