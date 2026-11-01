import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LogoutButton } from '@/components/logout-button';
import { HoldSecondsProvider } from '@/components/ui/hold-button';
import { NewFeaturesProvider } from '@/components/ui/new-badge';
import { EmptyState } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { visibleNav } from '@/lib/nav';
import { NEW_FEATURES, activeNewFeatures } from '@/lib/new-features';
import { hasAction } from '@/modules/access';
import { tracksAttendance } from '@/modules/attendance';
import { unreadCount } from '@/modules/notifications';
import { waitingSummary } from '@/modules/requests';
import { shellSettingsToday } from '@/modules/settings';

export const dynamic = 'force-dynamic';

// Semua halaman masuk melewati sini: sesi pusat + tautan HRIS diperiksa satu kali.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, actor } = await getRequestActor();
  if (!session.ok) {
    // Sesi sah tetapi tanpa tautan HRIS: jangan memantul ke login.
    if (session.code === 'APP_ACCESS_DENIED' || session.code === 'ACCESS_EXPIRED') {
      return (
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-sm">
            <EmptyState title="Akses HRIS belum tersedia" action={<LogoutButton />}>
              Akun ini belum memiliki tautan akses HRIS. Hubungi Owner atau GM.
            </EmptyState>
          </div>
        </main>
      );
    }
    const back = (await headers()).get('x-hris-return');
    redirect(back ? `/login?next=${encodeURIComponent(back)}` : '/login');
  }
  const [shell, unread, waiting] = await Promise.all([shellSettingsToday(), unreadCount(session.accountId), waitingSummary(actor)]);
  const checksIn = actor ? await tracksAttendance(actor, shell.today) : false;
  return (
    <HoldSecondsProvider seconds={shell.holdSeconds}>
      <NewFeaturesProvider keys={activeNewFeatures(NEW_FEATURES, shell.today, shell.newBadgeDays)}>
        <AppShell groups={visibleNav((action) => (action === 'attendance.self.check' ? checksIn : hasAction(actor, action)))} counts={{ notifications: unread, approvals: waiting.count }}>{children}</AppShell>
      </NewFeaturesProvider>
    </HoldSecondsProvider>
  );
}
