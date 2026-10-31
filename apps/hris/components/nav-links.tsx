'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { isActivePath, mobileBar, type NavGroup, type NavItem } from '@/lib/nav';
import { Dialog } from './ui/dialog';

/**
 * Ikon garis satu warna untuk menu (mengikuti warna teks lewat currentColor), tanpa pustaka tambahan.
 * Modul yang menambah menu menambah ikonnya di sini.
 */
const ICON_PATHS = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9v12h14V9" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
      <path d="M10 21v-3h4v3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 8.4 7 10 4-1.6 7-5.5 7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  chevron: <path d="m9 6 6 6-6 6" />,
} satisfies Record<string, ReactNode>;

export type NavIconName = keyof typeof ICON_PATHS;

function NavIcon({ name, size = 20, className }: { name: NavIconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={cn('shrink-0', className)}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

const COLLAPSED_KEY = 'hris-nav-collapsed';

function readCollapsed(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveCollapsed(ids: string[]) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(ids));
  } catch {
    // Penyimpanan diblokir: status lipat berlaku sampai halaman dimuat ulang.
  }
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActivePath(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
        active ? 'bg-brand-100 text-brand-700' : 'text-ink-muted hover:bg-canvas hover:text-ink',
      )}
    >
      <NavIcon name={item.icon} />
      {item.label}
    </Link>
  );
}

/** Sisi kiri di layar lebar: kelompok berjudul bisa dilipat, statusnya diingat per perangkat. */
export function SideNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<string[]>([]);

  // Baca status lipat; kelompok berisi halaman yang sedang dibuka selalu dibuka kembali.
  useEffect(() => {
    const stored = readCollapsed();
    const next = stored.filter((id) => !groups.some(
      (group) => group.id === id && group.items.some((item) => isActivePath(pathname, item.href)),
    ));
    if (next.length !== stored.length) saveCollapsed(next);
    setCollapsed(next);
  }, [pathname, groups]);

  function toggle(id: string) {
    const next = collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id];
    saveCollapsed(next);
    setCollapsed(next);
  }

  return (
    <nav aria-label="Menu utama" className="space-y-3">
      {groups.map((group) => {
        const items = (
          <ul id={`nav-group-${group.id}`} className="space-y-1">
            {group.items.map((item) => (
              <li key={item.href}><NavLink item={item} pathname={pathname} /></li>
            ))}
          </ul>
        );
        if (!group.label) return <div key={group.id}>{items}</div>;
        const open = !collapsed.includes(group.id);
        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggle(group.id)}
              aria-expanded={open}
              aria-controls={`nav-group-${group.id}`}
              className="flex min-h-9 w-full items-center justify-between rounded-lg px-3 text-xs font-semibold uppercase tracking-wide text-ink-muted hover:bg-canvas hover:text-ink"
            >
              {group.label}
              <NavIcon name="chevron" size={16} className={cn('transition-transform', open && 'rotate-90')} />
            </button>
            <div hidden={!open} className="mt-1">{items}</div>
          </div>
        );
      })}
    </nav>
  );
}

/** Bilah bawah di HP: pintasan + tombol Menu yang membuka seluruh menu berkelompok. */
export function BottomNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { items, showMenu } = mobileBar(groups);
  const activeInBar = items.some((item) => isActivePath(pathname, item.href));

  useEffect(() => setMenuOpen(false), [pathname]);

  const barButton = (active: boolean) => cn(
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs',
    active ? 'font-semibold text-brand-700' : 'text-ink-muted',
  );

  return (
    <>
      <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface md:hidden">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={barButton(active)}>
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
        {showMenu && (
          <button type="button" onClick={() => setMenuOpen(true)} aria-haspopup="dialog" className={barButton(!activeInBar)}>
            <NavIcon name="menu" />
            Menu
          </button>
        )}
      </nav>
      {showMenu && (
        <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
          <nav aria-label="Semua menu" className="max-h-[60vh] space-y-3 overflow-y-auto">
            {groups.map((group) => (
              <div key={group.id}>
                {group.label && (
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{group.label}</p>
                )}
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <NavLink item={item} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </Dialog>
      )}
    </>
  );
}
