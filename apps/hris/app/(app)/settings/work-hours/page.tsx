import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess, hasAction } from '@/modules/access';
import { WorkHoursScreen, workHoursScreen } from '@/modules/attendance';
import { todayWib } from '@/modules/employees';

export const dynamic = 'force-dynamic';

// KEH-L01 Jam Kerja Cabang.
export default async function WorkHoursPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const actor = await requirePageAction('attendance.work_hours.view');
  if (!actor) return <NoAccess />;
  const { branch } = await searchParams;
  const data = await workHoursScreen(actor, branch ? Number(branch) : null, todayWib());
  return (
    <>
      <PageHeader title="Jam Kerja Cabang" description="Jam kerja milik cabang dan bertanggal berlaku. Yang sudah lewat tidak berubah." />
      <WorkHoursScreen {...data} canEdit={hasAction(actor, 'attendance.work_hours.update')} />
    </>
  );
}
