import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LogoutButton } from '@/components/logout-button';
import { EmptyState } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { visibleNav } from '@/lib/nav';
import { hasAction } from '@/modules/access';

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
    redirect('/login');
  }
  return <AppShell items={visibleNav((action) => hasAction(actor, action))}>{children}</AppShell>;
}
