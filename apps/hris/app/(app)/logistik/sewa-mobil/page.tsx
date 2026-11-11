import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { VehicleRentalScreen, vehicleRentalScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Sewa Mobil per ritase (F2-5b, spec F2-5 §3.3): Finance/Pemilik/GM membayar; Kepala Gudang hanya melihat.
export default async function VehicleRentalPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const actor = await requirePageAnyAction(['logistics.vehicle_rental.view', 'logistics.vehicle_rental.pay']);
  if (!actor) return <NoAccess />;
  const data = await vehicleRentalScreen(actor, (await searchParams).bulan ?? null);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Sewa Mobil" description="Ritase mobil sewa per bulan: 1 trip Selesai = 1 ritase, dikali tarif sewa pada tanggal trip." actions={<NewBadge feature="/logistik/sewa-mobil" />} />
      <VehicleRentalScreen {...data} />
    </>
  );
}
