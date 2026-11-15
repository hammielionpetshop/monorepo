// Aturan murni slip mingguan (spec L7 §3.5, §12): jenis slip, kunci periode, nomor, jendela tutup, jatuh bayar, pengingat.
// Kalender minggunya (hari awal bertanggal) ada di modul Logistik (`weekOf`, `weekRegimes`).
import type { IsoDate } from './salary';

/** Slip mingguan pertama di HRIS (spec L7 §9 butir 4: sama dengan tanggal berlaku tarif awal). Ganti sebelum produksi. */
export const WEEKLY_SLIP_FROM: IsoDate = '2026-10-30';

/** Jatuh bayar = sekian hari sesudah hari terakhir minggu (Kamis → Sabtu, DRV-20). */
export const WEEKLY_PAY_AFTER_DAYS = 2;

export type SlipKind = 'MONTHLY' | 'WEEKLY' | 'WEEKLY_EXTRA';
export const isWeeklyKind = (kind: string): boolean => kind === 'WEEKLY' || kind === 'WEEKLY_EXTRA';
export const SLIP_KIND_LABELS: Record<SlipKind, string> = { MONTHLY: 'Slip bulanan', WEEKLY: 'Slip mingguan', WEEKLY_EXTRA: 'Slip di luar slip utama' };

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Kunci periode di alamat dan tombol: `W` + awal minggu, supaya tidak tertukar dengan periode bulanan (tanggal 26). */
export const weekKey = (start: IsoDate): string => `W${start}`;

export function parsePeriodKey(key: string): { weekly: boolean; start: IsoDate } | null {
  const m = /^(W)?(\d{4}-\d{2}-\d{2})$/.exec(key);
  if (!m || Number.isNaN(Date.parse(`${m[2]}T00:00:00Z`))) return null;
  if (!m[1] && !m[2].endsWith('-26')) return null;
  return { weekly: Boolean(m[1]), start: m[2] };
}

/** Nomor slip mingguan `SM-[tanggal akhir minggu]-[urut 4 angka]` (slip utama dan di luar slip utama berbagi urutan). */
export function weeklySlipNumber(end: IsoDate, sequence: number): string {
  return `SM-${end.replace(/-/g, '')}-${String(sequence).padStart(4, '0')}`;
}

/** Tombol Tutup aktif: sehari sesudah minggu berakhir, pukul `hour` WIB (bawaan Jumat 10.00). */
export function weeklyCloseOpensAt(end: IsoDate, hour: number): Date {
  const [y, m, d] = addDays(end, 1).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, 0, 0) - 7 * 3_600_000);
}

/** Tanggal bayar menurut aturan: dua hari sesudah minggu berakhir (Sabtu). */
export const weeklyPayDate = (end: IsoDate): IsoDate => addDays(end, WEEKLY_PAY_AFTER_DAYS);

/**
 * Pengingat slip mingguan belum ditutup (spec L7 §6): pada hari tombol Tutup aktif tepat di jam pengingat, lalu tiap hari
 * berikutnya pukul 07.00. `hourWib` = jam WIB saat mesin berjalan (mesin dijalankan tiap jam).
 */
export function weeklyReminderDue(end: IsoDate, today: IsoDate, hourWib: number, remindHour: number): boolean {
  const openDay = addDays(end, 1);
  if (today < openDay) return false;
  return today === openDay ? hourWib === remindHour : hourWib === 7;
}
