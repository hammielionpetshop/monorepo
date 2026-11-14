import { notFound } from 'next/navigation';
import { Alert, PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { TripForm, tripFormScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const actor = await requirePageAction('logistics.trip.manage');
  if (!actor) return <NoAccess />;
  const data = await tripFormScreen(actor, Number(id));
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Ubah trip" />
      {data.notEditable ? <Alert tone="warn">Trip ini sudah berangkat atau ditutup. Ubah awak dan supplier dari rincian trip.</Alert> : <TripForm {...data} />}
    </>
  );
}
