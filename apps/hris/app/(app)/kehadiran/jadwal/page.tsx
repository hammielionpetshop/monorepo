import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ScheduleScreen, mondayOf, scheduleScreen } from '@/modules/attendance';
import { todayWib } from '@/modules/employees';

export const dynamic = 'force-dynamic';

// KEH-L02 Jadwal & Shift. Baris disaring per orang di layanan (lingkup cabang/departemen).
export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ branch?: string; week?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.schedule.view']);
  if (!actor) return <NoAccess />;
  const { branch, week } = await searchParams;
  const now = todayWib();
  const monday = /^\d{4}-\d{2}-\d{2}$/.test(week ?? '') ? mondayOf(week as string) : mondayOf(now);
  const data = await scheduleScreen(actor, branch ? Number(branch) : null, monday, now);
  return (
    <>
      <PageHeader title="Jadwal & Shift" description="Siapa bekerja di shift apa, per minggu." />
      <ScheduleScreen {...data} selfId={actor.personId} />
    </>
  );
}
