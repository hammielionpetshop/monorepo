import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { LossSettingsScreen, lossSettingsScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L14 Tanggungan Kehilangan Barang (spec L4c §3.1).
export default async function LossSettingsPage() {
  const actor = await requirePageAnyAction(['inventory_loss.view', 'settings.manage']);
  if (!actor) return <NoAccess />;
  const data = await lossSettingsScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Tanggungan Kehilangan" description="Persen kantor per cabang, dan jabatan yang ikut menanggung beserta bobotnya." actions={<NewBadge feature="/pengaturan/tanggungan-kehilangan" />} />
      <LossSettingsScreen {...data} />
    </>
  );
}
