import { addDays, type IsoDate } from './trip';

// Laporan Muat (spec LT1 §15.1, LT3a): aturan murni tanpa database.

export type LoadReportStatus = 'DRAFT' | 'DONE' | 'CANCELLED';
export type LoadPhotoKind = 'NOTE' | 'GOODS';

export const LOAD_STATUS_LABELS: Record<LoadReportStatus, string> = { DRAFT: 'Proses', DONE: 'Selesai', CANCELLED: 'Batal' };
export const LOAD_STATUS_TONES: Record<LoadReportStatus, 'info' | 'ok' | 'danger'> = { DRAFT: 'info', DONE: 'ok', CANCELLED: 'danger' };
export const LOAD_PHOTO_LABELS: Record<LoadPhotoKind, string> = { NOTE: 'Foto nota', GOODS: 'Foto barang' };

/** Nota kasir boleh dipilih bila tanggalnya paling lama sekian hari ke belakang (§15.1 butir 2). */
export const LOAD_NOTE_DAYS = 7;
export const LOAD_MAX_NOTES = 10;
export const LOAD_MAX_PHOTOS: Record<LoadPhotoKind, number> = { NOTE: 5, GOODS: 20 };

/** Nota kasir batal / menunggu batal tidak bisa dipakai. */
const VOID_STATUSES = new Set(['VOIDED', 'PENDING_VOID']);

/** Tanggal nota paling awal yang masih boleh dipilih pada `today`. */
export function earliestNoteDate(today: IsoDate): IsoDate {
  return addDays(today, -LOAD_NOTE_DAYS);
}

export type SaleForLoad = { trxNumber: string; customerId: number | null; status: string; trxOn: IsoDate; kasirBranchId: number };

/** Alasan nota tidak bisa dipilih untuk laporan muat cabang ini, atau null bila boleh. */
export function noteProblem(sale: SaleForLoad, kasirBranchId: number, today: IsoDate): string | null {
  if (sale.kasirBranchId !== kasirBranchId) return `Nota ${sale.trxNumber} bukan nota kasir cabang ini.`;
  if (sale.customerId == null) return `Nota ${sale.trxNumber} tanpa pelanggan; laporan muat butuh nota berpelanggan.`;
  if (VOID_STATUSES.has(sale.status)) return `Nota ${sale.trxNumber} sudah dibatalkan di kasir.`;
  if (sale.trxOn < earliestNoteDate(today)) return `Nota ${sale.trxNumber} lebih dari ${LOAD_NOTE_DAYS} hari yang lalu.`;
  return null;
}

/** Semua nota satu laporan harus dari pelanggan (toko) yang sama, 1 s.d. batas. */
export function notesProblem(customerIds: (number | null)[], existing = 0): string | null {
  if (!customerIds.length) return 'Pilih nota kasirnya dulu.';
  if (existing + customerIds.length > LOAD_MAX_NOTES) return `Satu laporan muat paling banyak ${LOAD_MAX_NOTES} nota.`;
  if (new Set(customerIds).size > 1) return 'Semua nota di satu laporan muat harus dari toko yang sama.';
  return null;
}

export type PhotoCounts = Record<LoadPhotoKind, number>;

/** Boleh menambah foto jenis ini? Foto barang sesudah ada foto nota; batas jumlah termasuk susulan (§15.1 butir 3, 4). */
export function photoProblem(status: LoadReportStatus, kind: LoadPhotoKind, counts: PhotoCounts): string | null {
  if (status === 'CANCELLED') return 'Laporan muat ini sudah dibatalkan.';
  if (kind === 'GOODS' && counts.NOTE < 1) return 'Foto nota dulu, baru foto barang.';
  if (counts[kind] >= LOAD_MAX_PHOTOS[kind]) return `${LOAD_PHOTO_LABELS[kind]} paling banyak ${LOAD_MAX_PHOTOS[kind]}.`;
  return null;
}

/** Syarat Selesai (§15.1 butir 4). */
export function finishProblem(status: LoadReportStatus, counts: PhotoCounts, notes: number): string | null {
  if (status !== 'DRAFT') return 'Laporan muat ini sudah tidak dalam Proses.';
  if (notes < 1) return 'Pilih nota kasirnya dulu.';
  if (counts.NOTE < 1) return 'Ambil foto nota dulu.';
  if (counts.GOODS < 1) return 'Ambil foto barang dulu.';
  return null;
}
