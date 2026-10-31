import type { NavIconName } from '@/components/nav-links';
import type { ActionName } from '@/modules/access';

/**
 * Daftar menu HRIS. Satu tempat; tiap modul menambah barisnya sendiri.
 * `action` = tindakan bernama yang dibutuhkan; menu tanpa `action` tampil untuk semua yang punya
 * akses HRIS. Menu yang tersembunyi bukan penjaga: halamannya tetap memeriksa di server (SIS-36).
 */
export type NavItem = { href: string; label: string; icon: NavIconName; action?: ActionName | ActionName[] };

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Beranda', icon: 'home' },
  { href: '/profil', label: 'Profil saya', icon: 'user', action: 'profile.view' },
  { href: '/karyawan', label: 'Karyawan', icon: 'users', action: ['employee.list', 'employee.directory'] },
  { href: '/komponen', label: 'Komponen', icon: 'grid' },
  { href: '/pengaturan/organisasi', label: 'Cabang & Jabatan', icon: 'building', action: 'org.manage' },
  { href: '/pengaturan/hak-akses', label: 'Hak Akses Jabatan', icon: 'shield', action: 'position.grants.update' },
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
