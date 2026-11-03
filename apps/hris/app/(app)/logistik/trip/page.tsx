import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { TripsScreen, tripsScreen, type TripTab } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Trip (spec L6 §4): Kepala Gudang, Pemilik, GM membuat dan memantau trip; HR melihat.
export default async function TripsPage({ searchParams }: { searchParams: Promise<{ tab?: string; tanggal?: string }> }) {
  const actor = await requirePageAction('logistics.trip.view');
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const tab: TripTab = q.tab === 'hanging' || q.tab === 'history' ? q.tab : 'today';
  const data = await tripsScreen(actor, tab, q.tanggal ?? null);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Trip" description="Mobil, rute kirim, belanja supplier, dan awak. Berangkat dan Sampai Garasi ditekan dari HP driver." actions={<NewBadge feature="/logistik/trip" />} />
      <TripsScreen {...data} />
    </>
  );
}
