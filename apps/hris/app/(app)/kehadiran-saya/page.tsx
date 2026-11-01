import { EmptyState, PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { MyAttendanceScreen, myAttendanceScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L17 Kehadiran Saya.
export default async function MyAttendancePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.my_recap.view']);
  if (!actor) return <NoAccess />;
  const { period } = await searchParams;
  const data = await myAttendanceScreen(actor, period ?? null);
  return (
    <>
      <PageHeader title="Kehadiran Saya" description="Kehadiran Anda per periode 26 sampai 25." />
      {data.tracked ? <MyAttendanceScreen {...data} /> : <EmptyState title="Jabatan Anda tidak diabsen lewat QR." />}
    </>
  );
}
