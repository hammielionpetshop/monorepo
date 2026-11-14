import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { TripForm, tripFormScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

export default async function NewTripPage() {
  const actor = await requirePageAction('logistics.trip.manage');
  if (!actor) return <NoAccess />;
  const data = await tripFormScreen(actor, null);
  if (!data || data.notEditable) return <NoAccess />;
  return (
    <>
      <PageHeader title="Buat trip" description="Tanggal trip lahir saat driver menekan Berangkat." />
      <TripForm {...data} />
    </>
  );
}
