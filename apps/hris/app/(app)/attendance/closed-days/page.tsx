import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ClosuresScreen, closuresScreen } from '@/modules/attendance';
import { todayWib } from '@/modules/employees';

export const dynamic = 'force-dynamic';

// KEH-L04 Hari Tutup.
export default async function ClosuresPage() {
  const actor = await requirePageAnyAction(['attendance.closure.view']);
  if (!actor) return <NoAccess />;
  const data = await closuresScreen(actor);
  return (
    <>
      <PageHeader title="Hari Tutup" description="Tanggal cabang tutup: tidak ada yang alpha, jatah libur utuh, dan hari itu dibayar." />
      <ClosuresScreen {...data} today={todayWib()} />
    </>
  );
}
