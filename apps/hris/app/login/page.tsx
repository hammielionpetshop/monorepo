import { redirect } from 'next/navigation';
import { currentHrisSession } from '@/lib/auth';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if ((await currentHrisSession()).ok) redirect('/');
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <LoginForm />
    </main>
  );
}
