import { REASON_MIN } from './trip';

// Tugas jemput retur (A2, spec docs/work/specs/2026-11-08-jemput-retur-design.md): aturan murni tanpa database.

export type PickupTaskStatus = 'WAITING' | 'ON_TRIP' | 'PICKED' | 'NO_GOODS' | 'CANCELLED';
export type PickupOutcome = 'PICKED' | 'NO_GOODS' | 'TOMORROW';
export type PickupEventKind = 'CREATED' | 'ON_TRIP' | 'RELEASED' | 'TOMORROW' | 'MISSED' | 'PICKED' | 'NO_GOODS' | 'CANCELLED';

export const PICKUP_TASK_LABELS: Record<PickupTaskStatus, string> = {
  WAITING: 'Menunggu', ON_TRIP: 'Di trip', PICKED: 'Diambil', NO_GOODS: 'Tidak ada barang', CANCELLED: 'Dibatalkan',
};
export const PICKUP_TASK_TONES: Record<PickupTaskStatus, 'info' | 'ok' | 'warn' | 'danger'> = {
  WAITING: 'warn', ON_TRIP: 'info', PICKED: 'ok', NO_GOODS: 'info', CANCELLED: 'danger',
};
export const PICKUP_EVENT_LABELS: Record<PickupEventKind, string> = {
  CREATED: 'Dibuat', ON_TRIP: 'Masuk trip', RELEASED: 'Dilepas dari trip', TOMORROW: 'Kirim Besok', MISSED: 'Terlewat',
  PICKED: 'Diambil', NO_GOODS: 'Tidak ada barang', CANCELLED: 'Dibatalkan',
};

const squash = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

/** Isi tugas baru: alasan 5–300 huruf, perkiraan barang boleh kosong (≤ 300). */
export function cleanPickupTask(input: { reason?: string | null; estimate?: string | null }):
  { ok: true; reason: string; estimate: string | null } | { ok: false; error: string } {
  const reason = squash(input.reason);
  if (reason.length < REASON_MIN) return { ok: false, error: `Tulis alasan retur, paling sedikit ${REASON_MIN} huruf.` };
  if (reason.length > 300) return { ok: false, error: 'Alasan paling panjang 300 huruf.' };
  const estimate = squash(input.estimate);
  if (estimate.length > 300) return { ok: false, error: 'Perkiraan barang paling panjang 300 huruf.' };
  return { ok: true, reason, estimate: estimate || null };
}

/** Hasil di toko: Diambil (catatan boleh kosong, ≤ 300), Tidak ada barang / Kirim Besok (alasan wajib). */
export function cleanPickupOutcome(outcome: string | null | undefined, note: string | null | undefined):
  { ok: true; outcome: PickupOutcome; note: string | null } | { ok: false; error: string } {
  if (outcome !== 'PICKED' && outcome !== 'NO_GOODS' && outcome !== 'TOMORROW') return { ok: false, error: 'Pilih hasil jemput retur.' };
  const text = squash(note);
  if (text.length > 300) return { ok: false, error: 'Catatan paling panjang 300 huruf.' };
  if (outcome !== 'PICKED' && text.length < REASON_MIN) {
    return { ok: false, error: `Tulis alasannya, paling sedikit ${REASON_MIN} huruf.` };
  }
  return { ok: true, outcome, note: text || null };
}

/** Menunggu terlalu lama: lebih dari `redDays` hari sejak dibuat. */
export const pickupWaitRed = (ageDays: number, redDays: number) => ageDays > redDays;
