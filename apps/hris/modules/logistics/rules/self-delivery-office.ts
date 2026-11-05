// Antar sendiri sisi kantor (spec LT1 §15.3, LT3c; LOG-108, 110, 128). Aturan murni tanpa database.
import type { IsoDate } from './trip';

export type SelfDecision = 'RESEND' | 'DROP';
export const SELF_DECISION_LABELS: Record<SelfDecision, string> = { RESEND: 'Kirim ulang', DROP: 'Batal kirim' };

export type SelfEventKind = 'CLOSED' | 'HANDOVER' | 'RESENT' | 'DROPPED' | 'PAYMENT_CORRECTED';
export const SELF_EVENT_LABELS: Record<SelfEventKind, string> = {
  CLOSED: 'Ditutup kantor', HANDOVER: 'PJ dialihkan', RESENT: 'Gagal → Kirim ulang', DROPPED: 'Gagal → Batal kirim',
  PAYMENT_CORRECTED: 'Cara bayar dikoreksi',
};

/**
 * Siapa boleh mengoreksi cara bayar antar sendiri (spec LT1 §15.4 butir 2): PJ selama perjalanan berjalan (belum Foto 3);
 * sesudahnya pemegang `logistics.self_delivery.manage` cabang itu, bukan PJ-nya. Mengembalikan pesan penolakan atau null.
 */
export function selfCorrectProblem(input: { running: boolean; isPj: boolean; canManage: boolean }): string | null {
  if (input.running) return input.isPj ? null : 'Selama perjalanan berjalan, cara bayar dikoreksi PJ-nya sendiri.';
  if (!input.canManage) return 'Sesudah Foto 3, cara bayar dikoreksi Kepala Toko cabang itu, Kepala Gudang, Pemilik, atau GM.';
  if (input.isPj) return 'Cara bayar perjalanan yang Anda PJ-kan sendiri dikoreksi rekan atau atasan sesudah Foto 3.';
  return null;
}

/**
 * Tunai perjalanan sesudah koreksi cara bayar (spec LT1 §15.4 butir 2). Selama berjalan tunai belum dihitung (Foto 3).
 * Bila tunai sudah diterima laci lalu jumlahnya berubah, penerimaan dibuka lagi supaya diterima ulang dengan jumlah baru.
 */
export function cashAfterCorrection(input: { running: boolean; cashBefore: number; cashAfter: number; received: boolean }):
  { cash: number; reopen: boolean } {
  if (input.running) return { cash: 0, reopen: false };
  return { cash: input.cashAfter, reopen: input.received && input.cashAfter !== input.cashBefore };
}

/** Tab layar kantor. */
export const OFFICE_TABS = ['RUNNING', 'LATE', 'FAILED', 'CASH', 'DONE'] as const;
export type OfficeTab = (typeof OFFICE_TABS)[number];
export const OFFICE_TAB_LABELS: Record<OfficeTab, string> = {
  RUNNING: 'Berjalan', LATE: 'Belum kembali', FAILED: 'Gagal perlu keputusan', CASH: 'Tunai belum diterima', DONE: 'Selesai (7 hari)',
};
export const officeTab = (value: string | null | undefined): OfficeTab =>
  (OFFICE_TABS as readonly string[]).includes(value ?? '') ? (value as OfficeTab) : 'RUNNING';

/** Perjalanan yang belum kembali sampai 23.59 hari mulainya ditandai (LOG-110). */
export function tripLate(startedOn: IsoDate, today: IsoDate): boolean {
  return startedOn < today;
}

/** Alasan tindakan kantor: wajib, 5–300 huruf. */
export function officeReason(reason: string | null | undefined): { ok: true; text: string } | { ok: false; error: string } {
  const text = (reason ?? '').replace(/\s+/g, ' ').trim();
  if (text.length < 5) return { ok: false, error: 'Tulis alasannya, paling sedikit 5 huruf.' };
  if (text.length > 300) return { ok: false, error: 'Alasan paling panjang 300 huruf.' };
  return { ok: true, text };
}

/**
 * Siapa boleh menutup / mengalihkan perjalanan (LOG-110): pemegang hak kantor untuk cabang itu, tapi bukan PJ perjalanan
 * itu sendiri. Mengembalikan pesan penolakan atau null.
 */
export function officeActorProblem(input: { allowed: boolean; actorEmployeeId: number; pjEmployeeId: number }): string | null {
  if (!input.allowed) return 'Anda tidak berhak mengurus antar sendiri cabang ini.';
  if (input.actorEmployeeId === input.pjEmployeeId) return 'Perjalanan yang Anda PJ-kan sendiri diurus rekan atau atasan.';
  return null;
}
