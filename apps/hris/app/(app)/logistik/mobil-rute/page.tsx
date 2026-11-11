import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { FleetScreen, VehicleRentalPanel, fleetScreen, vehicleRentalSettings, wibDate } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Mobil & Rute (spec L6 §3.1): tidak dihapus, hanya dinonaktifkan. Titik garasi dan pagar uji untuk Pemilik/GM.
export default async function FleetPage() {
  const actor = await requirePageAnyAction(['logistics.fleet.manage', 'logistics.trip.view']);
  if (!actor) return <NoAccess />;
  const data = await fleetScreen(actor);
  if (!data) return <NoAccess />;
  const rental = await vehicleRentalSettings(actor);
  return (
    <>
      <PageHeader title="Mobil & Rute" description="Rute belanja = nama supplier. Supplier baru cukup ditambah sebagai rute belanja." actions={<NewBadge feature="/logistik/mobil-rute" />} />
      <FleetScreen {...data} />
      <div className="mt-4"><VehicleRentalPanel {...rental} vehicles={data.vehicles} today={wibDate(new Date())} /></div>
    </>
  );
}
