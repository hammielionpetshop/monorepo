// Antar sendiri (spec LT1 §15.2, LT3b; LOG-42, 43, 109, 110, 117, 128). Aturan murni tanpa database.
import Big from 'big.js';
import { REASON_MIN, addDays, type IsoDate } from './trip';
import type { PaymentMethod } from './store-payments';

export type SelfTripStatus = 'RUNNING' | 'DONE';
export type SelfStopStatus = 'OPEN' | 'DELIVERED' | 'TOMORROW' | 'FAILED';

export const SELF_TRIP_LABELS: Record<SelfTripStatus, string> = { RUNNING: 'Berjalan', DONE: 'Kembali' };
export const SELF_STOP_LABELS: Record<SelfStopStatus, string> = { OPEN: 'Belum', DELIVERED: 'Terkirim', TOMORROW: 'Kirim Besok', FAILED: 'Gagal' };
export const SELF_STOP_TONES: Record<SelfStopStatus, 'info' | 'ok' | 'warn' | 'danger'> = { OPEN: 'info', DELIVERED: 'ok', TOMORROW: 'warn', FAILED: 'danger' };

/** Paling banyak nota dalam satu perjalanan. */
export const SELF_MAX_STOPS = 10;

/** Nota kasir batal / menunggu batal tidak dibawa dan tidak bisa Terkirim. */
export const isVoided = (status: string) => status === 'VOIDED' || status === 'PENDING_VOID';

/** AS-YYMMDD-n (tanggal mulai WIB, urut per tanggal). */
export function selfTripNumber(date: IsoDate, sequence: number): string {
  return `AS-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}-${sequence}`;
}

/** Jumlah nota yang dibawa: 1 sampai batas, tanpa dobel. */
export function stopsProblem(transactionIds: number[]): string | null {
  const unique = new Set(transactionIds);
  if (!unique.size) return 'Pilih paling sedikit satu nota yang dibawa.';
  if (unique.size !== transactionIds.length) return 'Ada nota yang dipilih dua kali.';
  if (unique.size > SELF_MAX_STOPS) return `Paling banyak ${SELF_MAX_STOPS} nota dalam satu perjalanan.`;
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');
function clockOf(at: Date): string {
  const wib = new Date(at.getTime() + 7 * 3_600_000);
  return `${pad(wib.getUTCHours())}.${pad(wib.getUTCMinutes())}`;
}

/**
 * Tiap tahap paling sedikit `minMinutes` menit (LOG-43): Foto 2 / Foto 3 baru bisa sesudah foto sebelumnya + batas.
 * Mengembalikan pesan bila belum boleh, atau null.
 */
export function stageWaitProblem(previousAt: Date, now: Date, minMinutes: number): string | null {
  const opens = new Date(previousAt.getTime() + Math.max(0, minMinutes) * 60_000);
  if (now >= opens) return null;
  return `Tiap tahap paling sedikit ${minMinutes} menit. Foto berikutnya bisa mulai ${clockOf(opens)}.`;
}

/**
 * Selisih lama berangkat dan lama kembali (LOG-43), menit bulat ke bawah: berangkat = Foto 1 → tujuan pertama selesai,
 * kembali = tujuan terakhir selesai → Foto 3.
 */
export function gapMinutes(startedAt: Date, firstDoneAt: Date, lastDoneAt: Date, returnedAt: Date): number {
  const out = firstDoneAt.getTime() - startedAt.getTime();
  const back = returnedAt.getTime() - lastDoneAt.getTime();
  return Math.floor(Math.abs(out - back) / 60_000);
}

/** Alasan baku selisih lama (arsip LOG-B39). Lainnya wajib keterangan. */
export const GAP_REASONS: { code: string; label: string }[] = [
  { code: 'TRAFFIC', label: 'Macet' }, { code: 'FUEL', label: 'Isi bensin' }, { code: 'REST', label: 'Istirahat' },
  { code: 'WAITING', label: 'Menunggu di toko' }, { code: 'OTHER_TASK', label: 'Tugas lain' }, { code: 'OTHER', label: 'Lainnya' },
];

/** Alasan selisih: wajib bila selisih ≥ batas; teks tersimpan "Label: keterangan". Tanpa wajib → null. */
export function cleanGapReason(gap: number, limit: number, code: string | null | undefined, note: string | null | undefined):
  { ok: true; text: string | null } | { ok: false; error: string } {
  if (gap < limit) return { ok: true, text: null };
  const reason = GAP_REASONS.find((r) => r.code === code);
  if (!reason) return { ok: false, error: `Lama berangkat dan lama kembali berselisih ${gap} menit. Pilih alasannya.` };
  const extra = (note ?? '').replace(/\s+/g, ' ').trim();
  if (extra.length > 300) return { ok: false, error: 'Keterangan paling panjang 300 huruf.' };
  if (reason.code === 'OTHER' && extra.length < REASON_MIN) return { ok: false, error: `Tulis keterangannya, paling sedikit ${REASON_MIN} huruf.` };
  return { ok: true, text: extra ? (reason.code === 'OTHER' ? extra : `${reason.label}: ${extra}`) : reason.label };
}

/** Tunai yang dibawa pulang ke laci cabang (LOG-128): Lunas cash + Bayar sebagian. */
export function cashOf(payments: { method: PaymentMethod | string; receivedAmount: number }[]): number {
  return Number(payments.filter((p) => p.method === 'CASH' || p.method === 'PARTIAL')
    .reduce((sum, p) => sum.plus(p.receivedAmount), new Big(0)));
}

/**
 * Tanda ⚠ foto antar tidak lengkap (LOG-109): nota kurir yang perjalanannya belum Foto 3 sampai 23.59 WIB hari berikutnya
 * sesudah tanggal nota. Lewat tenggat = `now` sudah melewati 00.00 WIB lusa.
 */
export function photoDeadlinePassed(trxOn: IsoDate, now: Date): boolean {
  const limit = new Date(`${addDays(trxOn, 2)}T00:00:00+07:00`);
  return now >= limit;
}

/** Tunai belum diterima laci sampai 23.59 hari kembali ditandai untuk Kepala Toko (LOG-128). */
export function cashLate(returnedOn: IsoDate, today: IsoDate): boolean {
  return returnedOn < today;
}
