import { EmptyState, PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { MyScheduleScreen, mondayOf, mySchedule } from '@/modules/attendance';
import { todayWib } from '@/modules/employees';

export const dynamic = 'force-dynamic';

// KEH-L05 Jadwal Saya.
export default async function MySchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.my_schedule.view']);
  if (!actor) return <NoAccess />;
  const { week } = await searchParams;
  const now = todayWib();
  const monday = /^\d{4}-\d{2}-\d{2}$/.test(week ?? '') ? mondayOf(week as string) : mondayOf(now);
  const data = await mySchedule(actor, monday, now);
  return (
    <>
      <PageHeader title="Jadwal Saya" />
      {data.tracked ? <MyScheduleScreen {...data} /> : <EmptyState title="Jabatan Anda tidak diabsen.">Jadi tidak ada jadwal untuk ditampilkan.</EmptyState>}
    </>
  );
}
