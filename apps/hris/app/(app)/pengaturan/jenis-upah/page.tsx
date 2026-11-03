import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { WageKindsScreen, wageKindsScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// DRV-L01 Jenis Upah (spec L7 §1, U1): baca saja.
export default async function WageKindsPage() {
  const actor = await requirePageAction('wage.rate.view');
  if (!actor) return <NoAccess />;
  const data = wageKindsScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Jenis Upah" description="Daftar jenis upah, cara menghitungnya, dan jalur bayarnya." actions={<NewBadge feature="/pengaturan/jenis-upah" />} />
      <WageKindsScreen {...data} />
    </>
  );
}
