import type { ReactNode } from 'react';
import type { NavItem } from '@/lib/nav';
import { LogoutButton } from './logout-button';
import { BottomNav, SideNav } from './nav-links';
import { ToastProvider } from './ui/toast';

/** Kerangka halaman masuk: header, menu samping (lebar) / bawah (HP), isi. */
export function AppShell({ items, children }: { items: NavItem[]; children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen md:grid md:grid-cols-[14rem_1fr]">
        <aside className="hidden border-r border-line bg-surface p-3 md:block">
          <p className="mb-4 px-3 pt-2 text-base font-semibold text-brand-700">HRIS Hammielion</p>
          <SideNav items={items} />
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="flex min-h-14 items-center justify-between border-b border-line bg-surface px-4">
            <span className="font-semibold text-brand-700 md:hidden">HRIS Hammielion</span>
            <span className="hidden md:block" />
            <LogoutButton />
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 sm:p-6 md:pb-6">{children}</main>
        </div>
        <BottomNav items={items} />
      </div>
    </ToastProvider>
  );
}
