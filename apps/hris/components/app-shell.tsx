import type { ReactNode } from 'react';
import type { NavCounts, NavGroup } from '@/lib/nav';
import { BackButton } from './back-button';
import { LogoutButton } from './logout-button';
import { ThemeToggle } from './theme-toggle';
import { BottomNav, HeaderBell, SideNav } from './nav-links';
import { ToastProvider } from './ui/toast';

/**
 * Kerangka halaman masuk: header, menu samping berkelompok (lebar) / bilah bawah + Menu (HP), isi.
 * Di layar lebar kerangka setinggi layar; menu samping dan header diam, hanya <main> yang digulir.
 */
export function AppShell({ groups, counts, children }: { groups: NavGroup[]; counts?: NavCounts; children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen md:grid md:h-dvh md:min-h-0 md:grid-cols-[14rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden print:block print:h-auto print:overflow-visible">
        <aside className="hidden print:hidden border-r border-line bg-surface p-3 md:block md:overflow-y-auto">
          <p className="mb-4 px-3 pt-2 text-base font-semibold text-brand-700">HRIS Hammielion</p>
          <SideNav groups={groups} counts={counts} />
        </aside>
        <div className="flex min-w-0 flex-col md:min-h-0">
          <header className="print:hidden flex min-h-14 items-center justify-between border-b border-line bg-surface px-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-semibold text-brand-700 md:hidden">HRIS</span>
              <BackButton />
            </div>
            <div className="flex items-center gap-1">
              <HeaderBell count={counts?.notifications} />
              <ThemeToggle />
              <LogoutButton />
            </div>
          </header>
          <main className="w-full min-w-0 flex-1 p-4 pb-24 sm:p-6 md:min-h-0 md:overflow-y-auto md:pb-6 print:overflow-visible print:p-0">{children}</main>
        </div>
        <div className="print:hidden"><BottomNav groups={groups} counts={counts} /></div>
      </div>
    </ToastProvider>
  );
}
