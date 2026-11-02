import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { MyOvertimeScreen, myOvertimeScreen, type OvertimeTab } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const TABS: OvertimeTab[] = ['open', 'waiting', 'done'];

// KEH-L41 Lembur Saya.
export default async function OvertimePage({ searchParams }: { searchParams: Promise<{ tab?: string; semua?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.self.check']);
  if (!actor) return <NoAccess />;
  const params = await searchParams;
  const data = await myOvertimeScreen(actor, TABS.find((tab) => tab === params.tab) ?? 'open', params.semua === '1');
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Lembur Saya" description="Lembur yang terdeteksi, batas klaimnya, dan statusnya. Hanya jam; nominal ada di slip." />
      {data.tracked ? <MyOvertimeScreen {...data} /> : <p className="text-sm text-ink-muted">{data.problem}</p>}
    </>
  );
}
