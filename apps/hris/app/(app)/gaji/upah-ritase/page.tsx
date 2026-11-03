import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { TripWagesScreen, tripWagesScreen, type TripWageTab } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

const TABS: TripWageTab[] = ['ALL', 'LOOK', 'REVALUED', 'UNRATED'];

// DRV-L05 Upah Ritase (spec L7 §3.2, §3.3): rupiah tiap ritase dan upah belanja per minggu upah Jumat–Kamis.
export default async function TripWagesPage({ searchParams }: { searchParams: Promise<{ minggu?: string; tab?: string }> }) {
  const actor = await requirePageAction('wage.trip.view');
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const tab = TABS.includes(q.tab as TripWageTab) ? (q.tab as TripWageTab) : 'ALL';
  const data = await tripWagesScreen(actor, q.minggu ?? null, tab);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Upah Ritase" description="Upah ritase dan belanja supplier per orang, dihitung dari tarif yang berlaku pada tanggal trip." actions={<NewBadge feature="/gaji/upah-ritase" />} />
      <TripWagesScreen {...data} />
    </>
  );
}
