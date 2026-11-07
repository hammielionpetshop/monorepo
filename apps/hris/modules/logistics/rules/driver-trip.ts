// Alur trip di HP driver (spec LT1 §13.3, LT1b-2a). Aturan murni: tahap trip, alasan baku kunjungan, syarat Menuju
// Garasi, isi Laporan Pulang trip, dan batas buka lagi surat jalan batal. Tanpa DB, tanpa React.
import { REASON_MIN, addDays, type IsoDate, type TripStatus } from './trip';

/**
 * Tahap trip di layar. Database tetap DRAFT/RUNNING/DONE/CANCELLED; Siap Kirim dan Menuju Garasi adalah tanda di atasnya
 * supaya absen lewat trip, ritase, dan denda yang membaca RUNNING tidak berubah (§13.3).
 */
export type TripPhase = 'DRAFT' | 'READY' | 'RUNNING' | 'HEADING_HOME' | 'DONE' | 'CANCELLED';

export const PHASE_LABELS: Record<TripPhase, string> = {
  DRAFT: 'Draft', READY: 'Siap Kirim', RUNNING: 'Berjalan', HEADING_HOME: 'Menuju Garasi', DONE: 'Selesai', CANCELLED: 'Dibatalkan',
};
export const PHASE_TONES: Record<TripPhase, 'info' | 'ok' | 'warn' | 'danger'> = {
  DRAFT: 'info', READY: 'info', RUNNING: 'warn', HEADING_HOME: 'warn', DONE: 'ok', CANCELLED: 'danger',
};

export function tripPhase(status: TripStatus, readyAt: Date | string | null, headingHomeAt: Date | string | null): TripPhase {
  if (status === 'DRAFT') return readyAt ? 'READY' : 'DRAFT';
  if (status === 'RUNNING') return headingHomeAt ? 'HEADING_HOME' : 'RUNNING';
  return status;
}

export type VisitOutcome = 'TOMORROW' | 'FAILED';
export const OTHER = 'OTHER';

/** Alasan baku (owner 2026-11-04, §13.3 butir 2). Lainnya wajib keterangan. */
export const VISIT_REASONS: Record<VisitOutcome, { code: string; label: string }[]> = {
  TOMORROW: [
    { code: 'CLOSED', label: 'Toko tutup' }, { code: 'NOBODY', label: 'Tidak ada orang' },
    { code: 'OUT_OF_TIME', label: 'Waktu habis' }, { code: OTHER, label: 'Lainnya' },
  ],
  FAILED: [
    { code: 'REFUSED', label: 'Ditolak toko' }, { code: 'ORDER_CANCELLED', label: 'Batal pesan' },
    { code: 'ADDRESS_NOT_FOUND', label: 'Alamat tidak ketemu' }, { code: OTHER, label: 'Lainnya' },
  ],
};

export function reasonLabel(outcome: VisitOutcome, code: string | null): string | null {
  return VISIT_REASONS[outcome].find((r) => r.code === code)?.label ?? null;
}

/** Alasan kunjungan: kode baku + keterangan (wajib untuk Lainnya). Mengembalikan teks tersimpan atau pesan salah. */
export function visitReason(outcome: VisitOutcome, code: string, note: string | null | undefined):
  { ok: true; code: string; text: string } | { ok: false; error: string } {
  const label = reasonLabel(outcome, code);
  if (!label) return { ok: false, error: 'Pilih alasan.' };
  const extra = (note ?? '').replace(/\s+/g, ' ').trim();
  if (extra.length > 300) return { ok: false, error: 'Keterangan paling panjang 300 huruf.' };
  if (code === OTHER && extra.length < REASON_MIN) return { ok: false, error: `Tulis keterangannya, paling sedikit ${REASON_MIN} huruf.` };
  return { ok: true, code, text: extra ? (code === OTHER ? extra : `${label}: ${extra}`) : label };
}

/**
 * Menuju Garasi (§13.3 butir 3, 4): foto bak kosong hanya bila semua kunjungan, ambil barang, dan belanja beres.
 * Selesai lebih awal melewatinya dengan alasan. Mengembalikan pesan berisi yang tersisa, atau null.
 */
export function headHomeProblem(left: { visits: number; pickups: string[]; shopping: string[]; returns?: string[] }): string | null {
  const parts = [
    left.visits ? `${left.visits} kunjungan` : null,
    ...left.pickups.map((p) => `ambil barang di ${p}`),
    ...(left.returns ?? []).map((r) => `jemput retur di ${r}`),
    ...left.shopping.map((s) => `belanja ${s}`),
  ].filter((p): p is string => !!p);
  if (!parts.length) return null;
  return `Masih ada ${parts.join(', ')}. Selesaikan dulu, atau tekan Selesai lebih awal bila memang harus pulang.`;
}

/** Terkirim ditahan (§3.5, §13.3 butir 2): barang cabang asal belum diambil, atau ada nota yang dibatalkan di kasir. */
export function deliverProblem(input: { waitsForPickup: string[]; cancelledNumbers: string[] }): string | null {
  if (input.waitsForPickup.length) return `Barang dari ${input.waitsForPickup.join(', ')} belum diambil. Tandai Ambil barang dulu.`;
  if (input.cancelledNumbers.length) {
    return `${input.cancelledNumbers.join(', ')} dibatalkan di kasir. Minta Kepala Gudang melepas kunjungan ini, lalu proses ulang.`;
  }
  return null;
}

export type Condition = 'GOOD' | 'ATTENTION';
export const CONDITION_LABELS: Record<Condition, string> = { GOOD: 'Baik', ATTENTION: 'Perlu perhatian' };
export const FUEL_STEP = 1_000;
export const FUEL_MAX = 5_000_000;

export type EndReportInput = { condition: string; conditionNote?: string | null; needsFuel: boolean; fuelEstimate?: number | null; problemNote?: string | null };
export type EndReportClean = { condition: Condition; conditionNote: string | null; needsFuel: boolean; fuelEstimate: number | null; problemNote: string | null };

const tidy = (value: string | null | undefined) => (value ?? '').replace(/\r\n/g, '\n').trim();

/** Isi Laporan Pulang trip (§13.3 butir 5): keadaan mobil, bensin, masalah (boleh kosong). */
export function cleanEndReport(input: EndReportInput): { ok: true; value: EndReportClean } | { ok: false; error: string } {
  if (input.condition !== 'GOOD' && input.condition !== 'ATTENTION') return { ok: false, error: 'Pilih keadaan mobil.' };
  const note = tidy(input.conditionNote);
  if (input.condition === 'ATTENTION' && note.length < REASON_MIN) return { ok: false, error: `Tulis masalah mobilnya, paling sedikit ${REASON_MIN} huruf.` };
  if (note.length > 500) return { ok: false, error: 'Masalah mobil paling panjang 500 huruf.' };
  let fuel: number | null = null;
  if (input.needsFuel) {
    const n = Number(input.fuelEstimate);
    if (!Number.isInteger(n) || n < FUEL_STEP) return { ok: false, error: 'Isi perkiraan uang bensin.' };
    if (n % FUEL_STEP) return { ok: false, error: 'Perkiraan bensin dalam kelipatan Rp 1.000.' };
    if (n > FUEL_MAX) return { ok: false, error: 'Perkiraan bensin terlalu besar.' };
    fuel = n;
  }
  const problem = tidy(input.problemNote);
  if (problem.length > 1000) return { ok: false, error: 'Masalah paling panjang 1000 huruf.' };
  return {
    ok: true,
    value: {
      condition: input.condition, conditionNote: input.condition === 'ATTENTION' ? note : null,
      needsFuel: input.needsFuel, fuelEstimate: fuel, problemNote: problem || null,
    },
  };
}

/** Laporan Pulang masih ditunggu bila trip Selesai bertanggal hari ini atau kemarin (§13.3 butir 5). */
export function endReportDue(tripDate: IsoDate | null, today: IsoDate): boolean {
  return !!tripDate && tripDate >= addDays(today, -1) && tripDate <= today;
}

/** Batal logistik dibuka lagi Pemilik/GM paling lama `days` hari sesudah dibatalkan (§3.9). */
export function reopenOpen(cancelledAt: Date, now: Date, days: number): boolean {
  return now.getTime() - cancelledAt.getTime() <= days * 86_400_000;
}
