import { redirect } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { currentHrisSession } from '@/lib/auth';
import { CodeForm } from '../forgot-form';

export const dynamic = 'force-dynamic';

// KAR-L05 Pakai kode dari GM (tanpa masuk).
export default async function RecoveryCodePage() {
  if ((await currentHrisSession()).ok) redirect('/');
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <ThemeToggle className="absolute right-3 top-3" />
      <p className="text-lg font-semibold text-brand-700">HRIS Hammielion</p>
      <CodeForm />
    </main>
  );
}
