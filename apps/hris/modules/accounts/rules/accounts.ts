/** Aturan murni Akun & Tautan (spec L2d). Tanpa DB, tanpa React. */

export const MIN_PASSWORD_LENGTH = 8; // KAR-33

/** Role backoffice yang boleh dipilih untuk akses kasir (PRD 04 §3.2), urutan tampil. */
export const KASIR_ROLES = ['KASIR', 'GUDANG', 'MANAGER', 'FINANCE', 'GM', 'OWNER'] as const;
export type KasirRole = (typeof KASIR_ROLES)[number];

export const KASIR_ROLE_LABELS: Record<KasirRole, string> = {
  KASIR: 'Kasir', GUDANG: 'Gudang', MANAGER: 'Manager', FINANCE: 'Finance', GM: 'GM', OWNER: 'Owner',
};

export type AccountState = 'ACTIVE' | 'DISABLED' | 'MUST_CHANGE' | 'LOCKED';

export const ACCOUNT_STATE_LABELS: Record<AccountState, string> = {
  ACTIVE: 'Aktif', DISABLED: 'Nonaktif', MUST_CHANGE: 'Wajib ganti password', LOCKED: 'Terkunci sementara',
};

export function accountState(account: { isActive: boolean; mustChangePassword: boolean; lockedUntil: string | null }, now: Date): AccountState {
  if (!account.isActive) return 'DISABLED';
  if (account.lockedUntil && new Date(account.lockedUntil) > now) return 'LOCKED';
  if (account.mustChangePassword) return 'MUST_CHANGE';
  return 'ACTIVE';
}

export const OUTCOME_LABELS: Record<string, string> = { SUCCESS: 'Berhasil', REJECTED: 'Ditolak' };
export const APP_LABELS: Record<string, string> = { hris: 'HRIS', backoffice: 'Kasir/Backoffice' };
export const METHOD_LABELS: Record<string, string> = { PASSWORD: 'Password', PIN: 'PIN' };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 255 && EMAIL_PATTERN.test(email);
}

export function passwordProblem(value: string): string | null {
  if (value.length < MIN_PASSWORD_LENGTH) return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  if (value.length > 1024) return 'Password terlalu panjang.';
  return null;
}

// Tanpa huruf/angka yang mudah tertukar (0/O, 1/l/I) supaya mudah didiktekan.
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Password awal acak 10 karakter untuk diberikan ke orangnya (wajib diganti saat masuk pertama). */
export function generatePassword(length = 10): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => PASSWORD_ALPHABET[n % PASSWORD_ALPHABET.length]).join('');
}

export type KasirAccessInput = { roleName: KasirRole; branchId: number; assignedBranchIds: number[] };

/** Periksa isian akses kasir sebelum dikirim ke backoffice. Cabang utama selalu ikut cabang tugas. */
export function cleanKasirAccess(input: { roleName: unknown; branchId: unknown; assignedBranchIds: unknown }):
  { ok: true; value: KasirAccessInput } | { ok: false; error: string } {
  if (typeof input.roleName !== 'string' || !(KASIR_ROLES as readonly string[]).includes(input.roleName)) {
    return { ok: false, error: 'Pilih role kasir.' };
  }
  const branchId = Number(input.branchId);
  if (!Number.isSafeInteger(branchId) || branchId <= 0) return { ok: false, error: 'Pilih cabang utama.' };
  const extra = Array.isArray(input.assignedBranchIds) ? input.assignedBranchIds.map(Number) : [];
  if (extra.some((id) => !Number.isSafeInteger(id) || id <= 0)) return { ok: false, error: 'Cabang tugas tidak valid.' };
  return {
    ok: true,
    value: { roleName: input.roleName as KasirRole, branchId, assignedBranchIds: Array.from(new Set([branchId, ...extra])) },
  };
}

/** Rentang riwayat masuk dari tanggal WIB (inklusif), bawaan 7 hari terakhir (KAR-L40). Maksimal 92 hari. */
export function loginRange(fromIso: string | undefined, toIso: string | undefined, today: string):
  { from: string; to: string; fromInstant: Date; toInstant: Date } {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const to = toIso && iso.test(toIso) && toIso <= today ? toIso : today;
  const shift = (date: string, days: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  let from = fromIso && iso.test(fromIso) && fromIso <= to ? fromIso : shift(to, -6);
  if (from < shift(to, -91)) from = shift(to, -91);
  // Batas hari WIB (UTC+7) → instan UTC.
  return {
    from, to,
    fromInstant: new Date(`${from}T00:00:00+07:00`),
    toInstant: new Date(`${shift(to, 1)}T00:00:00+07:00`),
  };
}
