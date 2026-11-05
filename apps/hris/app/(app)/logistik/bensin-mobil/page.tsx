import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { FollowupScreen, FuelPanel, followupScreen, fuelPanel } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Bensin & Mobil (spec LT1 §13.3 butir 6, §17.1): permintaan bensin diisi Finance (nominal + foto struk), keadaan mobil untuk Kepala Gudang.
export default async function FollowupPage() {
  const actor = await requirePageAnyAction(['logistics.vehicle_followup.manage', 'logistics.fuel.record']);
  if (!actor) return <NoAccess />;
  const [follow, fuel] = await Promise.all([followupScreen(actor), fuelPanel(actor)]);
  if (!fuel) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Bensin & Mobil"
        description="Permintaan bensin dari Laporan Pulang driver diisi Finance dengan nominal dan foto struk; keadaan mobil ditindaklanjuti Kepala Gudang."
        actions={<NewBadge feature="/logistik/bensin-mobil" />}
      />
      <div className="space-y-4">
        <FuelPanel requests={follow?.fuel ?? []} {...fuel} />
        {follow && <FollowupScreen condition={follow.condition} recent={follow.recent} />}
      </div>
    </>
  );
}
