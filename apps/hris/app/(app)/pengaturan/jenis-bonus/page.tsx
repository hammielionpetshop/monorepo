import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { BonusTypesScreen, bonusTypesScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L23 Jenis Bonus (spec L4d §4, §9 butir 8).
export default async function BonusTypesPage() {
  const actor = await requirePageAnyAction(['bonus.view', 'settings.manage']);
  if (!actor) return <NoAccess />;
  const data = await bonusTypesScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Jenis Bonus" description="Jenis bonus, persennya, dan jabatan penerimanya." actions={<NewBadge feature="/pengaturan/jenis-bonus" />} />
      <BonusTypesScreen {...data} />
    </>
  );
}
