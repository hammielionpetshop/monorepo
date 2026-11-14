import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { DayRecordScreen, dayRecordScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L15 Catatan Hari Kerja.
export default async function DayRecordPage({ searchParams }: { searchParams: Promise<{ employee?: string; date?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.recap.view']);
  if (!actor) return <NoAccess />;
  const { employee, date } = await searchParams;
  const data = await dayRecordScreen(actor, { employeeId: /^\d+$/.test(employee ?? '') ? Number(employee) : null, date: date ?? null });
  return (
    <>
      <PageHeader title="Catatan Hari Kerja" description="Catatan satu orang pada satu hari, lengkap dengan asalnya." />
      <DayRecordScreen {...data} />
    </>
  );
}
