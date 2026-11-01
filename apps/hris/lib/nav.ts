import type { NavIconName } from '@/components/nav-links';
import type { ActionName } from '@/modules/access';

/**
 * Daftar menu HRIS, dikelompokkan. Satu tempat; tiap modul menambah barisnya di kelompok yang sesuai.
 * `action` = tindakan bernama yang dibutuhkan; menu tanpa `action` tampil untuk semua yang punya
 * akses HRIS. Menu yang tersembunyi bukan penjaga: halamannya tetap memeriksa di server (SIS-36).
 * `mobile` = ikut jadi pintasan di bilah bawah HP; menu lain dibuka lewat tombol Menu.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  action?: ActionName | ActionName[];
  mobile?: boolean;
};

/** Kelompok tanpa `label` selalu terbuka (tidak bisa dilipat). */
export type NavGroup = { id: string; label?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'main',
    items: [{ href: '/', label: 'Beranda', icon: 'home', mobile: true }],
  },
  {
    id: 'self',
    label: 'Saya',
    items: [{ href: '/profil', label: 'Profil saya', icon: 'user', action: 'profile.view', mobile: true }],
  },
  {
    id: 'employees',
    label: 'Karyawan',
    items: [
      { href: '/karyawan', label: 'Karyawan', icon: 'users', action: ['employee.list', 'employee.directory'], mobile: true },
    ],
  },
  {
    id: 'settings',
    label: 'Pengaturan',
    items: [
      { href: '/pengaturan/organisasi', label: 'Cabang & Jabatan', icon: 'building', action: 'org.manage' },
      { href: '/pengaturan/hak-akses', label: 'Hak Akses Jabatan', icon: 'shield', action: 'position.grants.update' },
      { href: '/pengaturan/jabatan', label: 'Pengaturan Jabatan', icon: 'table', action: ['position_settings.propose', 'position_settings.approve'] },
      { href: '/pengaturan/umum', label: 'Pengaturan', icon: 'sliders', action: 'settings.view' },
    ],
  },
  {
    id: 'system',
    label: 'Sistem',
    items: [
      { href: '/akun', label: 'Akun & Tautan', icon: 'key', action: 'account.manage' },
      { href: '/riwayat-masuk', label: 'Riwayat Masuk', icon: 'history', action: 'login_history.view_all' },
    ],
  },
  {
    id: 'developer',
    label: 'Pengembang',
    items: [{ href: '/komponen', label: 'Komponen', icon: 'grid' }],
  },
];

/** Bilah bawah HP memuat paling banyak sekian tombol (termasuk tombol Menu). */
export const MOBILE_BAR_SLOTS = 4;

/**
 * Menu yang boleh dilihat, kelompok kosong dibuang. Tanpa pemeriksa hak, menu ber-`action`
 * tersembunyi (gagal tertutup). Daftar tindakan = cukup salah satu.
 */
export function visibleNav(canDo?: (action: ActionName) => boolean, groups: NavGroup[] = NAV_GROUPS): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.action) return true;
        if (!canDo) return false;
        return (Array.isArray(item.action) ? item.action : [item.action]).some(canDo);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Isi bilah bawah HP. Bila semua menu muat, semuanya tampil tanpa tombol Menu;
 * bila tidak, pintasan `mobile` (maksimal slot − 1) + tombol Menu.
 */
export function mobileBar(groups: NavGroup[]): { items: NavItem[]; showMenu: boolean } {
  const all = groups.flatMap((group) => group.items);
  if (all.length <= MOBILE_BAR_SLOTS) return { items: all, showMenu: false };
  return { items: all.filter((item) => item.mobile).slice(0, MOBILE_BAR_SLOTS - 1), showMenu: true };
}

export function isActivePath(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
