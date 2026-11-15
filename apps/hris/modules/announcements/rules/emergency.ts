/**
 * Aturan pengumuman darurat tanpa DB (spec F3-2 §3, PRD Fase 3 `02-pengumuman-darurat.md`).
 * Sasaran: semua orang, atau irisan cabang dan jabatan terpilih (keputusan owner §9 butir 2).
 */

export type IsoDate = string;

export const EMERGENCY_TITLE_MAX = 80;

export type EmergencyTarget = { all: true } | { all: false; branchIds: number[]; positionIds: number[] };

export type EmergencyInput = { title: string; message: string; target: EmergencyTarget; showsUntilDate: IsoDate };

export type EmergencyLimits = { maxChars: number; maxDays: number; today: IsoDate };

export type EmergencyStatus = 'SHOWING' | 'EXPIRED' | 'ENDED';

export const EMERGENCY_STATUS_LABELS: Record<EmergencyStatus, string> = {
  SHOWING: 'Tayang',
  EXPIRED: 'Berakhir',
  ENDED: 'Diakhiri',
};

/** Jumlah huruf seperti yang dilihat orang (emoji dihitung satu). */
export function letterCount(text: string): number {
  return [...text].length;
}

/** Orang dengan penempatan ini termasuk sasaran? Cabang saja = semua jabatan di cabang itu, dan sebaliknya. */
export function matchesTarget(target: EmergencyTarget, placement: { branchId: number; positionId: number }): boolean {
  if (target.all) return true;
  const branchOk = !target.branchIds.length || target.branchIds.includes(placement.branchId);
  const positionOk = !target.positionIds.length || target.positionIds.includes(placement.positionId);
  return branchOk && positionOk;
}

/** Tanggal terakhir yang boleh dipilih: hari ini dihitung hari pertama (7 hari = hari ini s.d. hari ini + 6). */
export function lastAllowedDate(today: IsoDate, maxDays: number): IsoDate {
  return addDays(today, Math.max(1, maxDays) - 1);
}

/** Akhir tanggal WIB (23.59.59,999 WIB) sebagai waktu UTC. */
export function endOfDayWib(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 16, 59, 59, 999));
}

export type ValidEmergency = { title: string; message: string; target: EmergencyTarget; showsUntil: Date };

/** Periksa isian kirim. Mengembalikan isian yang sudah dirapikan, atau pesan galat untuk pengirim. */
export function validateEmergency(input: EmergencyInput, limits: EmergencyLimits): { ok: true; value: ValidEmergency } | { ok: false; error: string } {
  const title = input.title.trim();
  const message = input.message.trim();
  if (!title) return { ok: false, error: 'Judul wajib diisi.' };
  if (letterCount(title) > EMERGENCY_TITLE_MAX) return { ok: false, error: `Judul paling banyak ${EMERGENCY_TITLE_MAX} huruf.` };
  if (!message) return { ok: false, error: 'Pesan wajib diisi.' };
  if (letterCount(message) > limits.maxChars) return { ok: false, error: `Pesan paling banyak ${limits.maxChars} huruf supaya terbaca dalam beberapa detik.` };
  if (!isIsoDate(input.showsUntilDate)) return { ok: false, error: 'Tanggal tayang tidak sah.' };
  if (input.showsUntilDate < limits.today) return { ok: false, error: 'Tanggal tayang tidak boleh sebelum hari ini.' };
  const last = lastAllowedDate(limits.today, limits.maxDays);
  if (input.showsUntilDate > last) return { ok: false, error: `Masa tayang paling lama ${limits.maxDays} hari (sampai ${last}).` };
  const target = normalizeTarget(input.target);
  if (!target.all && !target.branchIds.length && !target.positionIds.length) {
    return { ok: false, error: 'Pilih Semua orang, atau minimal satu cabang atau jabatan.' };
  }
  return { ok: true, value: { title, message, target, showsUntil: endOfDayWib(input.showsUntilDate) } };
}

function normalizeTarget(target: EmergencyTarget): EmergencyTarget {
  if (target.all) return { all: true };
  const unique = (ids: number[]) => [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
  return { all: false, branchIds: unique(target.branchIds), positionIds: unique(target.positionIds) };
}

export function emergencyStatus(row: { showsUntil: Date; endedAt: Date | null }, now: Date = new Date()): EmergencyStatus {
  if (row.endedAt) return 'ENDED';
  return row.showsUntil.getTime() > now.getTime() ? 'SHOWING' : 'EXPIRED';
}

/** Alasan Akhiri sekarang: wajib, singkat. */
export function checkEndReason(reason: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = reason.trim();
  if (value.length < 3) return { ok: false, error: 'Alasan wajib diisi (minimal 3 huruf).' };
  if (letterCount(value) > 200) return { ok: false, error: 'Alasan paling banyak 200 huruf.' };
  return { ok: true, value };
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
