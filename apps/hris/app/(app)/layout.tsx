import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LogoutButton } from '@/components/logout-button';
import { EmptyState } from '@/components/ui/surface';
import { currentHrisSession } from '@/lib/auth';
import { visibleNav } from '@/lib/nav';

export const dynamic = 'force-dynamic';

// Semua halaman masuk melewati sini: sesi pusat + tautan HRIS diperiksa satu kali.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await currentHrisSession();
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
  // Pemeriksa hak (L2b) menyusul; sampai itu menu ber-`action` tersembunyi.
  return <AppShell items={visibleNav()}>{children}</AppShell>;
}
