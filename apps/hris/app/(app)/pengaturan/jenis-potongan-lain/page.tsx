import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { DeductionTypesScreen, deductionTypesScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Jenis Potongan Lain (GAJ-L16, PRI-20).
export default async function DeductionTypesPage() {
  const actor = await requirePageAnyAction(['other_deduction.view', 'other_deduction_types.manage']);
  if (!actor) return <NoAccess />;
  const data = await deductionTypesScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Jenis Potongan Lain" description="Daftar jenis ganti rugi yang bisa dipilih saat mengajukan Potongan Lain." actions={<NewBadge feature="/pengaturan/jenis-potongan-lain" />} />
      <DeductionTypesScreen {...data} />
    </>
  );
}
