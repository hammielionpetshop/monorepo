import { redirect } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { currentHrisSession } from '@/lib/auth';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if ((await currentHrisSession()).ok) redirect('/');
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <ThemeToggle className="absolute right-3 top-3" />
      <p className="text-lg font-semibold text-brand-700">HRIS Hammielion</p>
      <LoginForm />
    </main>
  );
}
