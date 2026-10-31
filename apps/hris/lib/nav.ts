import type { ActionName } from '@/modules/access';

/**
 * Daftar menu HRIS. Satu tempat; tiap modul menambah barisnya sendiri.
 * `action` = tindakan bernama yang dibutuhkan; menu tanpa `action` tampil untuk semua yang punya
 * akses HRIS. Menu yang tersembunyi bukan penjaga: halamannya tetap memeriksa di server (SIS-36).
 */
export type NavItem = { href: string; label: string; icon: string; action?: ActionName | ActionName[] };

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Beranda', icon: '🏠' },
  { href: '/profil', label: 'Profil saya', icon: '👤', action: 'profile.view' },
  { href: '/karyawan', label: 'Karyawan', icon: '👥', action: ['employee.list', 'employee.directory'] },
  { href: '/komponen', label: 'Komponen', icon: '🧩' },
  { href: '/pengaturan/organisasi', label: 'Cabang & Jabatan', icon: '🏢', action: 'org.manage' },
  { href: '/pengaturan/hak-akses', label: 'Hak Akses Jabatan', icon: '🔐', action: 'position.grants.update' },
];

/**
 * Tanpa pemeriksa hak, menu ber-`action` tersembunyi (gagal tertutup). Daftar tindakan = cukup salah satu.
 */
export function visibleNav(canDo?: (action: ActionName) => boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.action) return true;
    if (!canDo) return false;
    return (Array.isArray(item.action) ? item.action : [item.action]).some(canDo);
  });
}
