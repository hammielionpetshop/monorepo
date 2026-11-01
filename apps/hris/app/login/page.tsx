import { redirect } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { currentHrisSession } from '@/lib/auth';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

// Hanya kembali ke halaman absen; alamat lain diabaikan supaya tautan login tidak bisa dipakai membelokkan orang.
function safeReturn(next: string | undefined): string {
  return next && /^\/absen(\?c=[A-Za-z0-9_%-]+)?$/.test(next) ? next : '/';
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const target = safeReturn((await searchParams).next);
  if ((await currentHrisSession()).ok) redirect(target);
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <ThemeToggle className="absolute right-3 top-3" />
      <p className="text-lg font-semibold text-brand-700">HRIS Hammielion</p>
      <LoginForm returnTo={target} />
    </main>
  );
}
