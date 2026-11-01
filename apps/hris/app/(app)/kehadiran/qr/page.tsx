import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { LocationScreen, locationScreen } from '@/modules/attendance';
import { todayWib } from '@/modules/employees';

export const dynamic = 'force-dynamic';

// KEH-L03 Lokasi & QR Cabang.
export default async function LocationPage() {
  const actor = await requirePageAction('attendance.location.view');
  if (!actor) return <NoAccess />;
  const now = todayWib();
  const data = await locationScreen(actor, now);
  return (
    <>
      <PageHeader title="Lokasi & QR Cabang" description="Titik lokasi, radius absen, dan QR tiap cabang." />
      <LocationScreen {...data} today={now} />
    </>
  );
}
