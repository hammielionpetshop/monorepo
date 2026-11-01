import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PhotosScreen, photosScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L14 Foto Absen Hari Ini; tanggal bisa dipilih sepanjang masa simpan foto (spec L3c §4).
export default async function AttendancePhotosPage({ searchParams }: { searchParams: Promise<{ branch?: string; date?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.photo.view']);
  if (!actor) return <NoAccess />;
  const { branch, date } = await searchParams;
  const data = await photosScreen(actor, /^\d+$/.test(branch ?? '') ? Number(branch) : null, new Date(), date ?? null);
  return (
    <>
      <PageHeader title="Foto Absen Hari Ini" description="Hanya untuk melihat. Setiap foto yang dibuka tercatat." />
      <PhotosScreen {...data} />
    </>
  );
}
