// Surat Jalan + Data Toko (spec LT1 §12). Aturan murni: status antrean dibaca dari kasir + status HRIS surat jalan (LT1b).
import type { IsoDate } from './trip';

export type NoteKind = 'SALE' | 'TRANSFER';
export type QueueStatus = 'WAITING' | 'ON_TRIP' | 'RECEIVED' | 'CANCELLED';

export const QUEUE_LABELS: Record<QueueStatus, string> = {
  WAITING: 'Menunggu dikirim', ON_TRIP: 'Dalam perjalanan', RECEIVED: 'Diterima cabang', CANCELLED: 'Batal di kasir',
};
export const QUEUE_STATUSES: QueueStatus[] = ['WAITING', 'ON_TRIP', 'RECEIVED', 'CANCELLED'];
export const STORE_NOTE_MAX = 500;

/** Nota truk: selesai = menunggu dikirim; batal atau menunggu batal = batal di kasir. */
export function saleQueueStatus(status: string): { status: QueueStatus; pendingVoid: boolean } {
  if (status === 'VOIDED') return { status: 'CANCELLED', pendingVoid: false };
  if (status === 'PENDING_VOID') return { status: 'CANCELLED', pendingVoid: true };
  return { status: 'WAITING', pendingVoid: false };
}

/** PO Internal truk: dalam perjalanan = menunggu; sudah diterima cabang tujuan; batal. Status lain tidak masuk antrean. */
export function transferQueueStatus(status: string): QueueStatus | null {
  if (status === 'IN_TRANSIT') return 'WAITING';
  if (status === 'PARTIALLY_RECEIVED' || status === 'FULLY_RECEIVED') return 'RECEIVED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return null;
}

/**
 * Tab antrean dari status kasir + status HRIS surat jalan (kosong = belum pernah disentuh = Menunggu). Batal di kasir
 * menang atas status HRIS; surat jalan Terkirim / Perlu keputusan (LT1b-2) tidak tampil di tab mana pun di sini.
 */
export function queueOf(kind: NoteKind, kasirStatus: string, hrisStatus: string | null): { status: QueueStatus; pendingVoid: boolean } | null {
  const hris = hrisStatus ?? 'WAITING';
  if (kind === 'SALE') {
    const sale = saleQueueStatus(kasirStatus);
    if (sale.status === 'CANCELLED') return sale;
  } else {
    const transfer = transferQueueStatus(kasirStatus);
    if (transfer !== 'WAITING') return transfer ? { status: transfer, pendingVoid: false } : null;
  }
  if (hris === 'ON_TRIP') return { status: 'ON_TRIP', pendingVoid: false };
  if (hris === 'WAITING') return { status: 'WAITING', pendingVoid: false };
  return null;
}

/** Umur dalam hari kalender (WIB) dari tanggal dokumen sampai hari ini; tidak pernah negatif. */
export function ageDays(on: IsoDate, today: IsoDate): number {
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${on}T00:00:00Z`)) / 86_400_000);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/** Paling lama dulu (LOG-20); tanggal sama = nomor. */
export function compareQueue(a: { on: IsoDate; number: string }, b: { on: IsoDate; number: string }): number {
  return a.on === b.on ? a.number.localeCompare(b.number) : a.on < b.on ? -1 : 1;
}

/** Catatan pengiriman toko: boleh kosong, paling panjang STORE_NOTE_MAX huruf. Mengembalikan teks rapi atau pesan salah. */
export function cleanStoreNote(note: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = (note ?? '').replace(/\r\n/g, '\n').trim();
  if (value.length > STORE_NOTE_MAX) return { ok: false, error: `Catatan pengiriman paling panjang ${STORE_NOTE_MAX} huruf.` };
  return { ok: true, value: value || null };
}

/**
 * Tautan "Ubah di Back Office" (spec LT1 §12, keputusan owner D): detail nota atau PO Internal di Back Office, tempat
 * cara kirim diubah. Kosong bila alamat Back Office belum diatur.
 */
export function backofficeLink(base: string | null | undefined, kind: NoteKind, ref: { number: string; id: number }): string | null {
  const root = (base ?? '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^/\s]+$/.test(root)) return null;
  return kind === 'SALE' ? `${root}/transactions?trx=${encodeURIComponent(ref.number)}` : `${root}/purchase-orders/internal/${ref.id}`;
}
