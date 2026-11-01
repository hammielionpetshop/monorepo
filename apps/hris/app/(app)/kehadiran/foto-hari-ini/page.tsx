import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PhotosScreen, photosScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L14 Foto Absen Hari Ini.
export default async function AttendancePhotosPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.photo.view']);
  if (!actor) return <NoAccess />;
  const { branch } = await searchParams;
  const data = await photosScreen(actor, /^\d+$/.test(branch ?? '') ? Number(branch) : null);
  return (
    <>
      <PageHeader title="Foto Absen Hari Ini" description="Hanya untuk melihat. Setiap foto yang dibuka tercatat." />
      <PhotosScreen {...data} />
    </>
  );
}
