/**
 * Daftar menu HRIS. Satu tempat; tiap modul menambah barisnya sendiri.
 * `action` = tindakan bernama untuk hak akses (diisi L2b). Selama L2b belum ada,
 * menu tanpa `action` tampil untuk semua yang punya akses HRIS; menu ber-`action`
 * disembunyikan sampai pemeriksa hak tersedia — gagal tertutup.
 */
export type NavItem = { href: string; label: string; icon: string; action?: string };

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Beranda', icon: '🏠' },
  { href: '/komponen', label: 'Komponen', icon: '🧩' },
];

export function visibleNav(canDo?: (action: string) => boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.action || (canDo ? canDo(item.action) : false));
}
