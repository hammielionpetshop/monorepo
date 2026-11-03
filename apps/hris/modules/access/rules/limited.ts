import type { Actor } from './can';

// Akses terbatas mantan karyawan (spec L4g §3.7, GAJ-113): orang yang berhenti/diberhentikan tetap bisa masuk selama
// masih punya urusan gaji, tetapi hanya ke Pendapatan Saya, Slip Saya, Pengajuan Saya (Keberatan slip saja),
// Pemberitahuan, dan Profil (lihat saja). Penjaga di server memakai daftar alamat ini; menu hanya cerminannya.

/** Halaman yang terbuka. `/` dialihkan ke Pendapatan Saya oleh tata letak. */
const LIMITED_PAGES: readonly RegExp[] = [
  /^\/$/, /^\/pendapatan(\/.*)?$/, /^\/pengajuan$/, /^\/pengajuan\/\d+$/, /^\/pemberitahuan$/, /^\/profil$/,
];

/** Pintu API yang dibutuhkan halaman di atas. Isi permintaannya tetap dijaga `can()` dan jenis pengajuan di bawah. */
const LIMITED_APIS: readonly RegExp[] = [
  /^\/api\/requests(\/.*)?$/, /^\/api\/files$/, /^\/api\/payroll$/, /^\/api\/notifications$/,
];

/** Jenis pengajuan yang boleh dibuat, dilihat, dan dibatalkan mantan karyawan. */
export const LIMITED_REQUEST_TYPES: readonly string[] = ['payslip_objection', 'payslip_objection_owner'];

export const LIMITED_BANNER = 'Akses terbatas sampai urusan gaji selesai.';

export function limitedPathAllowed(path: string | null | undefined): boolean {
  if (!path) return false;
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  return [...LIMITED_PAGES, ...LIMITED_APIS].some((pattern) => pattern.test(clean));
}

/**
 * Pelaku mantan karyawan dalam akses terbatas. Hanya `profile.view` atas dirinya sendiri, dan hanya bila alamatnya
 * termasuk daftar; di alamat lain tanpa hak sama sekali (semua tindakan ditolak).
 */
export function limitedActor(actor: Actor, since: string, pathAllowed: boolean): Actor {
  return {
    ...actor, positionId: null, fullAccess: false, highRights: false, branchId: null, departmentId: null,
    limited: { since }, grants: pathAllowed ? new Map([['profile.view', 'SELF' as const]]) : new Map(),
  };
}

/** Jenis pengajuan ini boleh untuk pelaku? Pelaku biasa: selalu (hak diperiksa terpisah). */
export function requestTypeAllowedFor(actor: Actor | null, typeKey: string): boolean {
  return !actor?.limited || LIMITED_REQUEST_TYPES.includes(typeKey);
}
