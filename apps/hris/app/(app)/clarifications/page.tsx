import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { MyClarificationsScreen, myClarificationsScreen, type MyTab } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const TABS: MyTab[] = ['open', 'waiting', 'done'];

// KEH-L35 Perlu Dijelaskan (diri sendiri).
export default async function ClarificationsPage({ searchParams }: { searchParams: Promise<{ tab?: string; semua?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.self.check']);
  if (!actor) return <NoAccess />;
  const params = await searchParams;
  const data = await myClarificationsScreen(actor, TABS.find((tab) => tab === params.tab) ?? 'open', params.semua === '1');
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Perlu Dijelaskan" description="Alpha, lupa absen, telat, dan pulang cepat yang perlu Anda jelaskan, beserta batas waktunya." />
      {data.tracked ? <MyClarificationsScreen {...data} /> : <p className="text-sm text-ink-muted">{data.problem}</p>}
    </>
  );
}
