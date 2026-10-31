'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { NavItem } from '@/lib/nav';

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Sisi kiri di layar lebar. */
export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu utama" className="space-y-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? 'page' : undefined}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium',
            isActive(pathname, item.href) ? 'bg-brand-100 text-brand-700' : 'text-ink-muted hover:bg-canvas',
          )}
        >
          <span aria-hidden>{item.icon}</span>{item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Bilah bawah di HP. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface md:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? 'page' : undefined}
          className={cn(
            'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs',
            isActive(pathname, item.href) ? 'font-semibold text-brand-700' : 'text-ink-muted',
          )}
        >
          <span aria-hidden className="text-lg">{item.icon}</span>{item.label}
        </Link>
      ))}
    </nav>
  );
}
