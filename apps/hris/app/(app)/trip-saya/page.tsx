import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { MyTripsScreen, myTripsScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Trip Saya (spec L6 §4, KEH-L18): driver dan kenek. Hanya trip yang menugaskan dirinya (dicek server).
export default async function MyTripsPage() {
  const { actor } = await getRequestActor();
  const data = await myTripsScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Trip Saya" description="Berangkat = absen masuk, Sampai Garasi = absen pulang." actions={<NewBadge feature="/trip-saya" />} />
      <MyTripsScreen {...data} />
    </>
  );
}
