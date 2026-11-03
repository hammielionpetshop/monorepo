import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PeriodsScreen, periodsScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L08 Periode Slip (spec L4e §4).
export default async function PeriodsPage() {
  const actor = await requirePageAnyAction(['payslip.view', 'payslip.view_periods']);
  if (!actor) return <NoAccess />;
  const data = await periodsScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Periode Slip" description="Slip gaji bulanan per periode 26–25: perkiraan, tertahan, dan ditutup." actions={<NewBadge feature="/gaji/periode" />} />
      <PeriodsScreen {...data} />
    </>
  );
}
