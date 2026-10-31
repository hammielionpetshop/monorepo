import { describe, expect, it } from 'vitest';
import { mobileBar, visibleNav, type NavGroup } from './nav';

const groups: NavGroup[] = [
  { id: 'main', items: [{ href: '/', label: 'Beranda', icon: 'home', mobile: true }] },
  { id: 'self', label: 'Saya', items: [{ href: '/profil', label: 'Profil', icon: 'user', action: 'profile.view', mobile: true }] },
  {
    id: 'settings',
    label: 'Pengaturan',
    items: [
      { href: '/a', label: 'A', icon: 'building', action: 'org.manage' },
      { href: '/b', label: 'B', icon: 'shield', action: ['position.grants.update', 'org.manage'] },
    ],
  },
];

describe('visibleNav', () => {
  it('tanpa pemeriksa hak hanya menampilkan menu tanpa tindakan dan membuang kelompok kosong', () => {
    expect(visibleNav(undefined, groups).map((g) => g.id)).toEqual(['main']);
  });

  it('membuang kelompok yang semua menunya tidak boleh dilihat', () => {
    const result = visibleNav((action) => action === 'profile.view', groups);
    expect(result.map((g) => g.id)).toEqual(['main', 'self']);
  });

  it('menu dengan daftar tindakan cukup salah satu', () => {
    const result = visibleNav((action) => action === 'org.manage', groups);
    expect(result.find((g) => g.id === 'settings')?.items.map((i) => i.href)).toEqual(['/a', '/b']);
  });

  it('tidak mengubah daftar menu asal', () => {
    visibleNav(() => false, groups);
    expect(groups[2].items).toHaveLength(2);
  });
});

describe('mobileBar', () => {
  it('menampilkan semua menu tanpa tombol Menu bila muat', () => {
    const bar = mobileBar(visibleNav(() => true, groups.slice(0, 2)));
    expect(bar).toEqual({ items: expect.any(Array), showMenu: false });
    expect(bar.items).toHaveLength(2);
  });

  it('memakai pintasan + tombol Menu bila menu lebih banyak dari slot', () => {
    const many: NavGroup[] = [
      ...groups,
      { id: 'x', label: 'X', items: [{ href: '/x', label: 'X', icon: 'grid' }, { href: '/y', label: 'Y', icon: 'grid' }] },
    ];
    const bar = mobileBar(visibleNav(() => true, many));
    expect(bar.showMenu).toBe(true);
    expect(bar.items.map((i) => i.href)).toEqual(['/', '/profil']);
  });
});
