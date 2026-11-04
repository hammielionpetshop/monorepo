import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { FollowupScreen, followupScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Bensin & Mobil (spec LT1 §13.3 butir 6): tindak lanjut Laporan Pulang driver untuk Kepala Gudang dan Finance.
export default async function FollowupPage() {
  const actor = await requirePageAction('logistics.vehicle_followup.manage');
  if (!actor) return <NoAccess />;
  const data = await followupScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Bensin & Mobil"
        description="Permintaan bensin dan keadaan mobil dari Laporan Pulang driver."
        actions={<NewBadge feature="/logistik/bensin-mobil" />}
      />
      <FollowupScreen {...data} />
    </>
  );
}
