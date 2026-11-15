import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { TripDetailScreen, tripDetailScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Rincian trip (spec L6 §4). Kantor dengan hak lihat trip, atau awak trip itu sendiri.
export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const { actor } = await getRequestActor();
  const data = await tripDetailScreen(actor, Number(id));
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Trip ${data.card.number}`} />
      <TripDetailScreen {...data} />
    </>
  );
}
