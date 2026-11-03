import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { currentPath } from '@/lib/former-access';
import { limitedPathAllowed } from '@/modules/access';

export const dynamic = 'force-dynamic';

// Penjaga alamat akses terbatas mantan karyawan (spec L4g §3.7). Di template, bukan tata letak, supaya diperiksa juga
// saat pindah halaman tanpa memuat ulang. Selain mantan karyawan: tidak mengubah apa pun.
export default async function AppTemplate({ children }: { children: React.ReactNode }) {
  const { actor } = await getRequestActor();
  if (!actor?.limited) return children;
  const path = await currentPath();
  if (path === '/') redirect('/pendapatan');
  if (limitedPathAllowed(path)) return children;
  return (
    <EmptyState title="Halaman ini tidak tersedia">
      Akun Anda hanya bisa membuka Pendapatan Saya, Pengajuan Saya (keberatan slip), Pemberitahuan, dan Profil sampai urusan gaji selesai.
    </EmptyState>
  );
}
