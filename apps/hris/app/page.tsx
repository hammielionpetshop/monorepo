import { redirect } from 'next/navigation';
import { currentHrisSession } from '@/lib/auth';
import { LogoutButton } from './logout-button';

export const dynamic = 'force-dynamic';

// Halaman minimum L1d: membuktikan sesi pusat dan tautan HRIS. Data karyawan baru hadir di L2.
export default async function HomePage() {
  const session = await currentHrisSession();
  if (!session.ok) {
    // Tanpa tautan: tolak dengan pesan jelas; jangan memantulkan ke login karena sesinya sah.
    if (session.code === 'APP_ACCESS_DENIED' || session.code === 'ACCESS_EXPIRED') {
      return (
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-sm space-y-3 text-center">
            <h1 className="text-xl font-semibold">Akses HRIS belum tersedia</h1>
            <p className="text-sm text-gray-600">Akun ini belum memiliki tautan akses HRIS. Hubungi Owner atau GM.</p>
            <LogoutButton />
          </div>
        </main>
      );
    }
    redirect('/login');
  }
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold">HRIS Hammielion</h1>
        <p className="text-sm text-gray-500">Anda sudah masuk. Fitur HRIS sedang dibangun.</p>
        <LogoutButton />
      </div>
    </main>
  );
}
